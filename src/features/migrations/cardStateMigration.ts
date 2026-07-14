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
import type { DataMigrationKind, DataMigrationRun, MigrationBackup } from './migrationTypes';

export const MIGRATION_KIND: DataMigrationKind = 'hybrid-card-v1';

export interface MigrationRunResult {
  status: 'completed' | 'failed' | 'skipped';
  runId: string;
  affectedStudentCount?: number;
  outputCardCount?: number;
  unparseableEventCount?: number;
  error?: string;
}

/** True when this migration kind has already completed successfully. */
export async function isCardStateMigrationComplete(): Promise<boolean> {
  const runs = await db.dataMigrationRuns.where('kind').equals(MIGRATION_KIND).toArray();
  return runs.some(r => r.status === 'completed');
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
      // Backups captured by this module are always current-shape rows (see
      // backupCurrentItemStates) — the legacy-shape variant only ever appears in
      // the one-time schema-upgrade backup, which this function does not target.
      await db.itemStates.bulkPut(backup.itemStates as StudentItemState[]);
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

    for (const studentId of pre.studentIds) {
      await rebuildItemStatesFromEvents(studentId, { mode: 'strict' });
    }

    const validation = await validate(pre.studentIds);
    if (!validation.ok) {
      await rollbackCardStateMigration(runId);
      await db.dataMigrationRuns.update(runId, { status: 'failed', error: validation.error, completedAt: new Date().toISOString() });
      return { status: 'failed', runId, error: validation.error };
    }

    await db.dataMigrationRuns.update(runId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      outputCardCount: validation.count,
    });

    return {
      status: 'completed',
      runId,
      affectedStudentCount: pre.studentIds.length,
      outputCardCount: validation.count,
      unparseableEventCount: pre.unparseable,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await rollbackCardStateMigration(runId).catch(() => {});
    await db.dataMigrationRuns.update(runId, { status: 'failed', error, completedAt: new Date().toISOString() });
    return { status: 'failed', runId, error };
  }
}

export type { DataMigrationRun };
