import type { StudentItemState, PracticeItem, ReviewGrade, MasteryLevel } from '../../types/math';
import { MS_PER_DAY } from '../time/clock';

// ── FSRS-4.5 ────────────────────────────────────────────────────────────────
// A faithful, compact implementation of the Free Spaced Repetition Scheduler
// (v4.5) with its published default weights. Stability grows on success (more
// for Easy, less for Hard), resets low on a lapse, difficulty drifts toward a
// baseline, and the next interval is derived from stability for a target
// retention — reviewing late (low retrievability) earns a bigger stability gain.

/** Grade → numeric rating used by FSRS: again=1, hard=2, good=3, easy=4. */
const RATING: Record<ReviewGrade, number> = { again: 1, hard: 2, good: 3, easy: 4 };

/** FSRS-4.5 default weights (w0..w16). */
export const FSRS_W = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.0310,
  1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.5870, 0.2272, 2.8755,
];

/** Target retention for scheduling the next review. */
export const TARGET_RETENTION = 0.9;
const MIN_STABILITY = 0.1;

const clampD = (d: number) => Math.min(10, Math.max(1, d));
const clampS = (s: number) => Math.max(MIN_STABILITY, s);

/** Retrievability after `t` days at stability `s` (FSRS-4.5). */
export function fsrsRetrievability(t: number, s: number): number {
  if (s <= 0) return 0;
  return Math.pow(1 + Math.max(0, t) / (9 * s), -1);
}

/** Interval (days) to reach `retention` from stability `s`. At 0.9 this ≈ s. */
export function fsrsInterval(s: number, retention = TARGET_RETENTION): number {
  return 9 * s * (1 / retention - 1);
}

function initStability(grade: ReviewGrade): number {
  return clampS(FSRS_W[RATING[grade] - 1]);
}
function initDifficulty(grade: ReviewGrade): number {
  return clampD(FSRS_W[4] - FSRS_W[5] * (RATING[grade] - 3));
}
function nextDifficulty(d: number, grade: ReviewGrade): number {
  const nd = d - FSRS_W[6] * (RATING[grade] - 3);
  // Mean-reversion toward the "Good" baseline difficulty (w4).
  return clampD(FSRS_W[7] * FSRS_W[4] + (1 - FSRS_W[7]) * nd);
}
function recallStability(d: number, s: number, r: number, grade: ReviewGrade): number {
  const hard = grade === 'hard' ? FSRS_W[15] : 1;
  const easy = grade === 'easy' ? FSRS_W[16] : 1;
  const inc =
    Math.exp(FSRS_W[8]) *
    (11 - d) *
    Math.pow(s, -FSRS_W[9]) *
    (Math.exp(FSRS_W[10] * (1 - r)) - 1) *
    hard * easy;
  return clampS(s * (1 + inc));
}
function lapseStability(d: number, s: number, r: number): number {
  return clampS(
    FSRS_W[11] *
    Math.pow(d, -FSRS_W[12]) *
    (Math.pow(s + 1, FSRS_W[13]) - 1) *
    Math.exp(FSRS_W[14] * (1 - r)),
  );
}

export function updateMasteryLevel(state: StudentItemState): MasteryLevel {
  const { correctCount, attemptCount, stabilityDays } = state;
  if (attemptCount === 0) return 'new';
  const accuracy = correctCount / attemptCount;
  if (accuracy < 0.5 || stabilityDays < 1) return 'learning';
  if (accuracy < 0.75 || stabilityDays < 3) return 'developing';
  if (accuracy < 0.9 || stabilityDays < 14) return 'strong';
  return 'mastered';
}

export function applyReview(
  state: StudentItemState,
  grade: ReviewGrade,
  latencyMs: number,
  answer: string,
  now: Date,
): StudentItemState {
  const isCorrect = grade !== 'again';
  const newAttemptCount = state.attemptCount + 1;
  const newCorrectCount = state.correctCount + (isCorrect ? 1 : 0);
  const reps = state.reps ?? 0;

  let newS: number;
  let newD: number;

  if (reps === 0 || state.stabilityDays <= 0 || !state.fsrsDifficulty) {
    // First scheduled review of this card.
    newD = initDifficulty(grade);
    newS = initStability(grade);
  } else {
    const d = state.fsrsDifficulty;
    const lastMs = state.lastSeenAt ? new Date(state.lastSeenAt).getTime() : now.getTime();
    const elapsedDays = Math.max(0, (now.getTime() - lastMs) / MS_PER_DAY);
    const r = fsrsRetrievability(elapsedDays, state.stabilityDays);
    newD = nextDifficulty(d, grade);
    newS = isCorrect
      ? recallStability(d, state.stabilityDays, r, grade)
      : lapseStability(d, state.stabilityDays, r);
  }

  // "again" → review again in this same session (due now). Otherwise schedule
  // from stability for the target retention. Intervals are in app-time days.
  const intervalDays = grade === 'again' ? 0 : fsrsInterval(newS);
  const nextDue = new Date(now.getTime() + intervalDays * MS_PER_DAY);

  const newPersonalBest = isCorrect
    ? (state.personalBestMs === undefined ? latencyMs : Math.min(state.personalBestMs, latencyMs))
    : state.personalBestMs;

  const updated: StudentItemState = {
    ...state,
    attemptCount: newAttemptCount,
    correctCount: newCorrectCount,
    lastAnswer: answer,
    lastCorrect: isCorrect,
    lastLatencyMs: latencyMs,
    medianLatencyMs: rollingMedian(state.medianLatencyMs, latencyMs),
    personalBestMs: newPersonalBest,
    stabilityDays: newS,
    fsrsDifficulty: newD,
    reps: reps + 1,
    lapses: (state.lapses ?? 0) + (grade === 'again' ? 1 : 0),
    lastSeenAt: now.toISOString(),
    nextDueAt: grade === 'again' ? now.toISOString() : nextDue.toISOString(),
  };
  updated.masteryLevel = updateMasteryLevel(updated);
  return updated;
}

export function createInitialState(
  studentId: string,
  item: PracticeItem,
): StudentItemState {
  return {
    studentId,
    itemId: item.id,
    skillId: item.skillId,
    attemptCount: 0,
    correctCount: 0,
    lastCorrect: false,
    lastLatencyMs: 0,
    medianLatencyMs: 0,
    ease: 2.5,
    stabilityDays: 0,
    fsrsDifficulty: 0,
    reps: 0,
    lapses: 0,
    difficulty: item.difficulty,
    masteryLevel: 'new',
    mistakePatterns: [],
  };
}

function rollingMedian(current: number, next: number): number {
  if (current === 0) return next;
  return Math.round(current * 0.7 + next * 0.3);
}

export interface SessionPlan {
  dueItems: string[];
  weakItems: string[];
  newItems: string[];
}

export function planSession(
  allItems: PracticeItem[],
  states: Map<string, StudentItemState>,
  now: Date,
  totalQuestions = 20
): SessionPlan {
  const nowStr = now.toISOString();

  const due: PracticeItem[] = [];
  const weak: PracticeItem[] = [];
  const unseen: PracticeItem[] = [];

  for (const item of allItems) {
    const state = states.get(item.id);
    if (!state || state.masteryLevel === 'new') {
      unseen.push(item);
    } else if (state.nextDueAt && state.nextDueAt <= nowStr) {
      due.push(item);
    } else if (state.masteryLevel === 'learning' || state.masteryLevel === 'developing') {
      weak.push(item);
    }
  }

  const dueCount = Math.round(totalQuestions * 0.6);
  const weakCount = Math.round(totalQuestions * 0.2);
  const newCount = totalQuestions - dueCount - weakCount;

  due.sort((a, b) => {
    const sa = states.get(a.id)?.nextDueAt ?? '';
    const sb = states.get(b.id)?.nextDueAt ?? '';
    return sa.localeCompare(sb);
  });
  weak.sort((a, b) => {
    const sa = states.get(a.id);
    const sb = states.get(b.id);
    const accA = sa ? sa.correctCount / Math.max(1, sa.attemptCount) : 0;
    const accB = sb ? sb.correctCount / Math.max(1, sb.attemptCount) : 0;
    return accA - accB;
  });
  unseen.sort((a, b) => a.difficulty - b.difficulty);

  return {
    dueItems: due.slice(0, dueCount).map(i => i.id),
    weakItems: weak.slice(0, weakCount).map(i => i.id),
    newItems: unseen.slice(0, newCount).map(i => i.id),
  };
}

/** Build a randomized queue for a table drill. Repeats if pool < count. */
export function planTableSession(
  items: PracticeItem[],
  count: number
): string[] {
  if (items.length === 0) return [];
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  const queue: string[] = [];
  while (queue.length < count) {
    for (const item of shuffled) {
      if (queue.length >= count) break;
      queue.push(item.id);
    }
  }
  return queue;
}
