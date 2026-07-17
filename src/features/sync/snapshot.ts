import type { StudentProfile, StudentItemState, AttemptLog, PracticeSession, PersistedDailyLessonPlan } from '../../types/math';
import { dailyLessonSemanticKey, hashDailyLessonContent } from '../learningPlan/dailyLessonPersistence';
import type { MultiplicationFactStats, QuizSession } from '../multiplication/types';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { rebuildMultFactStatsFromEvents, rebuildItemStatesFromEvents } from '../learning/eventRebuild';
import { db } from '../../db/dexie';
import type { GoalEvaluation, GoalEvent, LearningGoal } from '../goals/types';
import { mergeProfilesByExactId, remapStudentId, resolveCanonicalStudentIds, resolveLearnerKeyDuplicate, type StudentIdAliasMap } from './learnerKeyMerge';
import { validTimeMs, remoteHasNewerUpdatedAt } from './timeUtil';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { deriveCardKey } from '../scheduler/cardModel';
import { CARD_MODEL_VERSION } from '../learning/schedulingTelemetry';
import { assertValidPracticeItem, validatePracticeItem } from '../curriculum/practiceContentSpec';
import { loadActiveProfileSelection, saveActiveProfileSelection } from '../profile/profileBootstrap';
import {
  parseAttemptLog, parseDailyLessonPlanShape, parseGoalEvaluation, parseGoalEvent, parseLearningGoal,
  parseMathAnswerEvent, parseMultiplicationFactStat, parsePracticeSession, parseQuizSession,
  parseSnapshotTable, parseStudentItemState, parseStudentProfile,
} from './snapshotParsers';

export interface SnapshotFormatMetadata {
  appVersion: string;
  gitSha: string;
  buildTime: string;
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
      metadata: { appVersion: __APP_VERSION__, gitSha: __GIT_SHA__, buildTime: __BUILD_TIME__, schemaVersion: 3, cardModelVersion: CARD_MODEL_VERSION, exportedAt: new Date().toISOString() },
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

export class SnapshotMergeError extends Error {
  readonly code: string;
  readonly details: unknown;
  constructor(code: string, details: unknown) {
    super(code);
    this.code = code;
    this.details = details;
    this.name = 'SnapshotMergeError';
  }
}

export const LEARNER_OWNED_TABLES = {
  itemStates: db.itemStates,
  attempts: db.attempts,
  sessions: db.sessions,
  multFactStats: db.multFactStats,
  quizSessions: db.quizSessions,
  mathAnswerEvents: db.mathAnswerEvents,
  learningGoals: db.learningGoals,
  goalEvents: db.goalEvents,
  goalEvaluations: db.goalEvaluations,
  dailyLessonPlans: db.dailyLessonPlans,
} as const;
export type LearnerOwnedTableName = keyof typeof LEARNER_OWNED_TABLES;

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
    scheduledCardKeys: Array.from(new Set([...(a.scheduledCardKeys ?? []), ...(b.scheduledCardKeys ?? [])])),
  };
}

function normalizeDailyLessonIdentity(plan: PersistedDailyLessonPlan): PersistedDailyLessonPlan {
  return {
    ...plan,
    semanticKey: dailyLessonSemanticKey(plan.studentId, plan.localDate, plan.revision),
    contentHash: plan.contentHash ?? hashDailyLessonContent(plan.items),
  };
}

function resolveDailyLessonPlans(plans: PersistedDailyLessonPlan[]): PersistedDailyLessonPlan[] {
  const byId = compoundMerge(plans.map(normalizeDailyLessonIdentity), row => row.id, mergeDailyLessonPlan);
  const groups = new Map<string, PersistedDailyLessonPlan[]>();
  for (const plan of byId) groups.set(plan.semanticKey!, [...(groups.get(plan.semanticKey!) ?? []), plan]);
  const resolved: PersistedDailyLessonPlan[] = [];
  for (const group of groups.values()) {
    const sameContent = compoundMerge(group, row => row.contentHash!, mergeDailyLessonPlan);
    if (sameContent.length === 1) { resolved.push(sameContent[0]); continue; }
    const ranked = [...sameContent].sort((a, b) => {
      const rank = (status: PersistedDailyLessonPlan['status']) => status === 'completed' ? 3 : status === 'in_progress' ? 2 : status === 'planned' ? 1 : 0;
      return rank(b.status) - rank(a.status)
        || b.completedItemInstanceIds.length - a.completedItemInstanceIds.length
        || b.updatedAt.localeCompare(a.updatedAt)
        || a.id.localeCompare(b.id);
    });
    const winner = ranked[0];
    resolved.push(winner, ...ranked.slice(1).map(plan => ({
      ...plan,
      status: 'replaced' as const,
      conflictOfPlanId: winner.id,
      replacedByPlanId: winner.id,
    })));
  }
  return resolved;
}

export function canonicalDailyLessonPlanId(studentId: string, localDate: string, revision: number): string {
  return `daily-lesson:${studentId}:${localDate}:r${revision}`;
}

function buildLessonPlanAliases(plans: PersistedDailyLessonPlan[], aliases: StudentIdAliasMap): Map<string, string> {
  const groups = new Map<string, PersistedDailyLessonPlan[]>();
  for (const plan of plans) {
    const studentId = aliases.get(plan.studentId) ?? plan.studentId;
    const key = dailyLessonSemanticKey(studentId, plan.localDate, plan.revision);
    groups.set(key, [...(groups.get(key) ?? []), plan]);
  }
  const planAliases = new Map<string, string>();
  for (const group of groups.values()) {
    const ownerChanged = group.some(plan => (aliases.get(plan.studentId) ?? plan.studentId) !== plan.studentId);
    if (!ownerChanged) continue;
    const first = group[0];
    const studentId = aliases.get(first.studentId) ?? first.studentId;
    const canonicalId = canonicalDailyLessonPlanId(studentId, first.localDate, first.revision);
    const contentGroups = new Map<string, PersistedDailyLessonPlan[]>();
    for (const plan of group) {
      const semanticItems = plan.items.map(item => ({
        ...item,
        selection: item.selection ? { ...item.selection, lessonPlanId: undefined } : undefined,
      }));
      const contentKey = hashDailyLessonContent(semanticItems);
      contentGroups.set(contentKey, [...(contentGroups.get(contentKey) ?? []), plan]);
    }
    for (const [index, [contentKey, matchingPlans]] of [...contentGroups.entries()].sort(([left], [right]) => left.localeCompare(right)).entries()) {
      const targetId = index === 0 ? canonicalId : `${canonicalId}:content:${contentKey}`;
      for (const plan of matchingPlans) planAliases.set(plan.id, targetId);
    }
  }
  return planAliases;
}

function remapLessonReference<T extends { lessonPlanId?: string }>(record: T, planAliases: ReadonlyMap<string, string>): T {
  const lessonPlanId = record.lessonPlanId ? planAliases.get(record.lessonPlanId) : undefined;
  return lessonPlanId && lessonPlanId !== record.lessonPlanId ? { ...record, lessonPlanId } : record;
}

function remapDailyLessonPlan(
  plan: PersistedDailyLessonPlan,
  studentAliases: StudentIdAliasMap,
  planAliases: ReadonlyMap<string, string>,
): PersistedDailyLessonPlan {
  const remapped = remapStudentId(plan, studentAliases);
  const id = planAliases.get(plan.id) ?? plan.id;
  const items = remapped.items.map(item => ({
    ...item,
    selection: item.selection ? remapLessonReference(item.selection, planAliases) : undefined,
  }));
  return normalizeDailyLessonIdentity({
    ...remapped,
    id,
    contentHash: hashDailyLessonContent(items),
    replacedByPlanId: remapped.replacedByPlanId ? planAliases.get(remapped.replacedByPlanId) ?? remapped.replacedByPlanId : undefined,
    conflictOfPlanId: remapped.conflictOfPlanId ? planAliases.get(remapped.conflictOfPlanId) ?? remapped.conflictOfPlanId : undefined,
    items,
  });
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
  const tables = Object.fromEntries(await Promise.all(Object.entries(LEARNER_OWNED_TABLES)
    .map(async ([name, table]) => [name, await table.toArray()]))) as Record<LearnerOwnedTableName, Array<{ studentId: string }>>;
  const byTable: Record<string, string[]> = {};
  for (const [name, rows] of Object.entries(tables)) {
    const ids = rows.filter(row => !studentIds.has(row.studentId)).map(row => row.studentId);
    if (ids.length) byTable[name] = [...new Set(ids)];
  }
  const plans = tables.dailyLessonPlans as PersistedDailyLessonPlan[];
  const planIds = new Set(plans.map(plan => plan.id));
  const checkLessonReferences = (name: string, rows: Array<{ lessonPlanId?: string }>) => {
    const ids = rows.flatMap(row => row.lessonPlanId && !planIds.has(row.lessonPlanId) ? [row.lessonPlanId] : []);
    if (ids.length) byTable[`${name}.lessonPlanId`] = [...new Set(ids)];
  };
  checkLessonReferences('mathAnswerEvents', tables.mathAnswerEvents as MathAnswerEvent[]);
  checkLessonReferences('attempts', tables.attempts as AttemptLog[]);
  checkLessonReferences('sessions', tables.sessions as PracticeSession[]);
  checkLessonReferences('goalEvaluations.answerEvents', (tables.goalEvaluations as GoalEvaluation[]).flatMap(row => row.answerEvents ?? []));
  checkLessonReferences('dailyLessonPlans.items.selection', plans.flatMap(plan => plan.items.map(item => item.selection ?? {})));
  return { orphanCount: Object.values(byTable).reduce((sum, ids) => sum + ids.length, 0), byTable };
}

export async function findOrphanedStudentReferences(): Promise<OrphanReport> {
  return db.transaction('r', [db.students, ...Object.values(LEARNER_OWNED_TABLES)], orphanReportInTransaction);
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
  if (typeof source.snapshotAt !== 'string' || validTimeMs(source.snapshotAt) === null) problems.push({ table: 'snapshot', code: 'invalid_timestamp', message: 'snapshotAt must be a valid timestamp.' });
  if (problems.length) return { problems, warnings };
  const parsedTables = {
    students: parseSnapshotTable('students', source.students, parseStudentProfile, true),
    attempts: parseSnapshotTable('attempts', source.attempts, parseAttemptLog, true),
    sessions: parseSnapshotTable('sessions', source.sessions, parsePracticeSession, true),
    multFactStats: parseSnapshotTable('multFactStats', source.multFactStats, parseMultiplicationFactStat),
    quizSessions: parseSnapshotTable('quizSessions', source.quizSessions, parseQuizSession),
    mathAnswerEvents: parseSnapshotTable('mathAnswerEvents', source.mathAnswerEvents, parseMathAnswerEvent),
    learningGoals: parseSnapshotTable('learningGoals', source.learningGoals, parseLearningGoal),
    goalEvents: parseSnapshotTable('goalEvents', source.goalEvents, parseGoalEvent),
    goalEvaluations: parseSnapshotTable('goalEvaluations', source.goalEvaluations, parseGoalEvaluation),
    dailyLessonPlans: parseSnapshotTable('dailyLessonPlans', source.dailyLessonPlans, (value, index) => {
      if (version < 3 && value && typeof value === 'object') {
        const legacy = value as Record<string, unknown>;
        return parseDailyLessonPlanShape({
          ...legacy,
          generatedAt: legacy.generatedAt || (typeof source.snapshotAt === 'string' ? source.snapshotAt : '1970-01-01T00:00:00.000Z'),
          updatedAt: legacy.updatedAt || (typeof source.snapshotAt === 'string' ? source.snapshotAt : '1970-01-01T00:00:00.000Z'),
        }, index);
      }
      return parseDailyLessonPlanShape(value, index);
    }),
  };
  for (const result of Object.values(parsedTables)) { problems.push(...result.problems); warnings.push(...result.warnings); }
  if (problems.length) return { problems, warnings };
  const students = parsedTables.students.values;
  const childRows = {
    attempts: parsedTables.attempts.values, sessions: parsedTables.sessions.values,
    multFactStats: parsedTables.multFactStats.values, quizSessions: parsedTables.quizSessions.values,
    mathAnswerEvents: parsedTables.mathAnswerEvents.values, learningGoals: parsedTables.learningGoals.values,
    goalEvents: parsedTables.goalEvents.values, goalEvaluations: parsedTables.goalEvaluations.values,
    dailyLessonPlans: parsedTables.dailyLessonPlans.values,
  };
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
    if (!state) {
      const diagnostic = { table: 'itemStates', recordId: String(row.itemId ?? index), code: version === 3 ? 'missing_card_key' : 'unparseable_legacy_item', message: version === 3 ? 'Version 3 item state is missing a canonical cardKey.' : 'Legacy cache row could not be reconstructed and was skipped; answer events remain importable.' };
      if (version === 3) problems.push(diagnostic); else warnings.push(diagnostic);
      continue;
    }
    const parsedState = parseStudentItemState(state, index);
    if (!parsedState.ok) { problems.push(...parsedState.problems); continue; }
    normalizedStates.push(remapStudentId(parsedState.value, aliases));
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
    const rawInvalid = plan.items.flatMap((value, itemIndex) => validatePracticeItem(value.item)
      .map(problem => ({ ...problem, path: `items[${itemIndex}].item.${problem.path}` })));
    if (rawInvalid.length) {
      problems.push({ table: 'dailyLessonPlans', recordId: plan.id, code: 'invalid_practice_item',
        message: rawInvalid.map(problem => `${problem.path}: ${problem.message}`).join('; ') });
      continue;
    }
    const items = plan.items.map(value => ({ ...value, item: assertValidPracticeItem(value.item) }));
    const invalid = items.flatMap(value => validatePracticeItem(value.item));
    if (invalid.length) {
      problems.push({
        table: 'dailyLessonPlans', recordId: plan.id, code: 'invalid_practice_item',
        message: invalid.map(problem => `${problem.path}: ${problem.message}`).join('; '),
      });
      continue;
    }
    normalizedDailyLessonPlans.push(normalizeDailyLessonIdentity({ ...plan, items }));
  }
  if (problems.length) return { problems, warnings };
  const remappedChildren = Object.fromEntries(Object.entries(childRows).map(([table, rows]) => [
    table,
    table === 'dailyLessonPlans' ? normalizedDailyLessonPlans : rows.map(row => remapStudentId(row, aliases)),
  ]));
  const canonicalStudentIds = new Set(canonicalProfiles.map(profile => profile.id));
  for (const [table, rows] of Object.entries({ itemStates, ...remappedChildren })) {
    const seen = new Map<string, string>();
    for (const [index, value] of (rows as unknown as Array<Record<string, unknown>>).entries()) {
      if (!canonicalStudentIds.has(String(value.studentId))) {
        problems.push({ table, recordId: typeof value.id === 'string' ? value.id : String(index), code: 'unknown_student_id', message: `studentId does not resolve to a profile in this snapshot.` });
      }
      if (typeof value.id === 'string') {
        const serialized = JSON.stringify(value);
        const prior = seen.get(value.id);
        if (prior !== undefined && prior !== serialized) problems.push({ table, recordId: value.id, code: 'conflicting_duplicate_id', message: 'Duplicate id has conflicting record contents.' });
        seen.set(value.id, serialized);
      }
    }
  }
  if (version === 3) {
    const lessonIds = new Set(parsedTables.dailyLessonPlans.values.map(plan => plan.id));
    for (const event of remappedChildren.mathAnswerEvents as MathAnswerEvent[]) {
      if (event.lessonPlanId && !lessonIds.has(event.lessonPlanId)) problems.push({ table: 'mathAnswerEvents', recordId: event.id, code: 'unknown_lesson_plan_id', message: 'lessonPlanId does not resolve to a daily lesson plan.' });
    }
  }
  if (problems.length) return { problems, warnings };
  const snapshotAt = typeof source.snapshotAt === 'string' ? source.snapshotAt : new Date().toISOString();
  return {
    snapshot: {
      appId: 'mathfan', snapshotVersion: 3, snapshotAt,
      metadata: {
        appVersion: typeof (source.metadata as Record<string, unknown> | undefined)?.appVersion === 'string' ? String((source.metadata as Record<string, unknown>).appVersion) : 'legacy',
        gitSha: typeof (source.metadata as Record<string, unknown> | undefined)?.gitSha === 'string' ? String((source.metadata as Record<string, unknown>).gitSha) : 'legacy',
        buildTime: typeof (source.metadata as Record<string, unknown> | undefined)?.buildTime === 'string' ? String((source.metadata as Record<string, unknown>).buildTime) : snapshotAt,
        schemaVersion: 3, cardModelVersion: CARD_MODEL_VERSION, exportedAt: snapshotAt,
      },
      students: canonicalProfiles, itemStates,
      attempts: remappedChildren.attempts as AttemptLog[], sessions: remappedChildren.sessions as PracticeSession[],
      multFactStats: remappedChildren.multFactStats as MultiplicationFactStats[], quizSessions: remappedChildren.quizSessions as QuizSession[],
      mathAnswerEvents: remappedChildren.mathAnswerEvents as MathAnswerEvent[], learningGoals: remappedChildren.learningGoals as LearningGoal[],
      goalEvents: remappedChildren.goalEvents as GoalEvent[], goalEvaluations: remappedChildren.goalEvaluations as GoalEvaluation[],
      dailyLessonPlans: remappedChildren.dailyLessonPlans as PersistedDailyLessonPlan[],
    }, problems, warnings,
  };
}

export async function mergeSnapshot(remote: unknown): Promise<void> {
  const normalized = normalizeSnapshot(remote);
  if (!normalized.snapshot || normalized.problems.length) throw new Error(`Snapshot normalization failed: ${normalized.problems.map(problem => `${problem.table}:${problem.code}`).join(', ')}`);
  return mergeNormalizedSnapshot(normalized.snapshot);
}

export async function mergeNormalizedSnapshot(remote: AppSnapshotV3): Promise<void> {
  let aliases: StudentIdAliasMap = new Map();
  const affectedStudentIds = new Set<string>();

  await db.transaction(
    'rw',
    [db.students, ...Object.values(LEARNER_OWNED_TABLES)],
    async () => {
      const localProfiles = await db.students.toArray();
      const localEvents = await db.mathAnswerEvents.toArray();
      const localDailyLessonPlans = await db.dailyLessonPlans.toArray();
      const allEvents = byId([...localEvents, ...(remote.mathAnswerEvents ?? [])]);
      const evidenceCounts: Record<string, number> = {};
      for (const event of allEvents) evidenceCounts[event.studentId] = (evidenceCounts[event.studentId] ?? 0) + 1;
      const exactIdProfiles = mergeProfilesByExactId(localProfiles, remote.students);
      aliases = resolveCanonicalStudentIds(localProfiles, exactIdProfiles, evidenceCounts);

      const profileGroups = new Map<string, StudentProfile[]>();
      for (const profile of exactIdProfiles) {
        const canonicalId = aliases.get(profile.id) ?? profile.id;
        const group = profileGroups.get(canonicalId) ?? [];
        group.push(profile);
        profileGroups.set(canonicalId, group);
      }
      const profiles = [...profileGroups.entries()].map(([canonicalId, group]) => {
        let resolved = { ...group.find(profile => profile.id === canonicalId)!, id: canonicalId };
        for (const profile of group) if (profile.id !== canonicalId) resolved = { ...resolveLearnerKeyDuplicate(resolved, profile, evidenceCounts), id: canonicalId };
        return resolved;
      });

      const allDailyLessonPlans = [...localDailyLessonPlans, ...(remote.dailyLessonPlans ?? [])];
      const lessonPlanAliases = buildLessonPlanAliases(allDailyLessonPlans, aliases);
      const remap = <T extends { studentId: string; lessonPlanId?: string }>(rows: T[]) => rows
        .map(row => remapLessonReference(remapStudentId(row, aliases), lessonPlanAliases));
      const remapEvaluations = (rows: GoalEvaluation[]) => remap(rows).map(evaluation => ({
        ...evaluation,
        answerEvents: evaluation.answerEvents?.map(event => remapLessonReference(remapStudentId(event, aliases), lessonPlanAliases)),
      }));
      const itemStates = compoundMerge(remap([...(await db.itemStates.toArray()), ...remote.itemStates]), row => `${row.studentId}|${row.cardKey}`, mergeCardStateCollision);
      const multFactStats = compoundMerge(remap([...(await db.multFactStats.toArray()), ...(remote.multFactStats ?? [])]), row => `${row.studentId}|${row.key}`, (a, b) => b.totalAttempts > a.totalAttempts ? b : a);
      const goals = compoundMerge(remap([...(await db.learningGoals.toArray()), ...(remote.learningGoals ?? [])]), row => row.id, (a, b) => remoteHasNewerUpdatedAt(b.updatedAt, a.updatedAt) ? b : a);
      const evaluations = compoundMerge(remapEvaluations([...(await db.goalEvaluations.toArray()), ...(remote.goalEvaluations ?? [])]), row => row.id, (a, b) => remoteHasNewerUpdatedAt(b.updatedAt, a.updatedAt) ? b : a);
      const dailyLessonPlans = resolveDailyLessonPlans(allDailyLessonPlans
        .map(plan => remapDailyLessonPlan(plan, aliases, lessonPlanAliases)));
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

      const canonicalPlanIds = new Set(dailyLessonPlans.map(plan => plan.id));
      for (const [obsoletePlanId, canonicalPlanId] of lessonPlanAliases) {
        if (obsoletePlanId !== canonicalPlanId && !canonicalPlanIds.has(obsoletePlanId)) {
          await db.dailyLessonPlans.delete(obsoletePlanId);
        }
      }

      const losingIds = [...aliases].filter(([id, canonical]) => id !== canonical).map(([id]) => id);
      for (const losingId of losingIds) {
        await Promise.all([
          db.itemStates.where('studentId').equals(losingId).delete(),
          db.multFactStats.where('studentId').equals(losingId).delete(),
          db.dailyLessonPlans.where('studentId').equals(losingId).delete(),
        ]);
      }

      for (const losingId of losingIds) await db.students.delete(losingId);

      for (const profile of profiles) affectedStudentIds.add(profile.id);
      for (const event of normalizedEvents) affectedStudentIds.add(event.studentId);
      const orphanReport = await orphanReportInTransaction();
      if (orphanReport.orphanCount > 0) {
        throw new SnapshotMergeError('orphaned_student_references', orphanReport);
      }
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
