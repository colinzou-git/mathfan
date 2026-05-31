import { describe, it, expect } from 'vitest';
import type { AttemptLog, ReviewGrade } from '../types/math';
import {
  classifyAttempts,
  derivePracticeMetrics,
} from '../features/practice/metrics';

let seq = 0;
function attempt(
  itemId: string,
  isCorrect: boolean,
  grade: ReviewGrade = isCorrect ? 'good' : 'again',
): AttemptLog {
  seq += 1;
  return {
    id: `a${seq}`,
    studentId: 'stu1',
    itemId,
    skillId: 'SKILL',
    sessionId: 's1',
    promptShown: 'x',
    correctAnswer: 1,
    studentAnswer: isCorrect ? 1 : 0,
    isCorrect,
    latencyMs: 1000,
    reviewGrade: grade,
    // Monotonic ISO timestamps so ordering is deterministic.
    createdAt: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
  };
}

/** A presentation solved after `tries` attempts (the last one correct). */
function solvedIn(itemId: string, tries: number, grade?: ReviewGrade): AttemptLog[] {
  const out: AttemptLog[] = [];
  for (let n = 1; n < tries; n += 1) out.push(attempt(itemId, false));
  out.push(attempt(itemId, true, grade));
  return out;
}

describe('classifyAttempts', () => {
  it('uses the 1 / 2 / 3+ thresholds', () => {
    expect(classifyAttempts(1)).toBe('first-try');
    expect(classifyAttempts(2)).toBe('corrected');
    expect(classifyAttempts(3)).toBe('repeated');
    expect(classifyAttempts(9)).toBe('repeated');
  });
});

describe('derivePracticeMetrics', () => {
  it('counts a first-try solve as first-try fluency', () => {
    const m = derivePracticeMetrics(solvedIn('i1', 1));
    expect(m).toMatchObject({
      completedItemCount: 1,
      firstTryCount: 1,
      correctedCount: 0,
      repeatedCount: 0,
      attemptCount: 1,
      wrongAttemptCount: 0,
    });
    expect(m.firstTryAccuracy).toBe(1);
  });

  it('classifies wrong-then-right as corrected, not first-try (the core bug)', () => {
    const m = derivePracticeMetrics(solvedIn('i1', 2));
    expect(m.firstTryCount).toBe(0);
    expect(m.correctedCount).toBe(1);
    expect(m.completedItemCount).toBe(1);
    expect(m.attemptCount).toBe(2);
    expect(m.wrongAttemptCount).toBe(1);
    expect(m.firstTryAccuracy).toBe(0);
  });

  it('classifies 3+ attempts as a repeated mistake', () => {
    const m = derivePracticeMetrics(solvedIn('i1', 3));
    expect(m.repeatedCount).toBe(1);
    expect(m.correctedCount).toBe(0);
    expect(m.wrongAttemptCount).toBe(2);
  });

  it('does not count a never-solved (quit) item as completed', () => {
    const m = derivePracticeMetrics([attempt('i1', false), attempt('i1', false)]);
    expect(m.completedItemCount).toBe(0);
    expect(m.attemptCount).toBe(2);
    expect(m.wrongAttemptCount).toBe(2);
    expect(m.firstTryAccuracy).toBe(0);
  });

  it('reproduces "10/10, 100%" as 70% first-try accuracy', () => {
    const attempts: AttemptLog[] = [];
    for (let i = 0; i < 7; i += 1) attempts.push(...solvedIn(`good${i}`, 1));
    for (let i = 0; i < 3; i += 1) attempts.push(...solvedIn(`fix${i}`, 2));
    const m = derivePracticeMetrics(attempts);
    expect(m.completedItemCount).toBe(10);
    expect(m.firstTryCount).toBe(7);
    expect(m.correctedCount).toBe(3);
    expect(m.firstTryAccuracy).toBeCloseTo(0.7, 5);
    expect(m.attemptCount).toBe(13);
  });

  it('flags a first-try solve graded "hard" as slow-but-correct', () => {
    const m = derivePracticeMetrics(solvedIn('i1', 1, 'hard'));
    expect(m.firstTryCount).toBe(1);
    expect(m.slowFirstTryCount).toBe(1);
  });

  it('does not flag a corrected solve as slow-but-correct', () => {
    const m = derivePracticeMetrics(solvedIn('i1', 2, 'hard'));
    expect(m.slowFirstTryCount).toBe(0);
  });

  it('segments repeated presentations of the same item id (table drills)', () => {
    // Same fact queued twice: solved first-try, then later missed once before getting it.
    const attempts = [
      ...solvedIn('MUL_3x4', 1),
      ...solvedIn('MUL_3x4', 2),
    ];
    const m = derivePracticeMetrics(attempts);
    expect(m.completedItemCount).toBe(2);
    expect(m.firstTryCount).toBe(1);
    expect(m.correctedCount).toBe(1);
  });
});
