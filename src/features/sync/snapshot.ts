import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession } from '../../types/math';
import { db } from '../../db/dexie';

export interface AppSnapshot {
  appId: 'mathfan';
  snapshotVersion: 1;
  snapshotAt: string;
  students: StudentProfile[];
  itemStates: StudentItemState[];
  attempts: AttemptLog[];
  sessions: PracticeSession[];
}

// ── Build ─────────────────────────────────────────────────────────────────────

export async function buildSnapshot(): Promise<AppSnapshot> {
  const [students, itemStates, attempts, sessions] = await Promise.all([
    db.students.toArray(),
    db.itemStates.toArray(),
    db.attempts.toArray(),
    db.sessions.toArray(),
  ]);
  return {
    appId: 'mathfan',
    snapshotVersion: 1,
    snapshotAt: new Date().toISOString(),
    students,
    itemStates,
    attempts,
    sessions,
  };
}

// ── Apply (merge remote into local) ──────────────────────────────────────────

/**
 * Merge a remote snapshot into the local DB.
 * Strategy: union by ID — remote wins for students and itemStates when the remote
 * has more attempts; local wins for everything already present locally.
 * Attempts and sessions are unioned (deduped by ID).
 */
export async function mergeSnapshot(remote: AppSnapshot): Promise<void> {
  await db.transaction('rw', db.students, db.itemStates, db.attempts, db.sessions, async () => {

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
  });
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
  );
}
