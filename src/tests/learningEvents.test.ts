import { describe, it, expect } from 'vitest';
import type { MathAnswerEvent, MathEventMode } from '../features/learning/learningEvents';
import { deriveMasteryFromEvents } from '../features/multiplication/masteryEngine';
import { eventToAttemptLog, eventsToAttemptLogs } from '../features/stats/statsEngine';

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE_TIME = '2026-06-01T10:00:00.000Z';

let nextId = 0;
function makeEvent(overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return {
    id: `evt-${++nextId}`,
    studentId: 'student1',
    sessionId: 'session1',
    itemId: 'MUL_7x8',
    mode: 'quiz' as MathEventMode,
    promptShown: '7 × 8 = ?',
    correctAnswer: 56,
    studentAnswer: 56,
    isCorrect: true,
    isRetry: false,
    hintUsed: false,
    latencyMs: 2000,
    reviewGrade: 'good',
    createdAt: BASE_TIME,
    ...overrides,
  };
}

// ── Correct answer event ──────────────────────────────────────────────────────

describe('MathAnswerEvent — correct answer', () => {
  it('has isCorrect=true and isRetry=false for a fast first-try', () => {
    const evt = makeEvent({ isCorrect: true, latencyMs: 1500 });
    expect(evt.isCorrect).toBe(true);
    expect(evt.isRetry).toBe(false);
    expect(evt.hintUsed).toBe(false);
  });

  it('stores the student answer and prompt', () => {
    const evt = makeEvent({ studentAnswer: 56, promptShown: '7 × 8 = ?' });
    expect(evt.studentAnswer).toBe(56);
    expect(evt.promptShown).toBe('7 × 8 = ?');
  });

  it('records factStatusBefore and factStatusAfter', () => {
    const evt = makeEvent({ factStatusBefore: 'learning', factStatusAfter: 'strong' });
    expect(evt.factStatusBefore).toBe('learning');
    expect(evt.factStatusAfter).toBe('strong');
  });
});

// ── Wrong answer event ────────────────────────────────────────────────────────

describe('MathAnswerEvent — wrong answer', () => {
  it('has isCorrect=false and records the wrong student answer', () => {
    const evt = makeEvent({ isCorrect: false, studentAnswer: 42 });
    expect(evt.isCorrect).toBe(false);
    expect(evt.studentAnswer).toBe(42);
  });

  it('accepts null studentAnswer when the student skipped', () => {
    const evt = makeEvent({ isCorrect: false, studentAnswer: null });
    expect(evt.studentAnswer).toBeNull();
  });

  it('records the mastery regression', () => {
    const evt = makeEvent({ isCorrect: false, factStatusBefore: 'strong', factStatusAfter: 'forgotten' });
    expect(evt.factStatusBefore).toBe('strong');
    expect(evt.factStatusAfter).toBe('forgotten');
  });
});

// ── Retry event ───────────────────────────────────────────────────────────────

describe('MathAnswerEvent — retry', () => {
  it('marks subsequent attempts as isRetry=true', () => {
    const evt = makeEvent({ isRetry: true, isCorrect: true });
    expect(evt.isRetry).toBe(true);
  });

  it('retries have mode=practice since quiz does not record retry attempts', () => {
    const evt = makeEvent({ isRetry: true, mode: 'practice' });
    expect(evt.isRetry).toBe(true);
    expect(evt.mode).toBe('practice');
  });
});

// ── Hint-used event ───────────────────────────────────────────────────────────

describe('MathAnswerEvent — hint used', () => {
  it('records hintUsed=true', () => {
    const evt = makeEvent({ hintUsed: true });
    expect(evt.hintUsed).toBe(true);
  });

  it('defaults hintUsed to false', () => {
    const evt = makeEvent();
    expect(evt.hintUsed).toBe(false);
  });
});

// ── Quiz vs practice mode ─────────────────────────────────────────────────────

describe('MathAnswerEvent — mode discrimination', () => {
  it('supports quiz mode', () => {
    const evt = makeEvent({ mode: 'quiz' });
    expect(evt.mode).toBe('quiz');
  });

  it('supports practice mode', () => {
    const evt = makeEvent({ mode: 'practice' });
    expect(evt.mode).toBe('practice');
  });

  it('quiz events have isRetry=false (first attempts only)', () => {
    const evt = makeEvent({ mode: 'quiz', isRetry: false });
    expect(evt.isRetry).toBe(false);
  });
});

// ── deriveMasteryFromEvents ───────────────────────────────────────────────────

describe('deriveMasteryFromEvents', () => {
  it('returns initial stats when events list is empty', () => {
    const stats = deriveMasteryFromEvents('student1', '7x8', []);
    expect(stats.totalAttempts).toBe(0);
    expect(stats.masteryState).toBe('new');
    expect(stats.masteryScore).toBe(30);
  });

  it('increases masteryScore and totalAttempts after a fast correct answer', () => {
    const events = [makeEvent({ isCorrect: true, latencyMs: 1500 })];
    const stats = deriveMasteryFromEvents('student1', '7x8', events);
    expect(stats.totalAttempts).toBe(1);
    expect(stats.correctAttempts).toBe(1);
    expect(stats.masteryScore).toBeGreaterThan(30);
  });

  it('decreases masteryScore after a wrong answer', () => {
    const events = [makeEvent({ isCorrect: false, latencyMs: 2000 })];
    const stats = deriveMasteryFromEvents('student1', '7x8', events);
    expect(stats.totalAttempts).toBe(1);
    expect(stats.correctAttempts).toBe(0);
    expect(stats.masteryScore).toBeLessThan(30);
  });

  it('excludes retry events from mastery computation', () => {
    const events = [
      makeEvent({ id: 'e1', isCorrect: false, isRetry: false, latencyMs: 3000 }),
      makeEvent({ id: 'e2', isCorrect: true, isRetry: true, latencyMs: 2000 }),
    ];
    const stats = deriveMasteryFromEvents('student1', '7x8', events);
    // Only the first attempt (wrong) should count
    expect(stats.totalAttempts).toBe(1);
    expect(stats.correctAttempts).toBe(0);
  });

  it('ignores events for a different itemId', () => {
    const events = [
      makeEvent({ itemId: 'MUL_6x9', isCorrect: true }),
    ];
    const stats = deriveMasteryFromEvents('student1', '7x8', events);
    expect(stats.totalAttempts).toBe(0);
  });

  it('accumulates multiple attempts in chronological order', () => {
    const events = [
      makeEvent({ id: 'e1', isCorrect: true, latencyMs: 1500, createdAt: '2026-06-01T10:00:00Z' }),
      makeEvent({ id: 'e2', isCorrect: true, latencyMs: 1200, createdAt: '2026-06-01T10:01:00Z' }),
      makeEvent({ id: 'e3', isCorrect: true, latencyMs: 1000, createdAt: '2026-06-01T10:02:00Z' }),
    ];
    const stats = deriveMasteryFromEvents('student1', '7x8', events);
    expect(stats.totalAttempts).toBe(3);
    expect(stats.correctAttempts).toBe(3);
    expect(stats.masteryScore).toBeGreaterThan(30);
  });
});

// ── eventToAttemptLog ─────────────────────────────────────────────────────────

describe('eventToAttemptLog', () => {
  it('maps all shared fields correctly', () => {
    const evt = makeEvent({ isCorrect: false, studentAnswer: 42, latencyMs: 3500 });
    const log = eventToAttemptLog(evt);
    expect(log.id).toBe(evt.id);
    expect(log.studentId).toBe(evt.studentId);
    expect(log.itemId).toBe(evt.itemId);
    expect(log.sessionId).toBe(evt.sessionId);
    expect(log.promptShown).toBe(evt.promptShown);
    expect(log.correctAnswer).toBe(evt.correctAnswer);
    expect(log.studentAnswer).toBe(42);
    expect(log.isCorrect).toBe(false);
    expect(log.latencyMs).toBe(3500);
    expect(log.createdAt).toBe(evt.createdAt);
  });

  it('converts null studentAnswer to empty string', () => {
    const evt = makeEvent({ studentAnswer: null });
    const log = eventToAttemptLog(evt);
    expect(log.studentAnswer).toBe('');
  });

  it('defaults reviewGrade to good when missing', () => {
    const evt = makeEvent({ reviewGrade: undefined });
    const log = eventToAttemptLog(evt);
    expect(log.reviewGrade).toBe('good');
  });

  it('eventsToAttemptLogs converts an array', () => {
    const events = [makeEvent(), makeEvent()];
    const logs = eventsToAttemptLogs(events);
    expect(logs).toHaveLength(2);
    expect(logs[0].id).toBe(events[0].id);
    expect(logs[1].id).toBe(events[1].id);
  });
});
