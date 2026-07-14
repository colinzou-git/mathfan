import type { StudentItemState, PracticeItem, ReviewGrade, MasteryLevel } from '../../types/math';
import { applyFsrsReview } from './fsrsAdapter';
import { deriveCardKey, stateForItem } from './cardModel';

// ── FSRS utility helpers (for display / tests) ────────────────────────────────
// Lightweight display helpers used by the UI and tests.
// These use the FSRS-4.5 forgetting-curve formula for retrievability display.
// Actual card scheduling is performed by ts-fsrs (fsrsAdapter.ts), which uses
// its own default parameters (FSRS-6) and may produce different intervals.

/** Target retention for scheduling the next review. */
export const TARGET_RETENTION = 0.9;

// Forgetting-curve constants (FSRS-4.5 formula, display only).
// R(t,S) = (1 + FACTOR·t/S)^DECAY   I(r,S) = S/FACTOR·(r^(1/DECAY) − 1)
const DECAY = -0.5;
const FACTOR = 19 / 81;

/** Retrievability after `t` days at stability `s` (display helper, FSRS-4.5 formula). */
export function fsrsRetrievability(t: number, s: number): number {
  if (s <= 0) return 0;
  return Math.pow(1 + FACTOR * Math.max(0, t) / s, DECAY);
}

/** Interval (days) to reach `retention` at stability `s` (display helper, FSRS-4.5 formula). */
export function fsrsInterval(s: number, retention = TARGET_RETENTION): number {
  return (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
}

// ── Mastery ───────────────────────────────────────────────────────────────────

export function updateMasteryLevel(state: StudentItemState): MasteryLevel {
  const { correctCount, attemptCount, stabilityDays } = state;
  if (attemptCount === 0) return 'new';
  const accuracy = correctCount / attemptCount;
  if (accuracy < 0.5 || stabilityDays < 1) return 'learning';
  if (accuracy < 0.75 || stabilityDays < 3) return 'developing';
  if (accuracy < 0.9 || stabilityDays < 14) return 'strong';
  return 'mastered';
}

// ── applyReview ───────────────────────────────────────────────────────────────

export interface ApplyReviewOptions {
  /**
   * Actual correctness from checkAnswer. When omitted, defaults to
   * grade !== 'again'. Pass explicitly to decouple correctness from grade
   * (e.g. a correct-but-slow answer has grade='hard' and isCorrect=true).
   */
  isCorrect?: boolean;
}

export function applyReview(
  state: StudentItemState,
  grade: ReviewGrade,
  latencyMs: number,
  answer: string,
  now: Date,
  options?: ApplyReviewOptions,
): StudentItemState {
  const isCorrect = options?.isCorrect ?? grade !== 'again';
  const newAttemptCount = state.attemptCount + 1;
  const newCorrectCount = state.correctCount + (isCorrect ? 1 : 0);

  const fsrsPatch = applyFsrsReview(state, grade, now);

  // 'again' means "retry in this session" — override ts-fsrs's due date so
  // the item stays in the active queue rather than being scheduled days out.
  const nextDueAt = grade === 'again' ? now.toISOString() : fsrsPatch.nextDueAt;

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
    stabilityDays: fsrsPatch.stabilityDays,
    fsrsDifficulty: fsrsPatch.fsrsDifficulty,
    reps: fsrsPatch.reps,
    lapses: fsrsPatch.lapses,
    lastSeenAt: fsrsPatch.lastSeenAt,
    nextDueAt,
    fsrsCardState: fsrsPatch.fsrsCardState,
    fsrsScheduledDays: fsrsPatch.fsrsScheduledDays,
    fsrsLearningSteps: fsrsPatch.fsrsLearningSteps,
  };
  updated.masteryLevel = updateMasteryLevel(updated);
  return updated;
}

/**
 * Mild grade used for indirect (related-calculation) evidence. 'hard' is the
 * weakest FSRS pass, so an embedded fact gets a small, conservative bump.
 */
export const RELATED_EVIDENCE_GRADE: ReviewGrade = 'hard';

/**
 * Apply mild positive evidence from a related higher-level item to a calculation
 * fact's state (e.g. a first-try-correct AREA_RECT_8x7 reinforcing MUL_8x7).
 *
 * Updates ONLY the FSRS-owned scheduling fields and the derived masteryLevel.
 * attemptCount, correctCount, latency, and personalBest are deliberately left
 * untouched so the fact's displayed accuracy and speed reflect direct practice
 * alone — the nudge moves the spaced-repetition schedule, not the stats.
 */
export function applyRelatedEvidence(state: StudentItemState, now: Date): StudentItemState {
  const fsrsPatch = applyFsrsReview(state, RELATED_EVIDENCE_GRADE, now);
  const updated: StudentItemState = {
    ...state,
    stabilityDays: fsrsPatch.stabilityDays,
    fsrsDifficulty: fsrsPatch.fsrsDifficulty,
    reps: fsrsPatch.reps,
    lapses: fsrsPatch.lapses,
    lastSeenAt: fsrsPatch.lastSeenAt,
    nextDueAt: fsrsPatch.nextDueAt,
    fsrsCardState: fsrsPatch.fsrsCardState,
    fsrsScheduledDays: fsrsPatch.fsrsScheduledDays,
    fsrsLearningSteps: fsrsPatch.fsrsLearningSteps,
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
    cardKey: deriveCardKey(item),
    lastItemId: item.id,
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

// ── Session planning ──────────────────────────────────────────────────────────

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
    const state = stateForItem(item, states);
    if (!state || state.masteryLevel === 'new') {
      unseen.push(item);
    } else if (state.nextDueAt && state.nextDueAt <= nowStr) {
      // Includes mastered items whose FSRS due date has arrived — they must
      // not be permanently excluded just because they reached 'mastered'.
      due.push(item);
    } else if (state.masteryLevel === 'learning' || state.masteryLevel === 'developing') {
      weak.push(item);
    }
    // mastered/strong items with a future due date are intentionally excluded
    // until FSRS schedules them back.
  }

  const dueCount  = Math.round(totalQuestions * 0.6);
  const weakCount = Math.round(totalQuestions * 0.2);
  const newCount  = Math.max(0, totalQuestions - dueCount - weakCount);

  due.sort((a, b) => {
    const sa = stateForItem(a, states)?.nextDueAt ?? '';
    const sb = stateForItem(b, states)?.nextDueAt ?? '';
    return sa.localeCompare(sb);
  });
  weak.sort((a, b) => {
    const sa = stateForItem(a, states);
    const sb = stateForItem(b, states);
    const accA = sa ? sa.correctCount / Math.max(1, sa.attemptCount) : 0;
    const accB = sb ? sb.correctCount / Math.max(1, sb.attemptCount) : 0;
    return accA - accB;
  });
  unseen.sort((a, b) => a.difficulty - b.difficulty);

  const selectedDue  = due.slice(0, dueCount);
  const selectedWeak = weak.slice(0, weakCount);
  const selectedNew  = unseen.slice(0, newCount);

  const dueIds  = selectedDue.map(i => i.id);
  const weakIds = selectedWeak.map(i => i.id);
  const newIds  = selectedNew.map(i => i.id);

  const allocated = dueIds.length + weakIds.length + newIds.length;

  // Backfill: pools may be smaller than their quota, or rounding can produce
  // newCount=0 for small totalQuestions (e.g. n=3 → dueCount=2, weakCount=1,
  // newCount=0), leaving the queue shorter than requested.
  const backfill: string[] = [];
  if (allocated < totalQuestions) {
    const usedSet = new Set([...dueIds, ...weakIds, ...newIds]);
    const overflow = [
      ...due.slice(selectedDue.length),
      ...weak.slice(selectedWeak.length),
      ...unseen.slice(selectedNew.length),
    ];
    for (const item of overflow) {
      if (backfill.length >= totalQuestions - allocated) break;
      if (!usedSet.has(item.id)) backfill.push(item.id);
    }
  }

  return {
    dueItems: dueIds,
    weakItems: weakIds,
    newItems: [...newIds, ...backfill],
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
