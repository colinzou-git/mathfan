import type { SessionConfig, StudentItemState } from '../../types/math';
import type { StudentSkillSummary } from './skillMasteryEngine';
import { planPracticeForSkill } from './skillPracticePlanner';
import { GRADE3_MASTERY_MAP } from './grade3MasteryMap';

export interface TodayPlan {
  warmup: SessionConfig | null;
  focusSkillId: string | null;
  focus: SessionConfig | null;
  review: SessionConfig | null;
  estimatedMinutes: number;
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
// 4. new (next skill whose prerequisites are satisfied)
// 5. maintenance review if available

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

function pickFocusSkill(
  summaries: StudentSkillSummary[],
  summaryMap: Map<string, StudentSkillSummary>,
): StudentSkillSummary | null {
  // Sort by priority (lower number = higher priority), then by accuracy ascending
  // (so we focus on the weakest skill within the same priority bucket).
  const candidates = summaries
    .filter(s => {
      if (s.status === 'mastered') return false;
      if (s.status === 'new') return prerequisitesSatisfied(s.skillId, summaryMap);
      return true;
    })
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 5;
      const pb = STATUS_PRIORITY[b.status] ?? 5;
      if (pa !== pb) return pa - pb;
      return a.accuracy - b.accuracy; // weaker first within same priority
    });

  return candidates[0] ?? null;
}

function buildWarmup(summaries: StudentSkillSummary[]): SessionConfig | null {
  // Warm-up: pick the highest-accuracy non-mastered skill (easiest for today)
  const easiest = summaries
    .filter(s => s.status !== 'new' && s.status !== 'mastered')
    .sort((a, b) => b.accuracy - a.accuracy)[0];

  if (!easiest) return null;

  return planPracticeForSkill(easiest.skillId, { sessionLength: 5 });
}

function buildReview(itemStates: StudentItemState[], now: Date): SessionConfig | null {
  const nowStr = now.toISOString();
  const dueIds = itemStates
    .filter(s => s.nextDueAt != null && s.nextDueAt <= nowStr)
    .map(s => s.itemId);

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

  // Warm-up: easiest skill (skip if the focus IS the easiest)
  const warmupConfig = buildWarmup(skillSummaries);
  const warmup = warmupConfig &&
    // Skip warmup if it would be the same skill as focus
    (focusSkillSummary == null ||
     warmupConfig.specificItemIds?.every(id => !focus?.specificItemIds?.includes(id)))
    ? warmupConfig
    : null;

  // Review: due items
  const review = buildReview(itemStates, now);

  return {
    warmup,
    focusSkillId,
    focus,
    review,
    estimatedMinutes: estimateMinutes(warmup, focus, review),
  };
}
