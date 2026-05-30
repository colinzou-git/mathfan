import { describe, it, expect } from 'vitest';
import {
  computeDayStats, computeDailyHistory,
  computePeriodStats, computePeriodComparison,
  computePerTableStats, computeStreak,
  factTrend, localDateStr, startOfWeek, startOfMonth, addDays,
} from '../features/stats/statsEngine';
import type { AttemptLog, PracticeSession } from '../types/math';

// ── Helpers ───────────────────────────────────────────────────────────────────

function attempt(overrides: Partial<AttemptLog> & { createdAt: string }): AttemptLog {
  return {
    id: Math.random().toString(36),
    studentId: 's1',
    itemId: 'MUL_7x8',
    skillId: 'SKILL_MUL_FACTS',
    sessionId: 'sess1',
    promptShown: '7 × 8',
    correctAnswer: 56,
    studentAnswer: 56,
    isCorrect: true,
    latencyMs: 2000,
    reviewGrade: 'good',
    ...overrides,
  };
}

function session(overrides: Partial<PracticeSession> & { startedAt: string }): PracticeSession {
  const { startedAt, ...rest } = overrides;
  return {
    id: Math.random().toString(36),
    studentId: 's1',
    mode: 'daily_review',
    startedAt,
    plannedQuestionCount: 20,
    completedQuestionCount: 10,
    correctCount: 8,
    averageLatencyMs: 2000,
    ...rest,
  };
}

const NOW = new Date('2026-06-10T15:00:00Z');
const TODAY = '2026-06-10';
const YESTERDAY = '2026-06-09';

// ── localDateStr ──────────────────────────────────────────────────────────────

describe('localDateStr', () => {
  it('extracts YYYY-MM-DD from ISO string', () => {
    // We cannot assert a specific date since it depends on local TZ, but format is stable
    const result = localDateStr('2026-06-10T12:00:00Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── addDays ───────────────────────────────────────────────────────────────────

describe('addDays', () => {
  it('adds positive days', () => {
    const d = new Date('2026-06-01T00:00:00Z');
    expect(addDays(d, 7).toISOString().slice(0, 10)).toBe('2026-06-08');
  });
  it('subtracts negative days', () => {
    const d = new Date('2026-06-10T00:00:00Z');
    expect(addDays(d, -3).toISOString().slice(0, 10)).toBe('2026-06-07');
  });
});

// ── computeDayStats ───────────────────────────────────────────────────────────

describe('computeDayStats', () => {
  const todayAttempts = [
    attempt({ createdAt: `${TODAY}T10:00:00.000Z`, latencyMs: 1000 }),
    attempt({ createdAt: `${TODAY}T10:01:00.000Z`, latencyMs: 3000, isCorrect: false, reviewGrade: 'again' }),
    attempt({ createdAt: `${TODAY}T10:02:00.000Z`, latencyMs: 2000 }),
  ];
  const todaySessions = [
    session({ startedAt: `${TODAY}T10:00:00.000Z`, endedAt: `${TODAY}T10:05:00.000Z` }),
  ];

  it('counts questionsAnswered correctly', () => {
    const s = computeDayStats(new Date(`${TODAY}T12:00:00Z`), todayAttempts, todaySessions);
    expect(s.questionsAnswered).toBe(3);
  });

  it('counts correctCount', () => {
    const s = computeDayStats(new Date(`${TODAY}T12:00:00Z`), todayAttempts, todaySessions);
    expect(s.correctCount).toBe(2);
  });

  it('computes accuracy', () => {
    const s = computeDayStats(new Date(`${TODAY}T12:00:00Z`), todayAttempts, todaySessions);
    expect(s.accuracy).toBeCloseTo(2 / 3, 5);
  });

  it('avg correct latency is mean of correct attempts only', () => {
    const s = computeDayStats(new Date(`${TODAY}T12:00:00Z`), todayAttempts, todaySessions);
    expect(s.averageCorrectLatencyMs).toBe(Math.round((1000 + 2000) / 2));
  });

  it('fastest correct is min latency among correct', () => {
    const s = computeDayStats(new Date(`${TODAY}T12:00:00Z`), todayAttempts, todaySessions);
    expect(s.fastestCorrectLatencyMs).toBe(1000);
  });

  it('excludes attempts from other days', () => {
    const mixed = [
      ...todayAttempts,
      attempt({ createdAt: `${YESTERDAY}T10:00:00.000Z` }),
    ];
    const s = computeDayStats(new Date(`${TODAY}T12:00:00Z`), mixed, []);
    expect(s.questionsAnswered).toBe(3);
  });

  it('returns zeros for a day with no attempts', () => {
    const s = computeDayStats(new Date(`${TODAY}T12:00:00Z`), [], []);
    expect(s.questionsAnswered).toBe(0);
    expect(s.accuracy).toBe(0);
    expect(s.averageCorrectLatencyMs).toBe(0);
  });
});

// ── computePeriodStats ────────────────────────────────────────────────────────

describe('computePeriodStats', () => {
  const attempts = [
    attempt({ createdAt: '2026-06-01T10:00:00.000Z', latencyMs: 2000 }),
    attempt({ createdAt: '2026-06-02T10:00:00.000Z', latencyMs: 4000, isCorrect: false, reviewGrade: 'again' }),
    attempt({ createdAt: '2026-06-03T10:00:00.000Z', latencyMs: 1500 }),
    attempt({ createdAt: '2026-05-30T10:00:00.000Z' }), // outside range
  ];
  const start = new Date('2026-06-01T00:00:00Z');
  const end = new Date('2026-06-04T00:00:00Z');

  it('counts only attempts in range', () => {
    const s = computePeriodStats(attempts, [], start, end);
    expect(s.questions).toBe(3);
  });

  it('correct count', () => {
    const s = computePeriodStats(attempts, [], start, end);
    expect(s.correct).toBe(2);
  });

  it('daysActive counts distinct active dates', () => {
    const s = computePeriodStats(attempts, [], start, end);
    expect(s.daysActive).toBe(3);
  });
});

// ── computePeriodComparison ───────────────────────────────────────────────────

describe('computePeriodComparison', () => {
  // NOW = 2026-06-10 (Wednesday)
  // thisWeek: Mon Jun 09 – (end of week)
  // lastWeek: Mon Jun 02 – Sun Jun 08
  const thisWeekAttempt = attempt({ createdAt: '2026-06-09T10:00:00.000Z' });
  const lastWeekAttempt = attempt({ createdAt: '2026-06-03T10:00:00.000Z' });

  it('thisWeek includes current week attempts', () => {
    const c = computePeriodComparison([thisWeekAttempt, lastWeekAttempt], [], NOW);
    expect(c.thisWeek.questions).toBeGreaterThanOrEqual(1);
  });

  it('lastWeek does not bleed into thisWeek', () => {
    const c = computePeriodComparison([lastWeekAttempt], [], NOW);
    expect(c.thisWeek.questions).toBe(0);
    expect(c.lastWeek.questions).toBe(1);
  });
});

// ── computeDailyHistory ───────────────────────────────────────────────────────

describe('computeDailyHistory', () => {
  it('returns exactly N entries', () => {
    const history = computeDailyHistory([], [], 7, NOW);
    expect(history.length).toBe(7);
  });

  it('last entry is today', () => {
    const history = computeDailyHistory([], [], 7, NOW);
    expect(history[6].date).toBe(localDateStr(NOW.toISOString()));
  });

  it('days are in ascending order', () => {
    const history = computeDailyHistory([], [], 5, NOW);
    for (let i = 1; i < history.length; i++) {
      expect(history[i].date > history[i - 1].date).toBe(true);
    }
  });
});

// ── computeStreak ─────────────────────────────────────────────────────────────

describe('computeStreak', () => {
  it('no attempts → streak 0', () => {
    expect(computeStreak([], NOW)).toBe(0);
  });

  it('attempts only today → streak 1', () => {
    const a = [attempt({ createdAt: `${TODAY}T10:00:00.000Z` })];
    expect(computeStreak(a, new Date(`${TODAY}T23:00:00Z`))).toBeGreaterThanOrEqual(1);
  });

  it('consecutive days → streak grows', () => {
    const attempts = [
      attempt({ createdAt: '2026-06-08T10:00:00.000Z' }),
      attempt({ createdAt: '2026-06-09T10:00:00.000Z' }),
      attempt({ createdAt: '2026-06-10T10:00:00.000Z' }),
    ];
    expect(computeStreak(attempts, new Date('2026-06-10T23:00:00Z'))).toBeGreaterThanOrEqual(3);
  });

  it('gap breaks the streak', () => {
    const attempts = [
      attempt({ createdAt: '2026-06-01T10:00:00.000Z' }),
      // gap on Jun 2
      attempt({ createdAt: '2026-06-03T10:00:00.000Z' }),
      attempt({ createdAt: '2026-06-10T10:00:00.000Z' }),
    ];
    // streak from today looking back: only today's day counts before the gap
    expect(computeStreak(attempts, new Date('2026-06-10T23:00:00Z'))).toBe(1);
  });
});

// ── computePerTableStats ──────────────────────────────────────────────────────

describe('computePerTableStats', () => {
  const tableAttempts = [
    attempt({ itemId: 'MUL_7x8', latencyMs: 1500, isCorrect: true, sessionId: 'sess1', createdAt: '2026-06-01T10:00:00.000Z' }),
    attempt({ itemId: 'MUL_7x9', latencyMs: 2000, isCorrect: true, sessionId: 'sess1', createdAt: '2026-06-01T10:01:00.000Z' }),
    attempt({ itemId: 'MUL_7x8', latencyMs: 3000, isCorrect: false, sessionId: 'sess1', createdAt: '2026-06-01T10:02:00.000Z' }),
    attempt({ itemId: 'MUL_8x9', latencyMs: 1000, isCorrect: true, sessionId: 'sess1', createdAt: '2026-06-01T10:03:00.000Z' }), // different table
  ];
  const sessions = [
    session({ id: 'sess1', startedAt: '2026-06-01T10:00:00.000Z', tables: [7] }),
  ];

  it('counts only attempts for that table', () => {
    const s = computePerTableStats(7, tableAttempts, sessions);
    expect(s.totalQuestions).toBe(3);
  });

  it('accuracy excludes other tables', () => {
    const s = computePerTableStats(7, tableAttempts, sessions);
    expect(s.accuracy).toBeCloseTo(2 / 3, 5);
  });

  it('totalSessions counts sessions with this table', () => {
    const s = computePerTableStats(7, tableAttempts, sessions);
    expect(s.totalSessions).toBe(1);
  });

  it('table with no data returns nulls', () => {
    const s = computePerTableStats(13, [], []);
    expect(s.totalQuestions).toBe(0);
    expect(s.bestAverageLatencyMs).toBeNull();
    expect(s.recentAverageLatencyMs).toBeNull();
  });
});

// ── factTrend ─────────────────────────────────────────────────────────────────

describe('factTrend', () => {
  it('returns same when insufficient data', () => {
    expect(factTrend('MUL_7x8', [], NOW)).toBe('same');
  });

  it('returns up when recent latency is much lower than older', () => {
    const recent = Array.from({ length: 3 }, (_, i) =>
      attempt({ itemId: 'MUL_7x8', latencyMs: 800, createdAt: `2026-06-0${8 + i}T10:00:00.000Z` })
    );
    const older = Array.from({ length: 3 }, (_, i) =>
      attempt({ itemId: 'MUL_7x8', latencyMs: 3000, createdAt: `2026-06-0${1 + i}T10:00:00.000Z` })
    );
    expect(factTrend('MUL_7x8', [...recent, ...older], new Date('2026-06-10T12:00:00Z'))).toBe('up');
  });

  it('returns down when recent latency is much higher than older', () => {
    const recent = Array.from({ length: 3 }, (_, i) =>
      attempt({ itemId: 'MUL_7x8', latencyMs: 5000, createdAt: `2026-06-0${8 + i}T10:00:00.000Z` })
    );
    const older = Array.from({ length: 3 }, (_, i) =>
      attempt({ itemId: 'MUL_7x8', latencyMs: 1000, createdAt: `2026-06-0${1 + i}T10:00:00.000Z` })
    );
    expect(factTrend('MUL_7x8', [...recent, ...older], new Date('2026-06-10T12:00:00Z'))).toBe('down');
  });
});

// ── startOfWeek / startOfMonth ────────────────────────────────────────────────

describe('startOfWeek', () => {
  it('Wednesday → Monday of same week', () => {
    // 2026-06-10 is a Wednesday; Mon = 2026-06-08
    const d = startOfWeek(new Date('2026-06-10T12:00:00Z'));
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-08');
  });
  it('Monday → same day', () => {
    const d = startOfWeek(new Date('2026-06-08T12:00:00Z'));
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-08');
  });
});

describe('startOfMonth', () => {
  it('returns the 1st of the month', () => {
    const d = startOfMonth(new Date('2026-06-10T12:00:00Z'));
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(5); // June = 5
  });
});
