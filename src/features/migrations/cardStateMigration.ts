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
import type { MathAnswerEvent } from '../learning/learningEvents';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { replayCardEvents } from '../learning/eventRebuild';
import type { StudentItemState } from '../../types/math';
import { deriveCardKey, deriveCardKeyFromEvent } from '../scheduler/cardModel';
import type { DataMigrationKind, DataMigrationRun, LegacyStudentItemState, MigrationBackup, MigrationCoverage } from './migrationTypes';

export const CARD_STATE_REPAIR_MIGRATION_ID = 'canonical-card-baseline-replay-v3' as const;
export const MIGRATION_KIND: DataMigrationKind = CARD_STATE_REPAIR_MIGRATION_ID;

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

/** Re-key exact-instance one-step word cards before event replay. */
export async function repairLegacyWordProblemCardStates(): Promise<number> {
  const legacyRows = await db.itemStates
    .filter(state => /^template:WORD_(eg|ar|cmp|dv)_\d+_\d+$/.test(state.cardKey))
    .toArray();
  let repaired = 0;
  for (const legacy of legacyRows) {
    const itemId = legacy.cardKey.slice('template:'.length);
    const item = makeItemFromId(itemId);
    if (!item) continue;
    const cardKey = deriveCardKey(item);
    const existing = await db.itemStates.get([legacy.studentId, cardKey]);
    const migrated = { ...legacy, cardKey, lastItemId: legacy.lastItemId ?? itemId };
    await db.itemStates.put(existing ? mergeLegacyCollision(existing, migrated) : migrated);
    await db.itemStates.delete([legacy.studentId, legacy.cardKey]);
    repaired++;
  }
  return repaired;
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

function stateKey(state: Pick<StudentItemState, 'studentId' | 'cardKey'>): string {
  return `${state.studentId}::${state.cardKey}`;
}

function canonicalizeStoredStates(states: StudentItemState[]): StudentItemState[] {
  const byKey = new Map<string, StudentItemState>();
  for (const state of states) {
    const item = state.lastItemId ? makeItemFromId(state.lastItemId) : null;
    const canonical = item ? { ...state, cardKey: deriveCardKey(item) } : structuredClone(state);
    const key = stateKey(canonical);
    const prior = byKey.get(key);
    byKey.set(key, prior ? mergeLegacyCollision(prior, canonical) : canonical);
  }
  return [...byKey.values()];
}

async function buildUsableRollbackStates(legacy: Awaited<ReturnType<typeof convertedLegacyStates>>): Promise<StudentItemState[]> {
  const current = canonicalizeStoredStates(await db.itemStates.toArray());
  if (current.length > 0) return current;
  return legacy.states.map(state => structuredClone(state));
}

async function backupCurrentItemStates(runId: string, states: StudentItemState[]): Promise<MigrationBackup> {
  const backup: MigrationBackup = {
    id: generateId(),
    migrationRunId: runId,
    createdAt: new Date().toISOString(),
    itemStates: states.map(state => structuredClone(state)),
  };
  return backup;
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

function validateStates(states: StudentItemState[]): { invalidCount: number; error?: string } {
  const seen = new Set<string>();
  let invalidCount = 0;
  for (const state of states) {
    const key = stateKey(state);
    if (!isValidState(state) || seen.has(key)) invalidCount++;
    seen.add(key);
  }
  return invalidCount ? { invalidCount, error: `${invalidCount} invalid or duplicate card state(s).` } : { invalidCount: 0 };
}

export interface CardStateRepairPlan {
  migrationId: typeof CARD_STATE_REPAIR_MIGRATION_ID;
  rollbackStates: StudentItemState[];
  finalStates: StudentItemState[];
  coverage: MigrationCoverage;
  studentIds: string[];
}

export async function buildCardStateRepairPlan(): Promise<CardStateRepairPlan> {
  const events = await db.mathAnswerEvents
    .filter(event => event.mode === 'practice' || event.mode === 'diagnostic' || event.mode === 'goal_evaluation')
    .toArray();
  const legacy = await convertedLegacyStates();
  const rollbackStates = await buildUsableRollbackStates(legacy);
  const current = canonicalizeStoredStates(await db.itemStates.toArray());
  const baselineByKey = new Map(current.map(state => [stateKey(state), state]));
  for (const state of legacy.states) baselineByKey.set(stateKey(state), state);

  const validEventsByKey = new Map<string, MathAnswerEvent[]>();
  const unparseableEvents: MathAnswerEvent[] = [];
  for (const event of events) {
    const item = makeItemFromId(event.itemId);
    if (!item) { unparseableEvents.push(event); continue; }
    const cardKey = deriveCardKeyFromEvent(event) ?? deriveCardKey(item);
    const key = `${event.studentId}::${cardKey}`;
    const grouped = validEventsByKey.get(key) ?? [];
    grouped.push(event);
    validEventsByKey.set(key, grouped);
  }

  const allKeys = new Set([...baselineByKey.keys(), ...validEventsByKey.keys()]);
  const finalStates: StudentItemState[] = [];
  let replayedCardCount = 0;
  let baselineAdvancedCardCount = 0;
  let baselineReplayEventCount = 0;
  let preBaselineEventCount = 0;
  let ambiguousBoundaryEventCount = 0;
  let legacyFallbackCount = 0;
  for (const key of allKeys) {
    const baseline = baselineByKey.get(key);
    const cardEvents = validEventsByKey.get(key) ?? [];
    const seedId = cardEvents[0]?.itemId ?? baseline?.lastItemId;
    const seedItem = seedId ? makeItemFromId(seedId) : null;
    if (!seedItem) {
      if (baseline) finalStates.push(structuredClone(baseline));
      continue;
    }
    const [studentId, ...cardParts] = key.split('::');
    const cardKey = cardParts.join('::');
    const replay = replayCardEvents({ studentId, cardKey, seedItem, events: cardEvents, baseline });
    if (replay.hasDirectEvidence || baseline) finalStates.push(replay.state);
    if (replay.appliedEventIds.length) {
      replayedCardCount++;
      baselineReplayEventCount += replay.appliedEventIds.length;
      if (baseline) baselineAdvancedCardCount++;
    } else if (baseline) legacyFallbackCount++;
    const boundary = baseline?.lastSeenAt ? Date.parse(baseline.lastSeenAt) : Number.NEGATIVE_INFINITY;
    preBaselineEventCount += cardEvents.filter(event => Date.parse(event.createdAt) < boundary).length;
    ambiguousBoundaryEventCount += replay.ambiguousBoundaryEventIds.length;
  }

  const unparseableWithFallback = unparseableEvents.filter(event => {
    if (event.cardKey && baselineByKey.has(`${event.studentId}::${event.cardKey}`)) return true;
    return [...baselineByKey.values()].some(state => state.studentId === event.studentId && state.lastItemId === event.itemId);
  });
  const unparseableWithoutFallback = unparseableEvents.length - unparseableWithFallback.length;
  const validation = validateStates(finalStates);
  const coverage: MigrationCoverage = {
    legacyInputCount: legacy.inputCount,
    convertedLegacyCardCount: legacy.states.length,
    baselineCardCount: baselineByKey.size,
    baselineAdvancedCardCount,
    baselineReplayEventCount,
    preBaselineEventCount,
    ambiguousBoundaryEventCount,
    replayedCardCount,
    legacyFallbackCount,
    collisionCount: legacy.collisionCount,
    unparseableLegacyCount: legacy.unparseable,
    unparseableEventCount: unparseableEvents.length,
    unparseableEventsWithLegacyFallback: unparseableWithFallback.length,
    unparseableEventsWithoutFallback: unparseableWithoutFallback,
    invalidFinalStateCount: validation.invalidCount,
    unexplainedLossCount: legacy.unparseable + unparseableWithoutFallback + validation.invalidCount,
  };
  const studentIds = Array.from(new Set([...finalStates.map(state => state.studentId), ...events.map(event => event.studentId)]));
  return { migrationId: CARD_STATE_REPAIR_MIGRATION_ID, rollbackStates, finalStates, coverage, studentIds };
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

  try {
    const sourceEventCount = await db.mathAnswerEvents.count();
    await db.dataMigrationRuns.put({ id: runId, kind: MIGRATION_KIND, status: 'started', startedAt, sourceEventCount });
    const plan = await buildCardStateRepairPlan();
    if (plan.coverage.unexplainedLossCount > 0) {
      const error = `Migration would lose ${plan.coverage.unexplainedLossCount} scheduler record(s).`;
      await db.dataMigrationRuns.update(runId, { status: 'failed', error, coverage: plan.coverage, completedAt: new Date().toISOString() });
      return { status: 'failed', runId, error, coverage: plan.coverage };
    }
    const backup = await backupCurrentItemStates(runId, plan.rollbackStates);
    const completedAt = new Date().toISOString();
    await db.transaction('rw', db.itemStates, db.dataMigrationRuns, db.migrationBackups, async () => {
      await db.migrationBackups.put(backup);
      await db.itemStates.clear();
      await db.itemStates.bulkPut(plan.finalStates);
      await db.dataMigrationRuns.put({
        id: runId, kind: MIGRATION_KIND, status: 'completed', startedAt, completedAt,
        sourceEventCount, outputCardCount: plan.finalStates.length, coverage: plan.coverage,
      });
    });

    return {
      status: 'completed',
      runId,
      affectedStudentCount: plan.studentIds.length,
      outputCardCount: plan.finalStates.length,
      unparseableEventCount: plan.coverage.unparseableEventCount,
      coverage: plan.coverage,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await rollbackCardStateMigration(runId).catch(() => {});
    await db.dataMigrationRuns.update(runId, { status: 'failed', error, completedAt: new Date().toISOString() });
    return { status: 'failed', runId, error };
  }
}

export type { DataMigrationRun };
