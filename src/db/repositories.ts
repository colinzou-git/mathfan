import { db } from './dexie';
import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession } from '../types/math';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { QuizSession, MultiplicationFactStats, MultiplicationFactKey } from '../features/multiplication/types';

export const studentRepo = {
  async getAll(): Promise<StudentProfile[]> {
    return db.students.toArray();
  },
  async get(id: string): Promise<StudentProfile | undefined> {
    return db.students.get(id);
  },
  async save(profile: StudentProfile): Promise<void> {
    await db.students.put(profile);
  },
  async delete(id: string): Promise<void> {
    await db.students.delete(id);
  },
};

/**
 * DERIVED CACHE — do not treat as source of truth.
 * These records are computed from mathAnswerEvents (practice mode) via applyReview.
 * They are kept for scheduling speed (FSRS next-due lookups) and legacy UI.
 * Ground truth: db.mathAnswerEvents where mode='practice'.
 * Use rebuildItemStatesFromEvents() to regenerate.
 */
export const itemStateRepo = {
  async get(studentId: string, itemId: string): Promise<StudentItemState | undefined> {
    return db.itemStates.get([studentId, itemId]);
  },
  async getForStudent(studentId: string): Promise<StudentItemState[]> {
    return db.itemStates.where('studentId').equals(studentId).toArray();
  },
  async getDue(studentId: string, now: string): Promise<StudentItemState[]> {
    return db.itemStates
      .where('studentId').equals(studentId)
      .and(s => !s.nextDueAt || s.nextDueAt <= now)
      .toArray();
  },
  async save(state: StudentItemState): Promise<void> {
    await db.itemStates.put(state);
  },
};

/**
 * COMPATIBILITY LAYER — do not treat as source of truth.
 * These records duplicate data from mathAnswerEvents for backward compatibility.
 * New reads should prefer mathAnswerEventRepo.
 * Ground truth: db.mathAnswerEvents.
 */
export const attemptRepo = {
  async save(attempt: AttemptLog): Promise<void> {
    await db.attempts.put(attempt);
  },
  async getAll(studentId: string): Promise<AttemptLog[]> {
    return db.attempts.where('studentId').equals(studentId).toArray();
  },
  async getForDateRange(studentId: string, start: Date, end: Date): Promise<AttemptLog[]> {
    return db.attempts
      .where('[studentId+createdAt]')
      .between([studentId, start.toISOString()], [studentId, end.toISOString()])
      .toArray();
  },
  async getForSession(sessionId: string): Promise<AttemptLog[]> {
    return db.attempts.where('sessionId').equals(sessionId).toArray();
  },
  async getRecent(studentId: string, limit = 50): Promise<AttemptLog[]> {
    return db.attempts
      .where('studentId').equals(studentId)
      .reverse()
      .limit(limit)
      .toArray();
  },
};

/** Canonical answer-attempt log. All stats and mastery can be recomputed from these records. */
export const mathAnswerEventRepo = {
  async save(event: MathAnswerEvent): Promise<void> {
    await db.mathAnswerEvents.put(event);
  },
  async bulkSave(events: MathAnswerEvent[]): Promise<void> {
    await db.mathAnswerEvents.bulkPut(events);
  },
  async getAll(studentId: string): Promise<MathAnswerEvent[]> {
    return db.mathAnswerEvents.where('studentId').equals(studentId).toArray();
  },
  async getForDateRange(studentId: string, start: Date, end: Date): Promise<MathAnswerEvent[]> {
    return db.mathAnswerEvents
      .where('[studentId+createdAt]')
      .between([studentId, start.toISOString()], [studentId, end.toISOString()])
      .toArray();
  },
  async getForSession(sessionId: string): Promise<MathAnswerEvent[]> {
    return db.mathAnswerEvents.where('sessionId').equals(sessionId).toArray();
  },
  async getForItem(studentId: string, itemId: string): Promise<MathAnswerEvent[]> {
    return db.mathAnswerEvents
      .where('studentId').equals(studentId)
      .and(e => e.itemId === itemId)
      .toArray();
  },
  /** Returns only first-attempt events (isRetry=false) — excludes retries. */
  async getFirstAttempts(studentId: string): Promise<MathAnswerEvent[]> {
    return db.mathAnswerEvents
      .where('studentId').equals(studentId)
      .and(e => !e.isRetry)
      .toArray();
  },
};

// ── Quiz stats ────────────────────────────────────────────────────────────────

function deriveSessionsFromEvents(studentId: string, events: MathAnswerEvent[]): QuizSession[] {
  const firstAttempts = events.filter(e => e.mode === 'quiz' && !e.isRetry);
  const bySession = new Map<string, MathAnswerEvent[]>();
  for (const e of firstAttempts) {
    const arr = bySession.get(e.sessionId) ?? [];
    arr.push(e);
    bySession.set(e.sessionId, arr);
  }
  const sessions: QuizSession[] = [];
  for (const [sessionId, evts] of bySession) {
    evts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const correct = evts.filter(e => e.isCorrect).length;
    const toKey = (e: MathAnswerEvent): MultiplicationFactKey | null =>
      e.itemId.startsWith('MUL_') ? e.itemId.slice(4) as MultiplicationFactKey : null;
    const weakFacts = evts.filter(e => e.factStatusAfter === 'weak').map(toKey).filter((k): k is MultiplicationFactKey => k !== null);
    const forgottenFacts = evts.filter(e => e.factStatusAfter === 'forgotten').map(toKey).filter((k): k is MultiplicationFactKey => k !== null);
    sessions.push({
      id: sessionId,
      studentId,
      category: 'multiplication',
      quizLength: evts.length,
      startedAt: evts[0].createdAt,
      completedAt: evts[evts.length - 1].createdAt,
      answerLogs: [],
      correctCount: correct,
      incorrectCount: evts.length - correct,
      accuracy: evts.length > 0 ? correct / evts.length : 0,
      averageResponseTimeMs: evts.length > 0 ? Math.round(evts.reduce((s, e) => s + e.latencyMs, 0) / evts.length) : null,
      weakFactsDiscovered: weakFacts,
      strongFactsConfirmed: [],
      forgottenFactsDiscovered: forgottenFacts,
      untestedFactsCovered: [],
      recommendedPracticeFacts: [...new Set([...forgottenFacts, ...weakFacts])],
    });
  }
  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * DERIVED CACHE — do not treat as source of truth.
 * quizSessions and multFactStats are cached views written at quiz-end.
 * Ground truth: db.mathAnswerEvents (mode='quiz').
 * getSessions falls back to event-derived sessions if the cache is absent.
 */
export const quizStatsRepo = {
  async getSessions(studentId: string): Promise<QuizSession[]> {
    const cached = await db.quizSessions.where('studentId').equals(studentId).toArray();
    if (cached.length > 0) return cached.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const events = await db.mathAnswerEvents.where('studentId').equals(studentId).toArray();
    return deriveSessionsFromEvents(studentId, events);
  },

  async getStatsMap(studentId: string): Promise<Map<MultiplicationFactKey, MultiplicationFactStats>> {
    const stats = await db.multFactStats.where('studentId').equals(studentId).toArray();
    return new Map(stats.map(s => [s.key as MultiplicationFactKey, s]));
  },
};

export const sessionRepo = {
  async save(session: PracticeSession): Promise<void> {
    await db.sessions.put(session);
  },
  async get(id: string): Promise<PracticeSession | undefined> {
    return db.sessions.get(id);
  },
  async getAll(studentId: string): Promise<PracticeSession[]> {
    return db.sessions.where('studentId').equals(studentId).toArray();
  },
  async getRecent(studentId: string, limit = 10): Promise<PracticeSession[]> {
    return db.sessions
      .where('studentId').equals(studentId)
      .reverse()
      .limit(limit)
      .toArray();
  },
  async getLastByMode(studentId: string, mode: string): Promise<PracticeSession | undefined> {
    const all = await db.sessions
      .where('studentId').equals(studentId)
      .and(s => s.mode === mode)
      .toArray();
    return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  },
  /** Delete sessions with zero completed questions (left over from abandoned starts). */
  async deleteEmpty(studentId: string): Promise<number> {
    const empties = await db.sessions
      .where('studentId').equals(studentId)
      .and(s => s.completedQuestionCount === 0)
      .toArray();
    await db.sessions.bulkDelete(empties.map(s => s.id));
    return empties.length;
  },
};
