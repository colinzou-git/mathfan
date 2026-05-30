import type { StudentItemState, PracticeItem, ReviewGrade, MasteryLevel } from '../../types/math';

const INITIAL_STABILITY = 1;

export function nextIntervalDays(currentStabilityDays: number, grade: ReviewGrade): number {
  if (grade === 'again') return 0;
  if (grade === 'hard') return Math.max(1, currentStabilityDays * 0.8);
  if (grade === 'good') return Math.max(2, currentStabilityDays * 1.8);
  if (grade === 'easy') return Math.max(4, currentStabilityDays * 2.8);
  return 1;
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
  now: Date
): StudentItemState {
  const isCorrect = grade !== 'again';
  const newCorrectCount = state.correctCount + (isCorrect ? 1 : 0);
  const newAttemptCount = state.attemptCount + 1;

  const newStabilityDays = isCorrect
    ? nextIntervalDays(state.stabilityDays || INITIAL_STABILITY, grade)
    : 0;

  const intervalMs = newStabilityDays * 24 * 60 * 60 * 1000;
  const nextDue = new Date(now.getTime() + intervalMs);

  // Update personal best only on correct answers
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
    stabilityDays: newStabilityDays,
    lastSeenAt: now.toISOString(),
    nextDueAt: grade === 'again' ? now.toISOString() : nextDue.toISOString(),
  };
  updated.masteryLevel = updateMasteryLevel(updated);
  return updated;
}

export function createInitialState(
  studentId: string,
  item: PracticeItem
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
    stabilityDays: INITIAL_STABILITY,
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
