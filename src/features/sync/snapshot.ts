import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession } from '../../types/math';
import type { MultiplicationFactStats, QuizSession } from '../multiplication/types';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { rebuildMultFactStatsFromEvents, rebuildItemStatesFromEvents } from '../learning/eventRebuild';
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
  // Added with canonical event log — absent in older snapshots; treat missing as []
  mathAnswerEvents?: MathAnswerEvent[];
}

// ── Build ─────────────────────────────────────────────────────────────────────

export async function buildSnapshot(): Promise<AppSnapshot> {
  const [students, itemStates, attempts, sessions, multFactStats, quizSessions, mathAnswerEvents] = await Promise.all([
    db.students.toArray(),
    db.itemStates.toArray(),
    db.attempts.toArray(),
    db.sessions.toArray(),
    db.multFactStats.toArray(),
    db.quizSessions.toArray(),
    db.mathAnswerEvents.toArray(),
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
    mathAnswerEvents,
  };
}

// ── Apply (merge remote into local) ──────────────────────────────────────────

/**
 * Merge a remote snapshot into the local DB.
 *
 * Strategy:
 *   1. mathAnswerEvents are merged first (union by ID) — they are the source of truth.
 *   2. Structural records (students, sessions, attempts, quizSessions) are unioned by ID.
 *   3. itemStates from the remote are merged as a fallback for items without events.
 *   4. multFactStats from the remote are merged as a fallback for facts without events.
 *   5. After the transaction, derived tables (multFactStats, itemStates) are recomputed
 *      from the merged event set for all affected students, overwriting the fallback values.
 *
 * This ensures that cross-device conflicts in derived caches are resolved from events,
 * not from stale computed aggregates.
 */
export async function mergeSnapshot(remote: AppSnapshot): Promise<void> {
  // Collect affected student IDs so we know who to rebuild after the transaction.
  const affectedStudentIds = new Set<string>([
    ...remote.students.map(s => s.id),
    ...(remote.mathAnswerEvents?.map(e => e.studentId) ?? []),
  ]);

  await db.transaction(
    'rw',
    [db.students, db.itemStates, db.attempts, db.sessions, db.multFactStats, db.quizSessions, db.mathAnswerEvents],
    async () => {
      // ── 1. Events first — source of truth ─────────────────────────────────
      if (remote.mathAnswerEvents?.length) {
        await db.mathAnswerEvents.bulkPut(remote.mathAnswerEvents);
      }

      // ── 2. Students ────────────────────────────────────────────────────────
      for (const s of remote.students) {
        await db.students.put(s);
      }

      // ── 3. Sessions ────────────────────────────────────────────────────────
      await db.sessions.bulkPut(remote.sessions);

      // ── 4. Attempts (compat layer) — union by ID ───────────────────────────
      await db.attempts.bulkPut(remote.attempts);

      // ── 5. QuizSessions — union by ID ──────────────────────────────────────
      if (remote.quizSessions?.length) {
        await db.quizSessions.bulkPut(remote.quizSessions);
      }

      // ── 6. ItemStates — fallback for items without events ──────────────────
      // Prefer the record with more attempts. Will be overwritten by event-rebuild
      // for any item that has events in the merged set.
      for (const remoteState of remote.itemStates) {
        const localState = await db.itemStates.get([remoteState.studentId, remoteState.itemId]);
        if (!localState || remoteState.attemptCount > localState.attemptCount) {
          await db.itemStates.put(remoteState);
        }
      }

      // ── 7. MultFactStats — fallback for facts without events ───────────────
      // Will be overwritten by event-rebuild for any fact that has events.
      for (const remoteStats of remote.multFactStats ?? []) {
        const localStats = await db.multFactStats.get([remoteStats.studentId, remoteStats.key]);
        if (!localStats || remoteStats.totalAttempts > localStats.totalAttempts) {
          await db.multFactStats.put(remoteStats);
        }
      }
    }
  );

  // ── 8. Post-merge rebuild ──────────────────────────────────────────────────
  // Recompute derived tables from the merged event set for each affected student.
  // This overwrites any stale fallback values written in steps 6–7.
  for (const studentId of affectedStudentIds) {
    await rebuildMultFactStatsFromEvents(studentId);
    await rebuildItemStatesFromEvents(studentId);
  }
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
