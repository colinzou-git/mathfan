import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession, PersistedDailyLessonPlan } from '../../types/math';
import type { MultiplicationFactStats, QuizSession } from '../multiplication/types';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { rebuildMultFactStatsFromEvents, rebuildItemStatesFromEvents } from '../learning/eventRebuild';
import { db } from '../../db/dexie';
import type { GoalEvaluation, GoalEvent, LearningGoal } from '../goals/types';
import { remapStudentId, resolveCanonicalStudentIds, resolveLearnerKeyDuplicate, type StudentIdAliasMap } from './learnerKeyMerge';
import { validTimeMs, remoteHasNewerUpdatedAt } from './timeUtil';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { deriveCardKey } from '../scheduler/cardModel';
import { CARD_MODEL_VERSION } from '../learning/schedulingTelemetry';
import { validatePracticeItem, withLegacyContentSpec } from '../curriculum/practiceContentSpec';
import { loadActiveProfileSelection, saveActiveProfileSelection } from '../profile/profileBootstrap';

export interface SnapshotFormatMetadata {
  appVersion: string;
  schemaVersion: 3;
  cardModelVersion: string;
  exportedAt: string;
}

export interface AppSnapshot {
  appId: 'mathfan';
  snapshotVersion: 1 | 2 | 3;
  snapshotAt: string;
  metadata?: SnapshotFormatMetadata;
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
  dailyLessonPlans?: PersistedDailyLessonPlan[];
}

// ── Build ─────────────────────────────────────────────────────────────────────

export async function buildSnapshot(): Promise<AppSnapshotV3> {
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
    db.dailyLessonPlans,
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
      dailyLessonPlans,
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
      db.dailyLessonPlans.toArray(),
    ]);
    return {
      appId: 'mathfan',
      snapshotVersion: 3,
      snapshotAt: new Date().toISOString(),
      metadata: { appVersion: __APP_VERSION__, schemaVersion: 3, cardModelVersion: CARD_MODEL_VERSION, exportedAt: new Date().toISOString() },
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
      dailyLessonPlans,
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
  const evidenceByCode = new Map<string, NonNullable<StudentItemState['misconceptionEvidence']>[number]>();
  for (const entry of [...(a.misconceptionEvidence ?? []), ...(b.misconceptionEvidence ?? [])]) {
    const prior = evidenceByCode.get(entry.code);
    if (!prior || entry.lastSeenAt > prior.lastSeenAt
      || (entry.lastSeenAt === prior.lastSeenAt && (entry.resolvedAt ?? '') > (prior.resolvedAt ?? ''))) {
      evidenceByCode.set(entry.code, entry);
    }
  }
  return {
    ...preferred,
    attemptCount: Math.max(a.attemptCount, b.attemptCount),
    correctCount: Math.max(a.correctCount, b.correctCount),
    reps: Math.max(a.reps ?? 0, b.reps ?? 0),
    lapses: Math.max(a.lapses ?? 0, b.lapses ?? 0),
    stabilityDays: Math.max(a.stabilityDays, b.stabilityDays),
    mistakePatterns: Array.from(new Set([...(a.mistakePatterns ?? []), ...(b.mistakePatterns ?? [])])),
    misconceptionEvidence: evidenceByCode.size ? [...evidenceByCode.values()] : undefined,
  };
}

function mergeDailyLessonPlan(a: PersistedDailyLessonPlan, b: PersistedDailyLessonPlan): PersistedDailyLessonPlan {
  if (a.status === 'completed' && b.status !== 'completed') return a;
  if (b.status === 'completed' && a.status !== 'completed') return b;
  // A revision's item list is immutable. Prefer local in-progress content and only union progress.
  const preferred = a.status === 'in_progress' ? a : remoteHasNewerUpdatedAt(b.updatedAt, a.updatedAt) ? b : a;
  return {
    ...preferred,
    completedItemInstanceIds: Array.from(new Set([...a.completedItemInstanceIds, ...b.completedItemInstanceIds])),
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
    dailyLessonPlans: await db.dailyLessonPlans.toArray(),
  };
  const byTable: Record<string, string[]> = {};
  for (const [name, rows] of Object.entries(tables)) {
    const ids = rows.filter(row => !studentIds.has(row.studentId)).map(row => row.studentId);
    if (ids.length) byTable[name] = [...new Set(ids)];
  }
  return { orphanCount: Object.values(byTable).reduce((sum, ids) => sum + ids.length, 0), byTable };
}

export async function findOrphanedStudentReferences(): Promise<OrphanReport> {
  return db.transaction('r', [db.students, db.itemStates, db.attempts, db.sessions, db.multFactStats, db.quizSessions, db.mathAnswerEvents, db.learningGoals, db.goalEvents, db.goalEvaluations, db.dailyLessonPlans], orphanReportInTransaction);
}

export type AppSnapshotV3 = AppSnapshot & { snapshotVersion: 3; metadata: SnapshotFormatMetadata };
export interface SnapshotNormalizationProblem { table: string; recordId?: string; code: string; message: string }
export interface SnapshotNormalizationResult { snapshot?: AppSnapshotV3; problems: SnapshotNormalizationProblem[]; warnings: SnapshotNormalizationProblem[] }

const requiredArrays = ['students', 'itemStates', 'attempts', 'sessions'] as const;

export function normalizeSnapshot(raw: unknown): SnapshotNormalizationResult {
  const problems: SnapshotNormalizationProblem[] = [];
  const warnings: SnapshotNormalizationProblem[] = [];
  if (!raw || typeof raw !== 'object') return { problems: [{ table: 'snapshot', code: 'invalid_root', message: 'Snapshot must be an object.' }], warnings };
  const source = raw as Record<string, unknown>;
  if (source.appId !== 'mathfan' || ![1, 2, 3].includes(source.snapshotVersion as number)) problems.push({ table: 'snapshot', code: 'unsupported_version', message: 'Snapshot app ID or version is not supported.' });
  for (const table of requiredArrays) if (!Array.isArray(source[table])) problems.push({ table, code: 'missing_array', message: `${table} must be an array.` });
  if (problems.length) return { problems, warnings };

  const version = source.snapshotVersion as 1 | 2 | 3;
  const students = (source.students as StudentProfile[]).filter((profile, index) => {
    const valid = profile && typeof profile.id === 'string' && typeof profile.displayName === 'string';
    if (!valid) problems.push({ table: 'students', recordId: String(index), code: 'invalid_profile', message: 'Student profile is missing required identity fields.' });
    return valid;
  });
  if (problems.length) return { problems, warnings };
  const allChildArrays = ['attempts', 'sessions', 'multFactStats', 'quizSessions', 'mathAnswerEvents', 'learningGoals', 'goalEvents', 'goalEvaluations', 'dailyLessonPlans'] as const;
  const childRows = Object.fromEntries(allChildArrays.map(table => [table, Array.isArray(source[table]) ? source[table] : []])) as Record<typeof allChildArrays[number], Array<{ studentId: string }>>;
  if (version >= 2 && (!Array.isArray(source.learningGoals) || !Array.isArray(source.goalEvents) || !Array.isArray(source.goalEvaluations))) {
    problems.push({ table: 'snapshot', code: 'missing_v2_tables', message: 'Version 2+ snapshots require goal arrays.' });
    return { problems, warnings };
  }
  const evidenceCounts: Record<string, number> = {};
  for (const event of childRows.mathAnswerEvents) if (typeof event.studentId === 'string') evidenceCounts[event.studentId] = (evidenceCounts[event.studentId] ?? 0) + 1;
  const aliases = resolveCanonicalStudentIds([], students, evidenceCounts);
  const canonicalProfiles = compoundMerge(students.map(profile => ({ ...profile, id: aliases.get(profile.id) ?? profile.id })), profile => profile.id, (a, b) => resolveLearnerKeyDuplicate(a, b, evidenceCounts));

  const normalizedStates: StudentItemState[] = [];
  for (const [index, value] of (source.itemStates as unknown[]).entries()) {
    if (!value || typeof value !== 'object') { warnings.push({ table: 'itemStates', recordId: String(index), code: 'invalid_state', message: 'Item state is not an object and was skipped.' }); continue; }
    const row = value as Record<string, unknown>;
    if (typeof row.studentId !== 'string') { problems.push({ table: 'itemStates', recordId: String(index), code: 'missing_owner', message: 'Item state is missing studentId.' }); continue; }
    let state: StudentItemState | undefined;
    if (typeof row.cardKey === 'string') state = row as unknown as StudentItemState;
    else if (typeof row.itemId === 'string') {
      const item = makeItemFromId(row.itemId);
      if (item) {
        const { itemId, ...legacy } = row;
        state = { ...legacy, studentId: row.studentId, cardKey: deriveCardKey(item), lastItemId: itemId } as unknown as StudentItemState;
      }
    }
    if (!state) { warnings.push({ table: 'itemStates', recordId: String(row.itemId ?? index), code: 'unparseable_legacy_item', message: 'Legacy cache row could not be reconstructed and was skipped; answer events remain importable.' }); continue; }
    normalizedStates.push(remapStudentId(state, aliases));
  }
  if (problems.length) return { problems, warnings };
  const itemStates = compoundMerge(normalizedStates, row => `${row.studentId}|${row.cardKey}`, mergeCardStateCollision);
  const normalizedDailyLessonPlans: PersistedDailyLessonPlan[] = [];
  for (const [index, rawPlan] of childRows.dailyLessonPlans.entries()) {
    const plan = remapStudentId(rawPlan, aliases) as PersistedDailyLessonPlan;
    if (!Array.isArray(plan.items)) {
      problems.push({ table: 'dailyLessonPlans', recordId: String(index), code: 'invalid_items', message: 'Daily lesson items must be an array.' });
      continue;
    }
    const items = plan.items.map(value => ({ ...value, item: withLegacyContentSpec(value.item) }));
    const invalid = items.flatMap(value => validatePracticeItem(value.item));
    if (invalid.length) {
      problems.push({
        table: 'dailyLessonPlans', recordId: plan.id, code: 'invalid_practice_item',
        message: invalid.map(problem => `${problem.path}: ${problem.message}`).join('; '),
      });
      continue;
    }
    normalizedDailyLessonPlans.push({ ...plan, items });
  }
  if (problems.length) return { problems, warnings };
  const remappedChildren = Object.fromEntries(Object.entries(childRows).map(([table, rows]) => [
    table,
    table === 'dailyLessonPlans' ? normalizedDailyLessonPlans : rows.map(row => remapStudentId(row, aliases)),
  ]));
  const snapshotAt = typeof source.snapshotAt === 'string' ? source.snapshotAt : new Date().toISOString();
  return {
    snapshot: {
      appId: 'mathfan', snapshotVersion: 3, snapshotAt,
      metadata: { appVersion: typeof (source.metadata as Record<string, unknown> | undefined)?.appVersion === 'string' ? String((source.metadata as Record<string, unknown>).appVersion) : 'legacy', schemaVersion: 3, cardModelVersion: CARD_MODEL_VERSION, exportedAt: snapshotAt },
      students: canonicalProfiles, itemStates,
      attempts: remappedChildren.attempts as AttemptLog[], sessions: remappedChildren.sessions as PracticeSession[],
      multFactStats: remappedChildren.multFactStats as MultiplicationFactStats[], quizSessions: remappedChildren.quizSessions as QuizSession[],
      mathAnswerEvents: remappedChildren.mathAnswerEvents as MathAnswerEvent[], learningGoals: remappedChildren.learningGoals as LearningGoal[],
      goalEvents: remappedChildren.goalEvents as GoalEvent[], goalEvaluations: remappedChildren.goalEvaluations as GoalEvaluation[],
      dailyLessonPlans: remappedChildren.dailyLessonPlans as PersistedDailyLessonPlan[],
    }, problems, warnings,
  };
}

export async function mergeSnapshot(remote: AppSnapshot): Promise<void> {
  const normalized = normalizeSnapshot(remote);
  if (!normalized.snapshot || normalized.problems.length) throw new Error(`Snapshot normalization failed: ${normalized.problems.map(problem => `${problem.table}:${problem.code}`).join(', ')}`);
  return mergeNormalizedSnapshot(normalized.snapshot);
}

export async function mergeNormalizedSnapshot(remote: AppSnapshotV3): Promise<void> {
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
      db.dailyLessonPlans,
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
      const remapEvaluations = (rows: GoalEvaluation[]) => remap(rows).map(evaluation => ({
        ...evaluation,
        answerEvents: evaluation.answerEvents?.map(event => remapStudentId(event, aliases)),
      }));
      const itemStates = compoundMerge(remap([...(await db.itemStates.toArray()), ...remote.itemStates]), row => `${row.studentId}|${row.cardKey}`, mergeCardStateCollision);
      const multFactStats = compoundMerge(remap([...(await db.multFactStats.toArray()), ...(remote.multFactStats ?? [])]), row => `${row.studentId}|${row.key}`, (a, b) => b.totalAttempts > a.totalAttempts ? b : a);
      const goals = compoundMerge(remap([...(await db.learningGoals.toArray()), ...(remote.learningGoals ?? [])]), row => row.id, (a, b) => remoteHasNewerUpdatedAt(b.updatedAt, a.updatedAt) ? b : a);
      const evaluations = compoundMerge(remapEvaluations([...(await db.goalEvaluations.toArray()), ...(remote.goalEvaluations ?? [])]), row => row.id, (a, b) => remoteHasNewerUpdatedAt(b.updatedAt, a.updatedAt) ? b : a);
      const dailyLessonPlans = compoundMerge(remap([...(await db.dailyLessonPlans.toArray()), ...(remote.dailyLessonPlans ?? [])]), row => row.id, mergeDailyLessonPlan);
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
      await db.dailyLessonPlans.bulkPut(dailyLessonPlans);
      await db.itemStates.bulkPut(itemStates);
      await db.multFactStats.bulkPut(multFactStats);

      const losingIds = [...aliases].filter(([id, canonical]) => id !== canonical).map(([id]) => id);
      for (const losingId of losingIds) {
        await Promise.all([
          db.itemStates.where('studentId').equals(losingId).delete(),
          db.multFactStats.where('studentId').equals(losingId).delete(),
          db.dailyLessonPlans.where('studentId').equals(losingId).delete(),
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

  const activeSelection = loadActiveProfileSelection();
  if (activeSelection?.id) {
    const canonicalId = aliases.get(activeSelection.id);
    if (canonicalId && canonicalId !== activeSelection.id) {
      const canonicalProfile = await db.students.get(canonicalId);
      if (canonicalProfile) saveActiveProfileSelection(canonicalProfile);
    }
  }

  // ── 8. Post-merge rebuild ──────────────────────────────────────────────────
  // Recompute derived tables from the merged event set for each affected student.
  // This overwrites any stale fallback values written in steps 6–7.
  for (const studentId of affectedStudentIds) {
    await rebuildMultFactStatsFromEvents(studentId);
    await rebuildItemStatesFromEvents(studentId);
  }
}

export function validateSnapshot(raw: unknown): raw is AppSnapshot {
  return normalizeSnapshot(raw).snapshot !== undefined;
}
