import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession } from '../../types/math';
import type { MultiplicationFactStats, QuizSession } from '../multiplication/types';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { rebuildMultFactStatsFromEvents, rebuildItemStatesFromEvents } from '../learning/eventRebuild';
import { db } from '../../db/dexie';
import type { GoalEvaluation, GoalEvent, LearningGoal } from '../goals/types';
import { remapStudentId, resolveCanonicalStudentIds, resolveLearnerKeyDuplicate, type StudentIdAliasMap } from './learnerKeyMerge';
import { validTimeMs, remoteHasNewerUpdatedAt } from './timeUtil';

export interface AppSnapshot {
  appId: 'mathfan';
  snapshotVersion: 1 | 2;
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
  learningGoals?: LearningGoal[];
  goalEvents?: GoalEvent[];
  goalEvaluations?: GoalEvaluation[];
}

// ── Build ─────────────────────────────────────────────────────────────────────

export async function buildSnapshot(): Promise<AppSnapshot> {
  const tables = [
    db.students,
    db.itemStates,
    db.attempts,
    db.sessions,
    db.multFactStats,
    db.quizSessions,
    db.mathAnswerEvents,
    db.learningGoals,
    db.goalEvents,
    db.goalEvaluations,
  ];

  return db.transaction('r', tables, async () => {
    const [
      students,
      itemStates,
      attempts,
      sessions,
      multFactStats,
      quizSessions,
      mathAnswerEvents,
      learningGoals,
      goalEvents,
      goalEvaluations,
    ] = await Promise.all([
      db.students.toArray(),
      db.itemStates.toArray(),
      db.attempts.toArray(),
      db.sessions.toArray(),
      db.multFactStats.toArray(),
      db.quizSessions.toArray(),
      db.mathAnswerEvents.toArray(),
      db.learningGoals.toArray(),
      db.goalEvents.toArray(),
      db.goalEvaluations.toArray(),
    ]);
    return {
      appId: 'mathfan',
      snapshotVersion: 2,
      snapshotAt: new Date().toISOString(),
      students,
      itemStates,
      attempts,
      sessions,
      multFactStats,
      quizSessions,
      mathAnswerEvents,
      learningGoals,
      goalEvents,
      goalEvaluations,
    };
  });
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
export { validTimeMs, remoteHasNewerUpdatedAt };

export interface OrphanReport { orphanCount: number; byTable: Record<string, string[]> }

const byId = <T extends { id: string }>(rows: T[]): T[] => [...new Map(rows.map(row => [row.id, row])).values()];

function mergeCardStateCollision(a: StudentItemState, b: StudentItemState): StudentItemState {
  const preferred = b.attemptCount > a.attemptCount ? b : a;
  return {
    ...preferred,
    attemptCount: Math.max(a.attemptCount, b.attemptCount),
    correctCount: Math.max(a.correctCount, b.correctCount),
    reps: Math.max(a.reps ?? 0, b.reps ?? 0),
    lapses: Math.max(a.lapses ?? 0, b.lapses ?? 0),
    stabilityDays: Math.max(a.stabilityDays, b.stabilityDays),
    mistakePatterns: Array.from(new Set([...(a.mistakePatterns ?? []), ...(b.mistakePatterns ?? [])])),
  };
}

function compoundMerge<T>(rows: T[], key: (row: T) => string, merge: (a: T, b: T) => T): T[] {
  const result = new Map<string, T>();
  for (const row of rows) {
    const id = key(row);
    result.set(id, result.has(id) ? merge(result.get(id)!, row) : row);
  }
  return [...result.values()];
}

async function orphanReportInTransaction(): Promise<OrphanReport> {
  const studentIds = new Set((await db.students.toArray()).map(student => student.id));
  const tables = {
    itemStates: await db.itemStates.toArray(), attempts: await db.attempts.toArray(), sessions: await db.sessions.toArray(),
    multFactStats: await db.multFactStats.toArray(), quizSessions: await db.quizSessions.toArray(), mathAnswerEvents: await db.mathAnswerEvents.toArray(),
    learningGoals: await db.learningGoals.toArray(), goalEvents: await db.goalEvents.toArray(), goalEvaluations: await db.goalEvaluations.toArray(),
  };
  const byTable: Record<string, string[]> = {};
  for (const [name, rows] of Object.entries(tables)) {
    const ids = rows.filter(row => !studentIds.has(row.studentId)).map(row => row.studentId);
    if (ids.length) byTable[name] = [...new Set(ids)];
  }
  return { orphanCount: Object.values(byTable).reduce((sum, ids) => sum + ids.length, 0), byTable };
}

export async function findOrphanedStudentReferences(): Promise<OrphanReport> {
  return db.transaction('r', [db.students, db.itemStates, db.attempts, db.sessions, db.multFactStats, db.quizSessions, db.mathAnswerEvents, db.learningGoals, db.goalEvents, db.goalEvaluations], orphanReportInTransaction);
}

export async function mergeSnapshot(remote: AppSnapshot): Promise<void> {
  let aliases: StudentIdAliasMap = new Map();
  const affectedStudentIds = new Set<string>();

  await db.transaction(
    'rw',
    [
      db.students,
      db.itemStates,
      db.attempts,
      db.sessions,
      db.multFactStats,
      db.quizSessions,
      db.mathAnswerEvents,
      db.learningGoals,
      db.goalEvents,
      db.goalEvaluations,
    ],
    async () => {
      const localProfiles = await db.students.toArray();
      const localEvents = await db.mathAnswerEvents.toArray();
      const allEvents = byId([...localEvents, ...(remote.mathAnswerEvents ?? [])]);
      const evidenceCounts: Record<string, number> = {};
      for (const event of allEvents) evidenceCounts[event.studentId] = (evidenceCounts[event.studentId] ?? 0) + 1;
      aliases = resolveCanonicalStudentIds(localProfiles, remote.students, evidenceCounts);

      const profileGroups = new Map<string, StudentProfile[]>();
      for (const profile of [...localProfiles, ...remote.students]) {
        const canonicalId = aliases.get(profile.id) ?? profile.id;
        const group = profileGroups.get(canonicalId) ?? [];
        if (!group.some(existing => existing.id === profile.id)) group.push(profile);
        profileGroups.set(canonicalId, group);
      }
      const profiles = [...profileGroups.entries()].map(([canonicalId, group]) => {
        let resolved = { ...group.find(profile => profile.id === canonicalId)!, id: canonicalId };
        for (const profile of group) if (profile.id !== canonicalId) resolved = { ...resolveLearnerKeyDuplicate(resolved, profile, evidenceCounts), id: canonicalId };
        return resolved;
      });

      const remap = <T extends { studentId: string }>(rows: T[]) => rows.map(row => remapStudentId(row, aliases));
      const itemStates = compoundMerge(remap([...(await db.itemStates.toArray()), ...remote.itemStates]), row => `${row.studentId}|${row.cardKey}`, mergeCardStateCollision);
      const multFactStats = compoundMerge(remap([...(await db.multFactStats.toArray()), ...(remote.multFactStats ?? [])]), row => `${row.studentId}|${row.key}`, (a, b) => b.totalAttempts > a.totalAttempts ? b : a);
      const goals = compoundMerge(remap([...(await db.learningGoals.toArray()), ...(remote.learningGoals ?? [])]), row => row.id, (a, b) => remoteHasNewerUpdatedAt(b.updatedAt, a.updatedAt) ? b : a);
      const evaluations = compoundMerge(remap([...(await db.goalEvaluations.toArray()), ...(remote.goalEvaluations ?? [])]), row => row.id, (a, b) => remoteHasNewerUpdatedAt(b.updatedAt, a.updatedAt) ? b : a);
      const normalizedEvents = remap(allEvents);
      const sessions = byId(remap([...(await db.sessions.toArray()), ...remote.sessions]));
      const attempts = byId(remap([...(await db.attempts.toArray()), ...remote.attempts]));
      const quizSessions = byId(remap([...(await db.quizSessions.toArray()), ...(remote.quizSessions ?? [])]));
      const goalEvents = byId(remap([...(remote.goalEvents ?? []), ...(await db.goalEvents.toArray())]));

      await db.students.bulkPut(profiles);
      await db.mathAnswerEvents.bulkPut(normalizedEvents);
      await db.sessions.bulkPut(sessions);
      await db.attempts.bulkPut(attempts);
      await db.quizSessions.bulkPut(quizSessions);
      await db.goalEvents.bulkPut(goalEvents);
      await db.learningGoals.bulkPut(goals);
      await db.goalEvaluations.bulkPut(evaluations);
      await db.itemStates.bulkPut(itemStates);
      await db.multFactStats.bulkPut(multFactStats);

      const losingIds = [...aliases].filter(([id, canonical]) => id !== canonical).map(([id]) => id);
      for (const losingId of losingIds) {
        await Promise.all([
          db.itemStates.where('studentId').equals(losingId).delete(),
          db.multFactStats.where('studentId').equals(losingId).delete(),
          db.students.delete(losingId),
        ]);
      }

      for (const profile of profiles) affectedStudentIds.add(profile.id);
      for (const event of normalizedEvents) affectedStudentIds.add(event.studentId);
      const orphanReport = await orphanReportInTransaction();
      const losingOrphans = Object.values(orphanReport.byTable).flat().filter(id => losingIds.includes(id));
      if (losingOrphans.length) throw new Error(`Sync ownership normalization left orphaned losing-profile records: ${JSON.stringify(orphanReport.byTable)}`);
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
  const hasBaseShape =
    s.appId === 'mathfan' &&
    (s.snapshotVersion === 1 || s.snapshotVersion === 2) &&
    Array.isArray(s.students) &&
    Array.isArray(s.itemStates) &&
    Array.isArray(s.attempts) &&
    Array.isArray(s.sessions);

  if (!hasBaseShape) return false;
  if (s.snapshotVersion === 1) return true;

  return (
    Array.isArray(s.learningGoals) &&
    Array.isArray(s.goalEvents) &&
    Array.isArray(s.goalEvaluations)
  );
}
