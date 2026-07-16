/**
 * Hybrid-card scheduling migration (issue #26).
 *
 * The Dexie schema upgrade (see db/dexie.ts v7→v8) already deletes the old
 * itemId-keyed itemStates store and recreates it empty with the new
 * `[studentId+cardKey]` primary key, backing up the legacy rows into
 * `migrationBackups` along the way. This module's job is the *application-level*
 * migration: (re)populate the new, empty itemStates table by replaying the
 * untouched, authoritative `mathAnswerEvents` log — grouped by canonical card
 * key instead of exact item id — via the same replay primitive used for
 * ordinary cache rebuilds (`rebuildItemStatesFromEvents`).
 *
 * Phases: preflight → backup → replay → validate → commit, with a rollback
 * path if a run is ever superseded by a bug. Gated behind MIGRATION_KIND/
 * DataMigrationRun records so it only actually replays once per version.
 */
import { db } from '../../db/dexie';
import { generateId } from '../../utils/id';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { rebuildItemStatesFromEvents } from '../learning/eventRebuild';
import type { StudentItemState } from '../../types/math';
import { deriveCardKey } from '../scheduler/cardModel';
import type { DataMigrationKind, DataMigrationRun, LegacyStudentItemState, MigrationBackup, MigrationCoverage } from './migrationTypes';

export const MIGRATION_KIND: DataMigrationKind = 'hybrid-card-v1';

export interface MigrationRunResult {
  status: 'completed' | 'failed' | 'skipped';
  runId: string;
  affectedStudentCount?: number;
  outputCardCount?: number;
  unparseableEventCount?: number;
  coverage?: MigrationCoverage;
  error?: string;
}

const SCHEMA_V7_BACKUP_ID = 'schema-v7-pre-cardkey-backup';

export async function loadSchemaV7LegacyBackup(): Promise<LegacyStudentItemState[]> {
  const backup = await db.migrationBackups.get(SCHEMA_V7_BACKUP_ID);
  if (!backup) return [];
  return backup.itemStates.filter((row): row is LegacyStudentItemState => 'itemId' in row && !('cardKey' in row));
}

export function migrateLegacyState(legacy: LegacyStudentItemState): StudentItemState | { problem: string } {
  const item = makeItemFromId(legacy.itemId);
  if (!item) return { problem: `Cannot reconstruct legacy item ${legacy.itemId}` };
  const { itemId, ...preserved } = legacy;
  return { ...preserved, cardKey: deriveCardKey(item), lastItemId: itemId };
}

const masteryRank = { new: 0, learning: 1, developing: 2, strong: 3, mastered: 4 } as const;
const latest = (a?: string, b?: string) => !a ? b : !b ? a : Date.parse(a) >= Date.parse(b) ? a : b;

/** Conservatively combines legacy orientation collisions without reducing history. */
export function reconcileMigratedCardState(
  replayed: StudentItemState | undefined,
  legacy: StudentItemState | undefined,
): StudentItemState {
  if (replayed) return replayed;
  if (!legacy) throw new Error('No migrated state to reconcile');
  return legacy;
}

function mergeLegacyCollision(a: StudentItemState, b: StudentItemState): StudentItemState {
  const envelopeA = Number(a.fsrsDifficulty !== undefined) + Number(a.nextDueAt !== undefined) + Number(a.lastSeenAt !== undefined);
  const envelopeB = Number(b.fsrsDifficulty !== undefined) + Number(b.nextDueAt !== undefined) + Number(b.lastSeenAt !== undefined);
  const base = envelopeB > envelopeA ? b : a;
  return {
    ...base,
    attemptCount: Math.max(a.attemptCount, b.attemptCount),
    correctCount: Math.max(a.correctCount, b.correctCount),
    stabilityDays: Math.max(a.stabilityDays, b.stabilityDays),
    fsrsDifficulty: Math.max(a.fsrsDifficulty ?? 0, b.fsrsDifficulty ?? 0) || undefined,
    reps: Math.max(a.reps ?? 0, b.reps ?? 0),
    lapses: Math.max(a.lapses ?? 0, b.lapses ?? 0),
    lastSeenAt: latest(a.lastSeenAt, b.lastSeenAt),
    nextDueAt: latest(a.nextDueAt, b.nextDueAt),
    masteryLevel: masteryRank[a.masteryLevel] >= masteryRank[b.masteryLevel] ? a.masteryLevel : b.masteryLevel,
    mistakePatterns: Array.from(new Set([...(a.mistakePatterns ?? []), ...(b.mistakePatterns ?? [])])),
  };
}

async function convertedLegacyStates(): Promise<{ states: StudentItemState[]; inputCount: number; collisionCount: number; unparseable: number }> {
  const rows = await loadSchemaV7LegacyBackup();
  const byCard = new Map<string, StudentItemState>();
  let collisionCount = 0;
  let unparseable = 0;
  for (const row of rows) {
    const converted = migrateLegacyState(row);
    if ('problem' in converted) { unparseable++; continue; }
    const key = `${converted.studentId}::${converted.cardKey}`;
    const prior = byCard.get(key);
    if (prior) { collisionCount++; byCard.set(key, mergeLegacyCollision(prior, converted)); }
    else byCard.set(key, converted);
  }
  return { states: [...byCard.values()], inputCount: rows.length, collisionCount, unparseable };
}

/** True when this migration kind has already completed successfully. */
export async function isCardStateMigrationComplete(): Promise<boolean> {
  const runs = await db.dataMigrationRuns.where('kind').equals(MIGRATION_KIND).toArray();
  return runs.some(r => r.status === 'completed');
}

async function recoverInterruptedRuns(): Promise<void> {
  const interrupted = await db.dataMigrationRuns.where('kind').equals(MIGRATION_KIND).and(run => run.status === 'started').toArray();
  for (const run of interrupted) {
    const rollback = await rollbackCardStateMigration(run.id);
    if (!rollback.ok) {
      await db.dataMigrationRuns.update(run.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: `Interrupted migration could not be rolled back: ${rollback.error ?? 'missing backup'}`,
      });
    }
  }
}

async function preflight(): Promise<{ ok: true; eventCount: number; studentIds: string[]; unparseable: number } | { ok: false; error: string }> {
  try {
    const events = await db.mathAnswerEvents
      .filter(e => e.mode === 'practice' || e.mode === 'diagnostic' || e.mode === 'goal_evaluation')
      .toArray();
    const studentIds = Array.from(new Set(events.map(e => e.studentId)));
    const unparseable = events.filter(e => !makeItemFromId(e.itemId)).length;
    return { ok: true, eventCount: events.length, studentIds, unparseable };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function backupCurrentItemStates(runId: string): Promise<void> {
  const current: StudentItemState[] = await db.itemStates.toArray();
  const backup: MigrationBackup = {
    id: generateId(),
    migrationRunId: runId,
    createdAt: new Date().toISOString(),
    itemStates: current,
  };
  await db.migrationBackups.put(backup);
}

/** Restores itemStates from the backup captured at the start of `runId`. Used when a later, buggy run needs undoing. */
export async function rollbackCardStateMigration(runId: string): Promise<{ ok: boolean; error?: string }> {
  const backup = await db.migrationBackups.where('migrationRunId').equals(runId).first();
  if (!backup) return { ok: false, error: `No backup found for migration run ${runId}` };
  try {
    await db.transaction('rw', db.itemStates, db.dataMigrationRuns, async () => {
      await db.itemStates.clear();
      const restored: StudentItemState[] = [];
      for (const row of backup.itemStates) {
        if ('cardKey' in row) restored.push(row);
        else {
          const converted = migrateLegacyState(row);
          if (!('problem' in converted)) restored.push(converted);
        }
      }
      await db.itemStates.bulkPut(restored);
      await db.dataMigrationRuns.update(runId, { status: 'rolled_back' });
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function isValidState(state: StudentItemState): boolean {
  if (!state.studentId || !state.cardKey) return false;
  if (state.nextDueAt !== undefined && Number.isNaN(Date.parse(state.nextDueAt))) return false;
  return true;
}

async function validate(studentIds: string[]): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const seen = new Set<string>();
  let count = 0;
  for (const studentId of studentIds) {
    const states = await db.itemStates.where('studentId').equals(studentId).toArray();
    for (const state of states) {
      if (!isValidState(state)) return { ok: false, error: `Invalid state for ${state.studentId}/${state.cardKey}` };
      const key = `${state.studentId}::${state.cardKey}`;
      if (seen.has(key)) return { ok: false, error: `Duplicate card row for ${key}` };
      seen.add(key);
      count++;
    }
  }
  return { ok: true, count };
}

/**
 * Runs the hybrid-card migration once. Safe to call on every app boot — it
 * no-ops if a completed run already exists for MIGRATION_KIND. Never mutates
 * data if preflight validation fails.
 */
export async function runCardStateMigration(): Promise<MigrationRunResult> {
  if (await isCardStateMigrationComplete()) {
    return { status: 'skipped', runId: '' };
  }

  await recoverInterruptedRuns();

  const runId = generateId();
  const startedAt = new Date().toISOString();

  const pre = await preflight();
  if (!pre.ok) {
    await db.dataMigrationRuns.put({
      id: runId, kind: MIGRATION_KIND, status: 'failed', startedAt, sourceEventCount: 0, error: pre.error,
    });
    return { status: 'failed', runId, error: pre.error };
  }

  await db.dataMigrationRuns.put({
    id: runId, kind: MIGRATION_KIND, status: 'started', startedAt, sourceEventCount: pre.eventCount,
  });

  try {
    await backupCurrentItemStates(runId);

    const legacy = await convertedLegacyStates();
    if (legacy.states.length) await db.itemStates.bulkPut(legacy.states);

    const studentIds = Array.from(new Set([...pre.studentIds, ...legacy.states.map(state => state.studentId)]));
    for (const studentId of pre.studentIds) {
      await rebuildItemStatesFromEvents(studentId, { mode: 'preserve-legacy' });
    }

    const validation = await validate(studentIds);
    const replayedCardKeys = new Set<string>();
    const directEvents = await db.mathAnswerEvents
      .filter(event => !event.isRetry && !event.relatedEvidence && (event.mode === 'practice' || event.mode === 'diagnostic' || event.mode === 'goal_evaluation'))
      .toArray();
    for (const event of directEvents) {
      const item = makeItemFromId(event.itemId);
      if (item) replayedCardKeys.add(`${event.studentId}::${deriveCardKey(item)}`);
    }
    const legacyFallbackCount = legacy.states.filter(state => !replayedCardKeys.has(`${state.studentId}::${state.cardKey}`)).length;
    const coverage: MigrationCoverage = {
      legacyInputCount: legacy.inputCount,
      replayedCardCount: replayedCardKeys.size,
      legacyFallbackCount,
      collisionCount: legacy.collisionCount,
      unparseableLegacyCount: legacy.unparseable,
      unparseableEventCount: pre.unparseable,
      unexplainedLossCount: legacy.unparseable,
    };
    if (coverage.unexplainedLossCount > 0) {
      const error = `Migration would lose ${coverage.unexplainedLossCount} legacy scheduler row(s).`;
      await rollbackCardStateMigration(runId);
      await db.dataMigrationRuns.update(runId, { status: 'failed', error, coverage, completedAt: new Date().toISOString() });
      return { status: 'failed', runId, error, coverage };
    }
    if (!validation.ok) {
      await rollbackCardStateMigration(runId);
      await db.dataMigrationRuns.update(runId, { status: 'failed', error: validation.error, completedAt: new Date().toISOString() });
      return { status: 'failed', runId, error: validation.error };
    }

    await db.dataMigrationRuns.update(runId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      outputCardCount: validation.count,
      coverage,
    });

    return {
      status: 'completed',
      runId,
      affectedStudentCount: studentIds.length,
      outputCardCount: validation.count,
      unparseableEventCount: pre.unparseable,
      coverage,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await rollbackCardStateMigration(runId).catch(() => {});
    await db.dataMigrationRuns.update(runId, { status: 'failed', error, completedAt: new Date().toISOString() });
    return { status: 'failed', runId, error };
  }
}

export type { DataMigrationRun };
