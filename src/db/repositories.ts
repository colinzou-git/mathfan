import { db } from './dexie';
import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession } from '../types/math';

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
