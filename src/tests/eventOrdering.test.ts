import { describe, expect, it } from 'vitest';
import { chronologicalEvents, compareEventsChronologically } from '../features/learning/eventOrdering';
import type { MathAnswerEvent } from '../features/learning/learningEvents';

const event = (id: string, createdAt: string): MathAnswerEvent => ({
  id, createdAt, studentId: 'student', sessionId: 'session', itemId: 'MUL_2x2',
  mode: 'practice', promptShown: '2 × 2', correctAnswer: 4, studentAnswer: 4,
  isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 1000,
});

describe('answer event chronological ordering', () => {
  it('uses event ID as the deterministic equal-timestamp tie-breaker', () => {
    expect([event('b', '2026-01-01T00:00:00Z'), event('a', '2026-01-01T00:00:00Z')]
      .sort(compareEventsChronologically).map(value => value.id)).toEqual(['a', 'b']);
  });

  it('explicitly excludes invalid timestamps from recency analytics', () => {
    expect(chronologicalEvents([
      event('invalid', 'not-a-date'),
      event('valid', '2026-01-01T00:00:00Z'),
    ]).map(value => value.id)).toEqual(['valid']);
  });
});
