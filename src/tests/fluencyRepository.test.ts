import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/dexie';
import { mathAnswerEventRepo } from '../db/repositories';
import type { MathAnswerEvent } from '../features/learning/learningEvents';

function event(id: string, overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return {
    id, studentId: 'student', sessionId: 'session', itemId: 'MUL_7x8', cardKey: 'fact:mul:7x8',
    mode: 'practice', promptShown: '7 × 8', correctAnswer: 56, studentAnswer: 56,
    isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 1000,
    schedulingEligible: true, responsePolicy: 'atomic_fluency',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(async () => {
  await db.mathAnswerEvents.clear();
});

describe('mathAnswerEventRepo.getDirectCorrectFirstAttempts', () => {
  it('filters non-independent or non-atomic evidence and returns stable chronological order', async () => {
    await db.mathAnswerEvents.bulkPut([
      event('later', { createdAt: '2026-01-02T00:00:00.000Z' }),
      event('same-b', { createdAt: '2026-01-01T00:00:00.000Z' }),
      event('same-a', { createdAt: '2026-01-01T00:00:00.000Z' }),
      event('retry', { isRetry: true }),
      event('related', { relatedEvidence: true }),
      event('hinted', { hintUsed: true }),
      event('repeat', { schedulingEligible: false }),
      event('wrong', { isCorrect: false }),
      event('zero', { latencyMs: 0 }),
      event('invalid', { latencyMs: Number.NaN }),
      event('procedural', { responsePolicy: 'procedural' }),
      event('other-student', { studentId: 'other' }),
    ]);

    const result = await mathAnswerEventRepo.getDirectCorrectFirstAttempts('student');
    expect(result.map(row => row.id)).toEqual(['same-a', 'same-b', 'later']);
  });
});
