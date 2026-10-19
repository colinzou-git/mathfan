import type { PracticeItem } from '../../types/math';
import { GRADE4_SKILLS, getCurriculumSkill } from '../curriculum/curriculumRegistry';
import { makeFoundationItem } from '../curriculum/foundationItems';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { inferGrade3SkillId } from '../mastery/skillMapping';
import { planPracticeForSkill } from '../mastery/skillPracticePlanner';
import type { DiagnosticPlan } from './diagnosticPlanner';

export interface ReadinessResult { item: PracticeItem; isCorrect: boolean }
export const READINESS_MAX_QUESTIONS = 22;
const PREREQUISITES = ['g3-mul-tables-advanced', 'g3-area-formula', 'g3-patterns-arithmetic', 'g3-round-nearest-10-100', 'g3-add-3digit-regrouping', 'g3-sub-across-zero', 'g3-mul-meaning'];
// Published blueprints are immutable: curriculum growth must not change a resumed check.
const V1_PROBES = ['g4-oa-factor-meaning', 'g4-oa-factor-pairs', 'g4-oa-multiples', 'g4-oa-prime-composite', 'g4-oa-pattern-rule', 'g4-oa-pattern-features', 'g4-nbt-ten-times', 'g4-nbt-read-write', 'g4-nbt-compare-order', 'g4-nbt-round-any-place', 'g4-nbt-add-standard', 'g4-nbt-sub-standard', 'g4-nbt-estimate-check'];
const V2_PROBES = ['g4-oa-factor-pairs', 'g4-oa-multiples', 'g4-oa-prime-composite', 'g4-oa-pattern-rule', 'g4-nbt-ten-times', 'g4-nbt-read-write', 'g4-nbt-compare-order', 'g4-nbt-round-any-place', 'g4-nbt-add-standard', 'g4-nbt-sub-standard', 'g4-oa-mult-compare-meaning', 'g4-oa-add-vs-mult-compare', 'g4-oa-multistep-model'];

export function readinessSessionId(studentId: string, events: readonly { sessionId: string }[]): string {
  const current = `g4-readiness:${studentId}:v2`, legacy = `g4-readiness:${studentId}:v1`;
  return events.some(event => event.sessionId === current) ? current : events.some(event => event.sessionId === legacy) ? legacy : current;
}

export function readinessProbeSkillIds(version: 1 | 2, skills: readonly { id: string }[] = GRADE4_SKILLS): string[] {
  const available = new Set(skills.map(skill => skill.id));
  return [...new Set(version === 1 ? V1_PROBES : [...V2_PROBES, ...V1_PROBES])].filter(id => available.has(id)).slice(0, READINESS_MAX_QUESTIONS - 2 - PREREQUISITES.length);
}

/** Seven prerequisites + thirteen sampled entry probes + at most two contrasts. */
export function buildReadinessPlan(sessionId: string, results: ReadinessResult[] = []): DiagnosticPlan {
  const items: PracticeItem[] = []; let contrasts = 0;
  const add = (first: PracticeItem, contrast: () => PracticeItem | null) => {
    items.push(first);
    if (results.some(result => result.item.id === first.id && !result.isCorrect) && contrasts < 2) {
      const item = contrast();
      if (item) { items.push(item); contrasts++; }
    }
  };
  for (const id of PREREQUISITES) {
    const pool = planPracticeForSkill(id).specificItemIds ?? [];
    const first = pool[0] ? makeItemFromId(pool[0]) : null;
    if (!first) throw new Error(`Missing readiness prerequisite probe: ${id}`);
    add(first, () => { const id = pool.find(itemId => itemId !== first.id); return id ? makeItemFromId(id) : null; });
  }
  readinessProbeSkillIds(sessionId.endsWith(':v1') ? 1 : 2).forEach((id, index) => {
    add(makeFoundationItem(id, index % 2 ? 'symbolic' : 'model', 0, 300 + index),
      () => makeFoundationItem(id, 'check', 0, 600 + index));
  });
  return { sessionId, items, description: 'Find your Grade 4 starting point with a short sample of factors, patterns, place value, arithmetic and comparison. Quick refreshes are suggestions, and every skill stays available.' };
}

export function readinessRecommendations(results: ReadinessResult[]): { startSkillId: string; refreshSkillIds: string[] } {
  const refreshSkillIds = [...new Set(results.filter(result => !result.isCorrect && result.item.gradeLevel !== 4).map(result => inferGrade3SkillId(result.item)).filter((id): id is string => !!id && !!getCurriculumSkill(id)))];
  const observed = new Set(results.map(result => result.item.skillId));
  // Unprobed skills are unknown, not failed. Prioritize an observed difficulty first.
  const failed = GRADE4_SKILLS.find(skill => observed.has(skill.id) && !results.some(result => result.item.skillId === skill.id && result.isCorrect));
  const startSkillId = failed?.id ?? GRADE4_SKILLS.find(skill => !observed.has(skill.id))?.id ?? GRADE4_SKILLS[0].id;
  return { startSkillId, refreshSkillIds };
}
