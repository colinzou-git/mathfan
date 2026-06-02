import { db } from './dexie';
import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession } from '../types/math';
import type { MathAnswerEvent } from '../features/learning/learningEvents';

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
