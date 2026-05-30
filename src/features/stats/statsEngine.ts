import type { AttemptLog, PracticeSession, DayStats, PeriodStats, PeriodComparison, PerTableStats } from '../../types/math';
import { tableFromItemId } from '../curriculum/multiplicationItems';

// ── Date helpers ──────────────────────────────────────────────────────────────

export function localDateStr(iso: string): string {
  // Returns "YYYY-MM-DD" in local time from an ISO timestamp.
  return new Date(iso).toLocaleDateString('en-CA'); // en-CA uses YYYY-MM-DD
}

export function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Monday of the calendar week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = startOfLocalDay(date);
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

/** First day of the calendar month containing `date`. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// ── Core stat builders ────────────────────────────────────────────────────────

function filterAttempts(
  attempts: AttemptLog[],
  start: Date,
  end: Date
): AttemptLog[] {
  const startStr = start.toISOString();
  const endStr = end.toISOString();
  return attempts.filter(a => a.createdAt >= startStr && a.createdAt < endStr);
}

function sessionMinutes(sessions: PracticeSession[]): number {
  let total = 0;
  for (const s of sessions) {
    if (s.endedAt) {
      total += (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000;
    }
  }
  return Math.round(total);
}

export function computePeriodStats(
  attempts: AttemptLog[],
  sessions: PracticeSession[],
  start: Date,
  end: Date
): PeriodStats {
  const slice = filterAttempts(attempts, start, end);
  const sessionSlice = sessions.filter(
    s => s.startedAt >= start.toISOString() && s.startedAt < end.toISOString()
  );

  const correct = slice.filter(a => a.isCorrect);
  const correctLatencies = correct.map(a => a.latencyMs);
  const avgCorrectMs = correctLatencies.length
    ? Math.round(correctLatencies.reduce((s, v) => s + v, 0) / correctLatencies.length)
    : 0;

  const activeDates = new Set(slice.map(a => localDateStr(a.createdAt)));

  return {
    questions: slice.length,
    correct: correct.length,
    accuracy: slice.length ? correct.length / slice.length : 0,
    minutesPracticed: sessionMinutes(sessionSlice),
    daysActive: activeDates.size,
    averageCorrectLatencyMs: avgCorrectMs,
  };
}

// ── Day stats ─────────────────────────────────────────────────────────────────

export function computeDayStats(
  date: Date,
  attempts: AttemptLog[],
  sessions: PracticeSession[]
): DayStats {
  const start = startOfLocalDay(date);
  const end = addDays(start, 1);
  const slice = filterAttempts(attempts, start, end);
  const sessionSlice = sessions.filter(
    s => s.startedAt >= start.toISOString() && s.startedAt < end.toISOString()
  );

  const correct = slice.filter(a => a.isCorrect);
  const correctLatencies = correct.map(a => a.latencyMs);
  const avgCorrectMs = correctLatencies.length
    ? Math.round(correctLatencies.reduce((s, v) => s + v, 0) / correctLatencies.length)
    : 0;
  const fastestMs = correctLatencies.length ? Math.min(...correctLatencies) : 0;

  return {
    date: localDateStr(date.toISOString()),
    questionsAnswered: slice.length,
    correctCount: correct.length,
    accuracy: slice.length ? correct.length / slice.length : 0,
    sessionCount: sessionSlice.length,
    minutesPracticed: sessionMinutes(sessionSlice),
    averageCorrectLatencyMs: avgCorrectMs,
    fastestCorrectLatencyMs: fastestMs,
  };
}

export function computeTodayStats(
  attempts: AttemptLog[],
  sessions: PracticeSession[],
  now = new Date()
): DayStats {
  return computeDayStats(now, attempts, sessions);
}

/** Returns daily stats for the past `days` days (today at index [days-1]). */
export function computeDailyHistory(
  attempts: AttemptLog[],
  sessions: PracticeSession[],
  days: number,
  now = new Date()
): DayStats[] {
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(startOfLocalDay(now), i - (days - 1));
    return computeDayStats(d, attempts, sessions);
  });
}

// ── Period comparison ─────────────────────────────────────────────────────────

export function computePeriodComparison(
  attempts: AttemptLog[],
  sessions: PracticeSession[],
  now = new Date()
): PeriodComparison {
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(addDays(thisMonthStart, -1));
  const nextWeekStart = addDays(thisWeekStart, 7);
  const nextMonthStart = startOfMonth(addDays(thisMonthStart, 32));

  return {
    thisWeek: computePeriodStats(attempts, sessions, thisWeekStart, nextWeekStart),
    lastWeek: computePeriodStats(attempts, sessions, lastWeekStart, thisWeekStart),
    thisMonth: computePeriodStats(attempts, sessions, thisMonthStart, nextMonthStart),
    lastMonth: computePeriodStats(attempts, sessions, lastMonthStart, thisMonthStart),
  };
}

// ── Per-table stats ───────────────────────────────────────────────────────────

export function computePerTableStats(
  table: number,
  attempts: AttemptLog[],
  sessions: PracticeSession[]
): PerTableStats {
  const tableAttempts = attempts.filter(a => tableFromItemId(a.itemId) === table);
  const tableSessions = sessions.filter(s => s.tables?.includes(table));

  const correct = tableAttempts.filter(a => a.isCorrect);
  const accuracy = tableAttempts.length ? correct.length / tableAttempts.length : 0;

  // Per-session average correct latency (for sparkline)
  const sessionSpeeds: number[] = [];
  for (const s of tableSessions.slice(-10)) {
    const sessionCorrect = tableAttempts.filter(a => a.sessionId === s.id && a.isCorrect);
    if (sessionCorrect.length > 0) {
      const avg = sessionCorrect.reduce((sum, a) => sum + a.latencyMs, 0) / sessionCorrect.length;
      sessionSpeeds.push(Math.round(avg));
    }
  }

  const bestAvg = sessionSpeeds.length ? Math.min(...sessionSpeeds) : null;
  const recentAvg = sessionSpeeds.length ? sessionSpeeds[sessionSpeeds.length - 1] : null;

  return {
    table,
    totalSessions: tableSessions.length,
    totalQuestions: tableAttempts.length,
    accuracy,
    bestAverageLatencyMs: bestAvg,
    recentAverageLatencyMs: recentAvg,
    recentSessionSpeeds: sessionSpeeds,
  };
}

// ── Streak ────────────────────────────────────────────────────────────────────

/** Count of consecutive days (ending today) on which at least one question was answered. */
export function computeStreak(attempts: AttemptLog[], now = new Date()): number {
  const activeDates = new Set(attempts.map(a => localDateStr(a.createdAt)));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = addDays(startOfLocalDay(now), -i);
    if (activeDates.has(localDateStr(d.toISOString()))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ── Improvement indicators ───────────────────────────────────────────────────

export type Trend = 'up' | 'same' | 'down';

/**
 * Compare a fact's median latency from attempts in the past 7 days vs the 7 days before that.
 * 'up' = getting faster (latency decreased), 'down' = getting slower.
 */
export function factTrend(
  itemId: string,
  attempts: AttemptLog[],
  now = new Date()
): Trend {
  const thisWeekStart = addDays(startOfLocalDay(now), -7);
  const lastWeekStart = addDays(thisWeekStart, -7);

  const factAttempts = attempts.filter(a => a.itemId === itemId && a.isCorrect);
  const recent = factAttempts.filter(a => a.createdAt >= thisWeekStart.toISOString());
  const older = factAttempts.filter(
    a => a.createdAt >= lastWeekStart.toISOString() && a.createdAt < thisWeekStart.toISOString()
  );

  if (recent.length < 2 || older.length < 2) return 'same';

  const avgRecent = recent.reduce((s, a) => s + a.latencyMs, 0) / recent.length;
  const avgOlder = older.reduce((s, a) => s + a.latencyMs, 0) / older.length;
  const delta = (avgOlder - avgRecent) / avgOlder;

  if (delta > 0.1) return 'up';
  if (delta < -0.1) return 'down';
  return 'same';
}
