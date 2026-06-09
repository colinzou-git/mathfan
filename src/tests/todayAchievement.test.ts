/**
 * Regression tests for computeTodayAchievement classification.
 *
 * Diagnostic-mode events write FSRS itemState but are a distinct activity from
 * practice. They must NOT be classified as practice (which would inflate the
 * practice achievement tile). isPractice is now strictly mode === 'practice' && !isDue.
 */
import { describe, it, expect } from 'vitest';
import type { MathAnswerEvent, MathEventMode } from '../features/learning/learningEvents';
import type { PracticeSession, SessionMode } from '../types/math';
import { computeTodayAchievement } from '../features/stats/todayAchievement';

let nextId = 0;
function makeEvent(overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return {
    id: `evt-${++nextId}`,
    studentId: 'student1',
    sessionId: 'sess-1',
    itemId: 'MUL_7x8',
    mode: 'practice' as MathEventMode,
    promptShown: '7 × 8 = ?',
    correctAnswer: 56,
    studentAnswer: 56,
    isCorrect: true,
    isRetry: false,
    hintUsed: false,
    latencyMs: 2000,
    reviewGrade: 'good',
    createdAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeSession(id: string, mode: SessionMode): PracticeSession {
  return {
    id,
    studentId: 'student1',
    startedAt: '2026-06-01T10:00:00.000Z',
    mode,
    plannedQuestionCount: 1,
    completedQuestionCount: 1,
    correctCount: 1,
    averageLatencyMs: 2000,
  };
}

describe('computeTodayAchievement — empty input', () => {
  it('returns zero-count summaries for every tile when there are no events today', () => {
    // The Today's Achievement section relies on this to render all six tiles at
    // zero (instead of hiding) on a day with no activity.
    const data = computeTodayAchievement([], [], []);

    expect(data.questions).toHaveLength(0);
    for (const filter of ['total', 'due', 'practice', 'quiz', 'improved', 'needsFocus'] as const) {
      expect(data[filter].count).toBe(0);
      expect(data[filter].accuracy).toBe(0);
    }
  });
});

describe('computeTodayAchievement — diagnostic classification', () => {
  it('classifies a diagnostic event as diagnostic, not practice', () => {
    // Diagnostic sessions are not persisted as PracticeSession rows, so sessionMode
    // resolves to '' — classification keys off the event mode, not the session.
    const events = [makeEvent({ mode: 'diagnostic', sessionId: 'sess-diag' })];

    const data = computeTodayAchievement(events, [], []);

    const q = data.questions[0];
    expect(q.isDiagnostic).toBe(true);
    expect(q.isPractice).toBe(false);
    expect(q.isQuiz).toBe(false);
    // Diagnostic answers do not count toward the practice tile.
    expect(data.practice.count).toBe(0);
  });

  it('classifies a practice event in a non-review session as practice', () => {
    const events = [makeEvent({ mode: 'practice', sessionId: 'sess-prac' })];
    const sessions = [makeSession('sess-prac', 'multiplication')];

    const data = computeTodayAchievement(events, [], sessions);

    const q = data.questions[0];
    expect(q.isPractice).toBe(true);
    expect(q.isDiagnostic).toBe(false);
    expect(data.practice.count).toBe(1);
  });

  it('a practice event in a daily_review session is due, not practice', () => {
    const events = [makeEvent({ mode: 'practice', sessionId: 'sess-due' })];
    const sessions = [makeSession('sess-due', 'daily_review')];

    const data = computeTodayAchievement(events, [], sessions);

    const q = data.questions[0];
    expect(q.isDue).toBe(true);
    expect(q.isPractice).toBe(false);
    expect(data.practice.count).toBe(0);
    expect(data.due.count).toBe(1);
  });

  it('does not lump diagnostic and practice answers into the same practice total', () => {
    const events = [
      makeEvent({ id: 'p1', mode: 'practice', sessionId: 'sess-prac', itemId: 'MUL_6x9' }),
      makeEvent({ id: 'd1', mode: 'diagnostic', sessionId: 'sess-diag', itemId: 'MUL_7x8' }),
    ];
    const sessions = [
      makeSession('sess-prac', 'multiplication'),
    ];

    const data = computeTodayAchievement(events, [], sessions);

    expect(data.practice.count).toBe(1); // only the practice event
    expect(data.total.count).toBe(2);    // both still count in the overall total
  });
});
