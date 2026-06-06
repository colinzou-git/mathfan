/**
 * FSRS adapter — the only place in MathFan that imports from ts-fsrs.
 *
 * Converts between MathFan's StudentItemState and ts-fsrs Card types,
 * applying the official FSRS scheduling algorithm. All other files should
 * call applyFsrsReview() rather than importing ts-fsrs directly.
 */
import { fsrs, Rating, State, createEmptyCard } from 'ts-fsrs';
import type { Card } from 'ts-fsrs';
import type { StudentItemState, ReviewGrade } from '../../types/math';

const GRADE_MAP: Record<ReviewGrade, Exclude<Rating, Rating.Manual>> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

// Disable short-term (intraday) learning steps: math facts are reviewed across
// practice sessions over days, not in Anki-style intraday step queues.
// Fuzz is also disabled for deterministic scheduling and predictable tests.
const f = fsrs({ enable_short_term: false, enable_fuzz: false });

export type FsrsStatePatch = Pick<StudentItemState,
  | 'stabilityDays'
  | 'fsrsDifficulty'
  | 'reps'
  | 'lapses'
  | 'lastSeenAt'
  | 'nextDueAt'
  | 'fsrsCardState'
  | 'fsrsScheduledDays'
  | 'fsrsLearningSteps'
>;

/**
 * Apply a ts-fsrs review to a MathFan item state, returning only the
 * FSRS-owned fields. All other MathFan fields (attemptCount, correctCount,
 * latency, masteryLevel, etc.) remain the caller's responsibility.
 *
 * nextDueAt reflects ts-fsrs scheduling. Callers that want 'again' to mean
 * "retry immediately in this session" should override nextDueAt to now.
 */
export function applyFsrsReview(
  state: StudentItemState,
  grade: ReviewGrade,
  now: Date,
): FsrsStatePatch {
  const card = stateToCard(state, now);
  const result = f.next(card, now, GRADE_MAP[grade]);
  const next = result.card;

  return {
    stabilityDays: next.stability,
    fsrsDifficulty: next.difficulty,
    reps: next.reps,
    lapses: next.lapses,
    lastSeenAt: now.toISOString(),
    nextDueAt: next.due.toISOString(),
    fsrsCardState: next.state,
    fsrsScheduledDays: next.scheduled_days,
    fsrsLearningSteps: next.learning_steps,
  };
}

/**
 * Best-effort reconstruction of a ts-fsrs Card from MathFan's stored fields.
 *
 * Existing users may have only stabilityDays + fsrsDifficulty without the full
 * ts-fsrs card envelope (e.g., card state enum). We approximate State.Review for
 * any card that has been reviewed before (reps > 0). This is accurate for
 * long-term scheduling: with enable_short_term=false there are no intraday
 * Relearning steps whose state would be lost by this approximation.
 */
function stateToCard(state: StudentItemState, now: Date): Card {
  const reps = state.reps ?? 0;

  if (reps === 0 || !state.stabilityDays || !state.fsrsDifficulty) {
    // Fresh card — ts-fsrs initialises stability and difficulty on first review.
    return createEmptyCard(now);
  }

  const lastReviewRaw = state.lastSeenAt ? new Date(state.lastSeenAt) : now;
  // Clamp to now: ts-fsrs throws FSRSValidationError for delta_t < 0, which occurs
  // when lastSeenAt is in the future (clock drift or Drive-synced data from a device
  // with an incorrect clock).
  const lastReview = lastReviewRaw.getTime() > now.getTime() ? now : lastReviewRaw;
  const due = state.nextDueAt ? new Date(state.nextDueAt) : now;
  // Use stored scheduledDays when available; fall back to deriving from due/lastReview.
  const scheduledDays = state.fsrsScheduledDays ?? Math.max(0, Math.round(
    (due.getTime() - lastReview.getTime()) / 86_400_000,
  ));
  const elapsedDays = Math.max(0, Math.floor(
    (now.getTime() - lastReview.getTime()) / 86_400_000,
  ));
  // Use stored card state when available; fall back to State.Review for legacy records with reps>0.
  const cardState: State = state.fsrsCardState !== undefined
    ? (state.fsrsCardState as State)
    : State.Review;

  return {
    due,
    stability: state.stabilityDays,
    difficulty: state.fsrsDifficulty,
    elapsed_days: elapsedDays,
    scheduled_days: scheduledDays,
    learning_steps: state.fsrsLearningSteps ?? 0,
    reps,
    lapses: state.lapses ?? 0,
    state: cardState,
    last_review: lastReview,
  };
}
