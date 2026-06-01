import type { MultiplicationFactStats, MasteryState, MultiplicationFactKey } from './types';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { createInitialFactStats, parseFactKey } from './multiplicationFacts';

// Response time thresholds (ms) — easy to adjust
export const FAST_MS = 3000;
export const NORMAL_MS = 6000;
export const SLOW_MS = 10000;

// Score deltas per answer outcome
const DELTA_CORRECT_FAST = 12;
const DELTA_CORRECT_NORMAL = 6;
const DELTA_CORRECT_SLOW = 3;
const DELTA_WRONG = -15;
const DELTA_WRONG_VERY_SLOW = -20;

// Mastery score thresholds: 0–39 weak, 40–59 learning, 60–79 strong, 80–100 mastered
const THRESHOLD_LEARNING = 40;
const THRESHOLD_STRONG = 60;
const THRESHOLD_MASTERED = 80;

const STRONG_STATES: readonly MasteryState[] = ['strong', 'mastered'];

export function scoreDelta(isCorrect: boolean, responseTimeMs: number): number {
  if (isCorrect) {
    if (responseTimeMs <= FAST_MS) return DELTA_CORRECT_FAST;
    if (responseTimeMs <= NORMAL_MS) return DELTA_CORRECT_NORMAL;
    return DELTA_CORRECT_SLOW;
  }
  return responseTimeMs > SLOW_MS ? DELTA_WRONG_VERY_SLOW : DELTA_WRONG;
}

export function computeMasteryState(
  score: number,
  prevState: MasteryState,
  isCorrect: boolean,
  responseTimeMs: number,
): MasteryState {
  // Forgotten: was strong/mastered, now got it wrong or answered very slowly
  if (STRONG_STATES.includes(prevState)) {
    if (!isCorrect || responseTimeMs > SLOW_MS) return 'forgotten';
  }
  // Stay forgotten until the score climbs out of the weak range
  if (prevState === 'forgotten' && !isCorrect) return 'forgotten';

  if (score < THRESHOLD_LEARNING) return 'weak';
  if (score < THRESHOLD_STRONG) return 'learning';
  if (score < THRESHOLD_MASTERED) return 'strong';
  return 'mastered';
}

export function applyAnswerToStats(
  stats: MultiplicationFactStats,
  isCorrect: boolean,
  responseTimeMs: number,
  answeredAt: string,
): { updated: MultiplicationFactStats; prevState: MasteryState; prevScore: number } {
  const prevScore = stats.masteryScore;
  const prevState = stats.masteryState;

  const delta = scoreDelta(isCorrect, responseTimeMs);
  const newScore = Math.max(0, Math.min(100, prevScore + delta));

  const newTotal = stats.totalAttempts + 1;
  const newCorrect = isCorrect ? stats.correctAttempts + 1 : stats.correctAttempts;

  const newAvg =
    stats.averageResponseTimeMs === null
      ? responseTimeMs
      : Math.round((stats.averageResponseTimeMs * stats.totalAttempts + responseTimeMs) / newTotal);

  const newState = computeMasteryState(newScore, prevState, isCorrect, responseTimeMs);

  const updated: MultiplicationFactStats = {
    ...stats,
    totalAttempts: newTotal,
    correctAttempts: newCorrect,
    incorrectAttempts: newTotal - newCorrect,
    accuracy: newCorrect / newTotal,
    averageResponseTimeMs: newAvg,
    lastResponseTimeMs: responseTimeMs,
    lastPracticedAt: answeredAt,
    lastQuizAt: answeredAt,
    masteryScore: newScore,
    masteryState: newState,
    streakCorrect: isCorrect ? stats.streakCorrect + 1 : 0,
    streakIncorrect: isCorrect ? 0 : stats.streakIncorrect + 1,
    everTested: true,
  };

  return { updated, prevState, prevScore };
}

/**
 * Recompute MultiplicationFactStats from a stream of MathAnswerEvents.
 * Only non-retry first attempts are counted, matching the quiz mastery scoring model.
 * Pass only events relevant to the desired studentId and factKey.
 */
export function deriveMasteryFromEvents(
  studentId: string,
  factKey: MultiplicationFactKey,
  events: MathAnswerEvent[],
): MultiplicationFactStats {
  const { left, right } = parseFactKey(factKey);
  let stats = createInitialFactStats(studentId, left, right);

  const factEvents = events
    .filter(e => e.itemId === `MUL_${factKey}` && !e.isRetry)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const event of factEvents) {
    stats = applyAnswerToStats(stats, event.isCorrect, event.latencyMs, event.createdAt).updated;
  }
  return stats;
}
