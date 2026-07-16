import type { GradeLevel, PracticeItem, SelectionContext, StudentItemState, StudentSettings } from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';
import type { StudentSkillSummary } from '../mastery/skillMasteryEngine';
import type { LearningGoal } from '../goals/types';
import { deriveCardKey } from '../scheduler/cardModel';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { planPracticeForSkill, buildFocusSequence as buildSkillFocusSequence } from '../mastery/skillPracticePlanner';
import { getGrade3Skill } from '../mastery/grade3MasteryMap';
import { inferGrade3SkillId } from '../mastery/skillMapping';
import { getRelatedSkillIds } from '../adaptive/relatedItemMapping';
import { rankFocusSkills } from './focusSkillSelector';
import { deriveLearningUnitProgress } from '../learning/learningUnitProgress';
import { learnerLocalDateKey } from '../time/localDate';
import { chronologicalEvents } from '../learning/eventOrdering';
import { DAILY_LESSON_PLANNER_VERSION } from '../learning/schedulingTelemetry';

export type LessonSegmentKind = 'retrieval' | 'focus' | 'transfer';
export interface PlannedLessonItem {
  item: PracticeItem;
  cardKey: string;
  segment: LessonSegmentKind;
  rationale: string;
  schedulingEligible: boolean;
  selection: SelectionContext;
}
export interface DailyLessonWarning { code: 'sparse_retrieval' | 'unmet_prerequisite' | 'sparse_transfer' | 'no_focus'; message: string }
export interface DailyLessonPlan { id: string; studentId: string; generatedAt: string; estimatedMinutes: number; focusSkillId?: string; focusSkillTitle?: string; items: PlannedLessonItem[]; segmentCounts: Record<LessonSegmentKind, number>; warnings: DailyLessonWarning[] }
export interface PlanDailyLessonArgs { studentId: string; gradeLevel: GradeLevel; now: string; timezone: string; settings: StudentSettings; events: MathAnswerEvent[]; itemStates: StudentItemState[]; skillSummaries: StudentSkillSummary[]; goals: LearningGoal[]; rng: () => number }
export interface LessonAvailability { retrieval: number; focus: number; transfer: number }
export interface LessonAllocation { retrieval: number; focus: number; transfer: number }

const COMPLEX_TYPES = new Set(['word_problem', 'elapsed_time', 'area_perimeter_compare', 'perimeter_unknown_side']);
export function estimateItemSeconds(item: PracticeItem, events: MathAnswerEvent[]): number {
  const history = chronologicalEvents(events)
    .filter(event => event.itemId === item.id && event.isCorrect)
    .slice(-5)
    .map(event => event.latencyMs)
    .filter(value => value > 0);
  if (history.length) return Math.max(8, Math.min(90, Math.round(history.reduce((sum, value) => sum + value, 0) / history.length / 1000)));
  if (COMPLEX_TYPES.has(item.itemType) || item.wordProblemSpec?.steps.length === 2) return 45;
  if (item.visualSpec || item.measurementSpec || item.fractionSpec || item.divisionSpec || item.arithmeticSpec) return 30;
  return 20;
}

export function allocateLessonSegments(targetSeconds: number, available: LessonAvailability): LessonAllocation {
  const questionBudget = Math.max(8, Math.min(20, Math.round(targetSeconds / 30)));
  const retrieval = Math.min(available.retrieval, Math.max(0, Math.round(questionBudget * .25)));
  const transfer = Math.min(available.transfer, Math.max(0, Math.round(questionBudget * .25)));
  const focus = Math.min(available.focus, Math.max(0, questionBudget - retrieval - transfer));
  return { retrieval, focus, transfer };
}

const shuffled = <T,>(values: T[], rng: () => number) => values.map(value => ({ value, order: rng() })).sort((a, b) => a.order - b.order).map(entry => entry.value);
const uniqueItems = (ids: string[]) => [...new Set(ids)].map(makeItemFromId).filter((item): item is PracticeItem => item !== null);

export function buildTransferPool(focusSkillId: string, grade: GradeLevel, summaries: StudentSkillSummary[]): PracticeItem[] {
  if (grade !== 3) return [];
  const maintained = new Set(summaries.filter(summary => ['strong', 'mastered', 'review_due'].includes(summary.status)).map(summary => summary.skillId));
  const pools = ['g3-word-one-step', 'g3-word-two-step', 'g3-scaled-bar-graphs', 'g3-area-perimeter-choice'].flatMap(skillId => planPracticeForSkill(skillId, { sessionLength: 10 }).specificItemIds ?? []);
  return uniqueItems(pools).filter(item => {
    const own = inferGrade3SkillId(item);
    const related = getRelatedSkillIds(item);
    return related.includes(focusSkillId) || (own != null && maintained.has(own));
  });
}

export function planDailyLesson(args: PlanDailyLessonArgs): DailyLessonPlan {
  const targetSeconds = Math.max(8, Math.min(15, args.settings.dailyGoalMinutes)) * 60;
  const dueStates = args.itemStates.filter(state => state.nextDueAt != null && state.nextDueAt <= args.now)
    .sort((a, b) => (a.nextDueAt ?? '').localeCompare(b.nextDueAt ?? ''));
  const retrievalAll: PracticeItem[] = []; const retrievalCards = new Set<string>();
  for (const state of dueStates) { const item = makeItemFromId(state.lastItemId ?? state.cardKey); if (!item) continue; const key = deriveCardKey(item); if (!retrievalCards.has(key)) { retrievalCards.add(key); retrievalAll.push(item); } }
  const usable = new Set(args.skillSummaries.map(summary => summary.skillId).filter(skillId => (planPracticeForSkill(skillId).specificItemIds?.length ?? 0) > 0));
  const focusCandidate = rankFocusSkills({ studentId: args.studentId, now: args.now, summaries: args.skillSummaries, goals: args.goals, events: args.events, usableSkillIds: usable })[0];
  const focusIds = focusCandidate ? (buildSkillFocusSequence(focusCandidate.skillId).itemIds.length ? buildSkillFocusSequence(focusCandidate.skillId).itemIds : planPracticeForSkill(focusCandidate.skillId).specificItemIds ?? []) : [];
  const focusCatalogue = uniqueItems(focusIds);
  const unitProgress = deriveLearningUnitProgress({ items: focusCatalogue, events: args.events, states: args.itemStates });
  const focusAll = shuffled(focusCatalogue.filter(item => unitProgress.get(deriveCardKey(item))?.status !== 'maintenance'), args.rng);
  const maintenanceTransfer = focusCatalogue.filter(item => unitProgress.get(deriveCardKey(item))?.status === 'maintenance');
  const transferAll = focusCandidate
    ? shuffled([...maintenanceTransfer, ...buildTransferPool(focusCandidate.skillId, args.gradeLevel, args.skillSummaries)], args.rng)
    : [];
  const allocation = allocateLessonSegments(targetSeconds, { retrieval: retrievalAll.length, focus: focusAll.length, transfer: transferAll.length });
  const selectedCards = new Set<string>(); const plannedIds = new Set<string>(); const planned: PlannedLessonItem[] = [];
  const add = (item: PracticeItem, segment: LessonSegmentKind, rationale: string) => {
    const cardKey = deriveCardKey(item); if (plannedIds.has(item.id) || (segment === 'retrieval' && selectedCards.has(cardKey))) return;
    const schedulingEligible = !selectedCards.has(cardKey); selectedCards.add(cardKey); plannedIds.add(item.id);
    planned.push({
      item, cardKey, segment, rationale, schedulingEligible,
      selection: {
        origin: segment === 'retrieval' ? 'due_retrieval' : segment === 'focus' ? 'focus_skill' : 'transfer',
        plannerVersion: DAILY_LESSON_PLANNER_VERSION,
        rationaleCodes: [rationale],
        lessonPlanId: `lesson:${args.studentId}:${learnerLocalDateKey(new Date(args.now), args.timezone)}`,
        lessonSegment: segment,
      },
    });
  };
  retrievalAll.slice(0, allocation.retrieval).forEach(item => add(item, 'retrieval', 'This card is genuinely due for retrieval.'));
  focusAll.slice(0, allocation.focus).forEach((item, index) => add(item, 'focus', index === 0 ? 'Activates and builds today’s priority skill.' : 'Builds independent and near-transfer practice.'));
  transferAll.slice(0, allocation.transfer).forEach(item => add(item, 'transfer', 'Applies learned mathematics in a different representation or context.'));
  const warnings: DailyLessonWarning[] = [];
  if (retrievalAll.length < 3) warnings.push({ code: 'sparse_retrieval', message: 'Only genuinely due cards were included; the lesson did not invent extra review.' });
  if (!focusCandidate) warnings.push({ code: 'no_focus', message: 'No Grade 3 focus skill currently has a usable practice catalogue.' });
  if (focusCandidate?.unmetPrerequisites.length) warnings.push({ code: 'unmet_prerequisite', message: `This focus has advisory prerequisite bridges: ${focusCandidate.unmetPrerequisites.map(id => getGrade3Skill(id)?.title ?? id).join(', ')}.` });
  if (transferAll.length < 3) warnings.push({ code: 'sparse_transfer', message: 'Transfer content is shorter because no unrelated new skill was introduced.' });
  const segmentCounts = { retrieval: planned.filter(value => value.segment === 'retrieval').length, focus: planned.filter(value => value.segment === 'focus').length, transfer: planned.filter(value => value.segment === 'transfer').length };
  const estimatedMinutes = Math.max(1, Math.ceil(planned.reduce((sum, value) => sum + estimateItemSeconds(value.item, args.events), 0) / 60));
  return { id: `lesson:${args.studentId}:${learnerLocalDateKey(new Date(args.now), args.timezone)}`, studentId: args.studentId, generatedAt: args.now, estimatedMinutes, focusSkillId: focusCandidate?.skillId, focusSkillTitle: focusCandidate ? getGrade3Skill(focusCandidate.skillId)?.title ?? focusCandidate.skillId : undefined, items: planned, segmentCounts, warnings };
}
