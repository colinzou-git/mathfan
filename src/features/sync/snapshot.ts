import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession } from '../../types/math';
import type { MultiplicationFactStats, QuizSession } from '../multiplication/types';
import { db } from '../../db/dexie';

export interface AppSnapshot {
  appId: 'mathfan';
  snapshotVersion: 1;
  snapshotAt: string;
  students: StudentProfile[];
  itemStates: StudentItemState[];
  attempts: AttemptLog[];
  sessions: PracticeSession[];
  // Added in quiz feature — absent in older snapshots; treat missing as []
  multFactStats?: MultiplicationFactStats[];
  quizSessions?: QuizSession[];
}

// ── Build ─────────────────────────────────────────────────────────────────────

export async function buildSnapshot(): Promise<AppSnapshot> {
  const [students, itemStates, attempts, sessions, multFactStats, quizSessions] = await Promise.all([
    db.students.toArray(),
    db.itemStates.toArray(),
    db.attempts.toArray(),
    db.sessions.toArray(),
    db.multFactStats.toArray(),
    db.quizSessions.toArray(),
  ]);
  return {
    appId: 'mathfan',
    snapshotVersion: 1,
    snapshotAt: new Date().toISOString(),
    students,
    itemStates,
    attempts,
    sessions,
    multFactStats,
    quizSessions,
  };
}

// ── Apply (merge remote into local) ──────────────────────────────────────────

/**
 * Merge a remote snapshot into the local DB.
 * Strategy: union by ID — remote wins for students and itemStates when the remote
 * has more attempts; local wins for everything already present locally.
 * Attempts and sessions are unioned (deduped by ID).
 * MultFactStats: take the one with more totalAttempts (further along).
 * QuizSessions: union by ID.
 */
export async function mergeSnapshot(remote: AppSnapshot): Promise<void> {
  await db.transaction(
    'rw',
    [db.students, db.itemStates, db.attempts, db.sessions, db.multFactStats, db.quizSessions],
    async () => {

      // Students: upsert all remote students (don't delete local-only ones)
      for (const s of remote.students) {
        await db.students.put(s);
      }

      // ItemStates: take the one with more attemptCount (further along)
      for (const remoteState of remote.itemStates) {
        const localState = await db.itemStates.get([remoteState.studentId, remoteState.itemId]);
        if (!localState || remoteState.attemptCount > localState.attemptCount) {
          await db.itemStates.put(remoteState);
        }
      }

      // Attempts: union by ID (put is upsert — no-op if already exists with same id)
      await db.attempts.bulkPut(remote.attempts);

      // Sessions: union by ID
      await db.sessions.bulkPut(remote.sessions);

      // MultFactStats: take whichever has more totalAttempts
      for (const remoteStats of remote.multFactStats ?? []) {
        const localStats = await db.multFactStats.get([remoteStats.studentId, remoteStats.key]);
        if (!localStats || remoteStats.totalAttempts > localStats.totalAttempts) {
          await db.multFactStats.put(remoteStats);
        }
      }

      // QuizSessions: union by ID
      if (remote.quizSessions?.length) {
        await db.quizSessions.bulkPut(remote.quizSessions);
      }
    }
  );
}

export function validateSnapshot(raw: unknown): raw is AppSnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as Record<string, unknown>;
  return (
    s.appId === 'mathfan' &&
    s.snapshotVersion === 1 &&
    Array.isArray(s.students) &&
    Array.isArray(s.itemStates) &&
    Array.isArray(s.attempts) &&
    Array.isArray(s.sessions)
    // multFactStats and quizSessions are optional (absent in pre-quiz snapshots)
  );
}
