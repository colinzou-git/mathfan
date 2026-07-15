import type { MathAnswerEvent } from '../learning/learningEvents';
import { GRADE3_MASTERY_MAP } from '../mastery/grade3MasteryMap';
import type { StudentSkillSummary } from '../mastery/skillMasteryEngine';
import type { LearningGoal } from '../goals/types';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { inferGrade3SkillId } from '../mastery/skillMapping';

export interface FocusSkillCandidate { skillId: string; score: number; reasons: string[]; unmetPrerequisites: string[]; evidenceConfidence: number }
export interface RankFocusSkillsArgs { studentId: string; now: string; summaries: StudentSkillSummary[]; goals: LearningGoal[]; events: MathAnswerEvent[]; usableSkillIds: Set<string> }

export function rankFocusSkills(args: RankFocusSkillsArgs): FocusSkillCandidate[] {
  const summaries = new Map(args.summaries.map(summary => [summary.skillId, summary]));
  const goalSkills = new Set(args.goals.filter(goal => goal.status === 'active' && (goal.portfolioRole ?? 'primary') === 'primary').flatMap(goal => goal.targets.map(target => target.skillId)));
  return GRADE3_MASTERY_MAP.filter(node => args.usableSkillIds.has(node.id)).map(node => {
    const summary = summaries.get(node.id);
    const unmetPrerequisites = node.prerequisites.filter(id => !['strong', 'mastered'].includes(summaries.get(id)?.status ?? 'new'));
    const direct = args.events.filter(event => {
      const item = makeItemFromId(event.itemId);
      return !event.isRetry && event.relatedEvidence !== true && item != null && inferGrade3SkillId(item) === node.id;
    }).slice(-12);
    const accuracy = direct.length ? direct.filter(event => event.isCorrect).length / direct.length : summary?.accuracy ?? 0;
    const weakness = summary?.status === 'needs_practice' ? 4 : summary?.status === 'review_due' ? 3 : summary?.status === 'new' ? 2 : summary?.status === 'strong' ? 1 : -5;
    const goalBoost = goalSkills.has(node.id) ? 3 : 0;
    const score = weakness + goalBoost + (1 - accuracy) * 2 - unmetPrerequisites.length * .35;
    const reasons = [goalBoost ? 'Supports a primary goal.' : '', weakness >= 3 ? 'Recent evidence needs strengthening.' : '', direct.some(event => !event.isCorrect) ? 'Recent first attempts included a lapse.' : ''].filter(Boolean);
    return { skillId: node.id, score, reasons, unmetPrerequisites, evidenceConfidence: Math.min(1, direct.length / 8) };
  }).sort((a, b) => b.score - a.score || a.skillId.localeCompare(b.skillId));
}
