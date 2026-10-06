import type { PracticeItem } from '../../types/math';
import { GRADE4_SKILLS, getCurriculumSkill } from '../curriculum/curriculumRegistry';
import { makeFoundationItem } from '../curriculum/foundationItems';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { inferGrade3SkillId } from '../mastery/skillMapping';
import { planPracticeForSkill } from '../mastery/skillPracticePlanner';
import type { DiagnosticPlan } from './diagnosticPlanner';

export interface ReadinessResult { item: PracticeItem; isCorrect: boolean }
const PREREQUISITES = ['g3-mul-tables-advanced', 'g3-area-formula', 'g3-patterns-arithmetic', 'g3-round-nearest-10-100', 'g3-add-3digit-regrouping', 'g3-sub-across-zero', 'g3-mul-meaning'];
/** At most 20 entry probes + two contrast probes. Deterministic event-based resumption. */
export function buildReadinessPlan(sessionId: string, results: ReadinessResult[] = []): DiagnosticPlan {
  const items: PracticeItem[] = []; let contrasts = 0;
  for (const id of PREREQUISITES) {
    const pool = planPracticeForSkill(id).specificItemIds ?? [];
    const first = pool[0] ? makeItemFromId(pool[0]) : null;
    if (!first) throw new Error(`Missing readiness prerequisite probe: ${id}`);
    items.push(first);
    if (results.some(result => result.item.id === first.id && !result.isCorrect) && contrasts < 2) {
      const contrast = pool.find(itemId => itemId !== first.id);
      const item = contrast ? makeItemFromId(contrast) : null;
      if (item) { items.push(item); contrasts++; }
    }
  }
  GRADE4_SKILLS.forEach((skill, index) => {
    const first = makeFoundationItem(skill.id, index % 2 ? 'symbolic' : 'model', 0, 300 + index);
    items.push(first);
    if (results.some(result => result.item.id === first.id && !result.isCorrect) && contrasts < 2) {
      items.push(makeFoundationItem(skill.id, 'check', 0, 600 + index)); contrasts++;
    }
  });
  return { sessionId, items, description: 'Find your Grade 4 starting point in factors, patterns, place value, addition and subtraction. Quick refreshes are suggestions, and every skill stays available.' };
}
export function readinessRecommendations(results: ReadinessResult[]): { startSkillId: string; refreshSkillIds: string[] } {
  const refreshSkillIds = [...new Set(results.filter(result => !result.isCorrect && result.item.gradeLevel !== 4).map(result => inferGrade3SkillId(result.item)).filter((id): id is string => !!id && !!getCurriculumSkill(id)))];
  const startSkillId = GRADE4_SKILLS.find(skill => !results.some(result => result.item.skillId === skill.id && result.isCorrect))?.id ?? GRADE4_SKILLS[0].id;
  return { startSkillId, refreshSkillIds };
}
