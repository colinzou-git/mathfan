import type { SessionConfig, StudentItemState } from '../../types/math';
import type { StudentSkillSummary } from './skillMasteryEngine';
import { planPracticeForSkill } from './skillPracticePlanner';
import { GRADE3_MASTERY_MAP } from './grade3MasteryMap';
import { inferGrade3SkillId } from './skillMapping';
import { makeItemFromId } from '../curriculum/makeItemFromId';

export interface TodayPlan {
  warmup: SessionConfig | null;
  focusSkillId: string | null;
  focus: SessionConfig | null;
  review: SessionConfig | null;
  estimatedMinutes: number;
  // Soft advisory: titles of the focus skill's prerequisites that are not yet
  // strong/mastered. Empty/absent when prerequisites are satisfied. The focus
  // skill is still suggested — this is copy for a "review prerequisite first"
  // note, not a reason to exclude the skill.
  focusPrereqAdvisory?: string[];
}

export interface PlanTodayArgs {
  studentId: string;
  skillSummaries: StudentSkillSummary[];
  itemStates: StudentItemState[];
  now: Date;
}

// ── Priority order from the spec ──────────────────────────────────────────────
// 1. review_due
// 2. needs_practice
// 3. strong (learning / needs more reps)
// 4. new (next skill)
// 5. maintenance review if available
//
// Prerequisites are a *soft* signal: within a priority bucket, a skill whose
// prerequisites are not yet satisfied ranks below one whose are, but it is never
// excluded. A due/needs-practice skill is suggested even with unmet prerequisites
// (the UI shows an advisory) — only ranking is affected, not eligibility.

const STATUS_PRIORITY: Record<string, number> = {
  review_due:     1,
  needs_practice: 2,
  strong:         3,
  mastered:       99,   // skip: already mastered
  new:            10,   // below existing-skill statuses
};

function prerequisitesSatisfied(skillId: string, summaries: Map<string, StudentSkillSummary>): boolean {
  const node = GRADE3_MASTERY_MAP.find(n => n.id === skillId);
  if (!node) return false;
  if (node.prerequisites.length === 0) return true;
  return node.prerequisites.every(prereqId => {
    const s = summaries.get(prereqId);
    return s && (s.status === 'mastered' || s.status === 'strong');
  });
}

// Titles of the prerequisites not yet strong/mastered, for advisory copy.
function unmetPrereqNames(skillId: string, summaries: Map<string, StudentSkillSummary>): string[] {
  const node = GRADE3_MASTERY_MAP.find(n => n.id === skillId);
  if (!node) return [];
  return node.prerequisites
    .filter(prereqId => {
      const s = summaries.get(prereqId);
      return !(s && (s.status === 'mastered' || s.status === 'strong'));
    })
    .map(prereqId => GRADE3_MASTERY_MAP.find(n => n.id === prereqId)?.title ?? prereqId);
}

function pickFocusSkill(
  summaries: StudentSkillSummary[],
  summaryMap: Map<string, StudentSkillSummary>,
): StudentSkillSummary | null {
  // Sort by status priority, then prefer skills whose prerequisites are satisfied
  // (soft demotion, not exclusion), then by accuracy ascending so we focus on the
  // weakest skill within the same bucket.
  const candidates = summaries
    .filter(s => s.status !== 'mastered')
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 5;
      const pb = STATUS_PRIORITY[b.status] ?? 5;
      if (pa !== pb) return pa - pb;
      const ra = prerequisitesSatisfied(a.skillId, summaryMap) ? 0 : 1;
      const rb = prerequisitesSatisfied(b.skillId, summaryMap) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return a.accuracy - b.accuracy; // weaker first within same priority
    });

  return candidates[0] ?? null;
}

function buildWarmup(
  summaries: StudentSkillSummary[],
  summaryMap: Map<string, StudentSkillSummary>,
): SessionConfig | null {
  // Warm-up: an easy confidence-builder. Prefer a skill whose prerequisites are
  // satisfied, then the highest-accuracy non-new, non-mastered skill.
  const easiest = summaries
    .filter(s => s.status !== 'new' && s.status !== 'mastered')
    .sort((a, b) => {
      const ra = prerequisitesSatisfied(a.skillId, summaryMap) ? 0 : 1;
      const rb = prerequisitesSatisfied(b.skillId, summaryMap) ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return b.accuracy - a.accuracy; // easiest (highest accuracy) first
    })[0];

  if (!easiest) return null;

  return planPracticeForSkill(easiest.skillId, { sessionLength: 5 });
}

function buildReview(
  itemStates: StudentItemState[],
  now: Date,
): SessionConfig | null {
  const nowStr = now.toISOString();
  const dueIds = itemStates
    .filter(s => {
      if (s.nextDueAt == null || s.nextDueAt > nowStr) return false;
      // Must reconstruct from ID (filters off-map/invalid IDs)
      const item = makeItemFromId(s.lastItemId ?? s.cardKey);
      if (!item) return false;
      // Must map to a Grade 3 mastery skill (prerequisites do not gate review —
      // a due item is due regardless of whether its skill's prereqs are met).
      const skillId = inferGrade3SkillId(item);
      if (!skillId) return false;
      return true;
    })
    .map(s => s.lastItemId ?? s.cardKey);

  if (dueIds.length === 0) return null;

  return {
    mode: 'daily_review',
    specificItemIds: dueIds,
    sessionLength: Math.min(dueIds.length, 10),
  };
}

function estimateMinutes(
  warmup: SessionConfig | null,
  focus: SessionConfig | null,
  review: SessionConfig | null,
): number {
  // Rough estimate: each question takes ~20 seconds on average
  const SECONDS_PER_QUESTION = 20;
  let total = 0;
  if (warmup) total += (warmup.sessionLength ?? 5) * SECONDS_PER_QUESTION;
  if (focus) total += (focus.sessionLength ?? 10) * SECONDS_PER_QUESTION;
  if (review) total += (review.sessionLength ?? 10) * SECONDS_PER_QUESTION;
  return Math.ceil(total / 60);
}

export function planToday(args: PlanTodayArgs): TodayPlan {
  const { skillSummaries, itemStates, now } = args;

  // Build summary lookup
  const summaryMap = new Map(skillSummaries.map(s => [s.skillId, s]));

  // Pick focus skill using priority order
  const focusSkillSummary = pickFocusSkill(skillSummaries, summaryMap);
  const focusSkillId = focusSkillSummary?.skillId ?? null;
  const focus = focusSkillId
    ? planPracticeForSkill(focusSkillId, { sessionLength: 10 })
    : null;
  const focusPrereqAdvisory = focusSkillId
    ? unmetPrereqNames(focusSkillId, summaryMap)
    : [];

  // Warm-up: easiest skill (skip if the focus IS the easiest)
  const warmupConfig = buildWarmup(skillSummaries, summaryMap);
  const warmup = warmupConfig &&
    // Skip warmup if it would be the same skill as focus
    (focusSkillSummary == null ||
     warmupConfig.specificItemIds?.every(id => !focus?.specificItemIds?.includes(id)))
    ? warmupConfig
    : null;

  // Review: due items from Grade 3 skills (prerequisites do not exclude items)
  const review = buildReview(itemStates, now);

  return {
    warmup,
    focusSkillId,
    focus,
    review,
    estimatedMinutes: estimateMinutes(warmup, focus, review),
    focusPrereqAdvisory,
  };
}
