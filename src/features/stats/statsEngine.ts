import type {
  AttemptLog, PracticeSession, DayStats, PeriodStats, PeriodComparison, PerTableStats,
  FactWindowStats, FactGrowth, GrowthSummary, GrowthDirection,
} from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { tableFromItemId } from '../curriculum/multiplicationItems';
import { itemPrompt } from '../curriculum/describeItem';

// ── MathAnswerEvent adapters ──────────────────────────────────────────────────

/** Convert a MathAnswerEvent to an AttemptLog for use with the existing statsEngine functions. */
export function eventToAttemptLog(event: MathAnswerEvent): AttemptLog {
  return {
    id: event.id,
    studentId: event.studentId,
    itemId: event.itemId,
    skillId: '',  // not tracked in events; not used by any statsEngine function
    sessionId: event.sessionId,
    promptShown: event.promptShown,
    correctAnswer: event.correctAnswer,
    studentAnswer: event.studentAnswer ?? '',
    isCorrect: event.isCorrect,
    latencyMs: event.latencyMs,
    reviewGrade: event.reviewGrade ?? 'good',
    createdAt: event.createdAt,
  };
}

export function eventsToAttemptLogs(events: MathAnswerEvent[]): AttemptLog[] {
  return events.map(eventToAttemptLog);
}

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

// ── Growth comparison (period over period) ─────────────────────────────────────

/** Per-fact stats for attempts within a single window. */
function factWindowStats(attempts: AttemptLog[]): Map<string, FactWindowStats> {
  const byItem = new Map<string, { attempts: number; correct: number; latencies: number[] }>();
  for (const a of attempts) {
    const e = byItem.get(a.itemId) ?? { attempts: 0, correct: 0, latencies: [] };
    e.attempts++;
    if (a.isCorrect) { e.correct++; e.latencies.push(a.latencyMs); }
    byItem.set(a.itemId, e);
  }
  const out = new Map<string, FactWindowStats>();
  for (const [id, e] of byItem) {
    out.set(id, {
      attempts: e.attempts,
      correct: e.correct,
      accuracy: e.attempts ? e.correct / e.attempts : 0,
      avgCorrectLatencyMs: e.latencies.length
        ? Math.round(e.latencies.reduce((s, v) => s + v, 0) / e.latencies.length)
        : 0,
    });
  }
  return out;
}

// Thresholds for calling a fact "stronger" or "weaker".
const ACC_EPSILON = 0.05;      // 5 percentage points
const SPEED_EPSILON_MS = 400;  // 0.4s

function classifyGrowth(cur: FactWindowStats, prev: FactWindowStats): GrowthDirection {
  const accDelta = cur.accuracy - prev.accuracy;
  if (accDelta > ACC_EPSILON) return 'stronger';
  if (accDelta < -ACC_EPSILON) return 'weaker';

  // Accuracy roughly equal → use speed as tiebreaker (only if both have correct answers)
  if (cur.avgCorrectLatencyMs > 0 && prev.avgCorrectLatencyMs > 0) {
    const speedDelta = prev.avgCorrectLatencyMs - cur.avgCorrectLatencyMs; // positive = faster now
    if (speedDelta > SPEED_EPSILON_MS) return 'stronger';
    if (speedDelta < -SPEED_EPSILON_MS) return 'weaker';
  }
  return 'same';
}

/**
 * Compare each fact's performance in the current window vs the previous window.
 * Facts practiced in the current window but not the previous are "new".
 * Facts not practiced in the current window are omitted entirely.
 */
export function computeFactGrowth(
  attempts: AttemptLog[],
  currentStart: Date,
  currentEnd: Date,
  previousStart: Date,
  previousEnd: Date
): GrowthSummary {
  const curStats = factWindowStats(filterAttempts(attempts, currentStart, currentEnd));
  const prevStats = factWindowStats(filterAttempts(attempts, previousStart, previousEnd));

  const summary: GrowthSummary = { stronger: [], weaker: [], same: [], newFacts: [] };

  for (const [itemId, cur] of curStats) {
    const prompt = itemPrompt(itemId);
    const prev = prevStats.get(itemId) ?? null;

    if (!prev) {
      summary.newFacts.push({
        itemId, prompt, direction: 'new',
        current: cur, previous: null, accuracyDelta: 0, speedDeltaMs: 0,
      });
      continue;
    }

    const direction = classifyGrowth(cur, prev);
    const growth: FactGrowth = {
      itemId, prompt, direction,
      current: cur, previous: prev,
      accuracyDelta: cur.accuracy - prev.accuracy,
      speedDeltaMs: (prev.avgCorrectLatencyMs && cur.avgCorrectLatencyMs)
        ? prev.avgCorrectLatencyMs - cur.avgCorrectLatencyMs
        : 0,
    };
    if (direction === 'stronger') summary.stronger.push(growth);
    else if (direction === 'weaker') summary.weaker.push(growth);
    else summary.same.push(growth);
  }

  // Sort: biggest improvements / regressions first
  summary.stronger.sort((a, b) => b.accuracyDelta - a.accuracyDelta || b.speedDeltaMs - a.speedDeltaMs);
  summary.weaker.sort((a, b) => a.accuracyDelta - b.accuracyDelta || a.speedDeltaMs - b.speedDeltaMs);

  return summary;
}

export type GrowthPeriod = 'day' | 'week' | 'month';

/** Returns [currentStart, currentEnd, previousStart, previousEnd] for a comparison period. */
export function growthWindows(period: GrowthPeriod, now = new Date()): [Date, Date, Date, Date] {
  if (period === 'day') {
    const curStart = startOfLocalDay(now);
    const curEnd = addDays(curStart, 1);
    const prevStart = addDays(curStart, -1);
    return [curStart, curEnd, prevStart, curStart];
  }
  if (period === 'week') {
    const curStart = startOfWeek(now);
    const curEnd = addDays(curStart, 7);
    const prevStart = addDays(curStart, -7);
    return [curStart, curEnd, prevStart, curStart];
  }
  // month
  const curStart = startOfMonth(now);
  const curEnd = startOfMonth(addDays(curStart, 32));
  const prevStart = startOfMonth(addDays(curStart, -1));
  return [curStart, curEnd, prevStart, curStart];
}
