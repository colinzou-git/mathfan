import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/dexie';
import {
  runCardStateMigration,
  isCardStateMigrationComplete,
  rollbackCardStateMigration,
  MIGRATION_KIND,
} from '../features/migrations/cardStateMigration';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { LegacyStudentItemState } from '../features/migrations/migrationTypes';

async function clearAll() {
  await db.mathAnswerEvents.clear();
  await db.itemStates.clear();
  await db.migrationBackups.clear();
  await db.dataMigrationRuns.clear();
}

beforeEach(clearAll);
afterEach(clearAll);

function event(overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return {
    id: overrides.id ?? `evt-${Math.random()}`,
    studentId: 's1',
    sessionId: 'sess-1',
    itemId: 'MUL_7x8',
    mode: 'practice',
    promptShown: '7 x 8',
    correctAnswer: 56,
    studentAnswer: 56,
    isCorrect: true,
    isRetry: false,
    hintUsed: false,
    latencyMs: 1000,
    reviewGrade: 'good',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function legacy(itemId = 'MUL_7x8', overrides: Partial<LegacyStudentItemState> = {}): LegacyStudentItemState {
  return {
    studentId: 's1', itemId, skillId: 'g3-mul-tables-basic', attemptCount: 9, correctCount: 7,
    lastAnswer: '56', lastCorrect: true, lastLatencyMs: 1200, medianLatencyMs: 1400, personalBestMs: 900,
    ease: 2.5, stabilityDays: 12, difficulty: .3, fsrsDifficulty: 4.2, reps: 8, lapses: 1,
    masteryLevel: 'strong', lastSeenAt: '2025-12-20T00:00:00.000Z', nextDueAt: '2026-01-20T00:00:00.000Z',
    mistakePatterns: ['mul_add_instead'], ...overrides,
  };
}

async function putSchemaBackup(rows: LegacyStudentItemState[]) {
  await db.migrationBackups.put({ id: 'schema-v7-pre-cardkey-backup', migrationRunId: 'schema-v7-auto-backup', createdAt: '2026-01-01T00:00:00.000Z', itemStates: rows });
}

describe('runCardStateMigration', () => {
  it('replays events into card-keyed itemStates', async () => {
    await db.mathAnswerEvents.bulkPut([
      event({ id: 'e1', itemId: 'MUL_7x8' }),
      event({ id: 'e2', itemId: 'MUL_8x7', createdAt: '2026-01-02T00:00:00.000Z' }),
    ]);

    const result = await runCardStateMigration();

    expect(result.status).toBe('completed');
    const states = await db.itemStates.where('studentId').equals('s1').toArray();
    // Both orientations replay into ONE canonical card, not two.
    expect(states).toHaveLength(1);
    expect(states[0].cardKey).toBe('fact:mul:7x8');
    expect(states[0].reps).toBe(2);
  });

  it('is idempotent — a second run is a no-op once completed', async () => {
    await db.mathAnswerEvents.put(event());
    const first = await runCardStateMigration();
    expect(first.status).toBe('completed');

    const second = await runCardStateMigration();
    expect(second.status).toBe('skipped');
    expect(await isCardStateMigrationComplete()).toBe(true);
  });

  it('records a completed DataMigrationRun with a plausible card count', async () => {
    await db.mathAnswerEvents.bulkPut([
      event({ id: 'e1', itemId: 'MUL_7x8' }),
      event({ id: 'e2', itemId: 'MUL_2x2', createdAt: '2026-01-02T00:00:00.000Z' }),
    ]);

    await runCardStateMigration();

    const runs = await db.dataMigrationRuns.where('kind').equals(MIGRATION_KIND).toArray();
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('completed');
    expect(runs[0].outputCardCount).toBe(2);
    expect(runs[0].sourceEventCount).toBe(2);
  });

  it('excludes retries and unattributed related evidence from the replay, same as a normal rebuild', async () => {
    await db.mathAnswerEvents.bulkPut([
      event({ id: 'e1', itemId: 'MUL_7x8', createdAt: '2026-01-01T00:00:00.000Z' }),
      event({ id: 'e2', itemId: 'MUL_7x8', isRetry: true, createdAt: '2026-01-01T00:00:01.000Z' }),
    ]);

    await runCardStateMigration();

    const states = await db.itemStates.where('studentId').equals('s1').toArray();
    expect(states[0].reps).toBe(1);
    expect(states[0].attemptCount).toBe(1);
  });

  it('does not fabricate a card for a student with zero events', async () => {
    const result = await runCardStateMigration();
    expect(result.status).toBe('completed');
    expect(await db.itemStates.count()).toBe(0);
  });

  it('writes a backup of pre-run itemStates before replaying', async () => {
    await db.mathAnswerEvents.put(event());

    const result = await runCardStateMigration();

    const backups = await db.migrationBackups.where('migrationRunId').equals(result.runId).toArray();
    expect(backups).toHaveLength(1);
    // Fresh schema-v8 itemStates starts empty, so the pre-run backup is empty too.
    expect(backups[0].itemStates).toEqual([]);
  });

  it('preserves legacy-only scheduler rows under canonical keys', async () => {
    await putSchemaBackup([legacy()]);
    const result = await runCardStateMigration();
    expect(result.status).toBe('completed');
    expect(result.coverage).toMatchObject({ legacyInputCount: 1, legacyFallbackCount: 1, unexplainedLossCount: 0 });
    expect(await db.itemStates.get(['s1', 'fact:mul:7x8'])).toMatchObject({
      attemptCount: 9, correctCount: 7, stabilityDays: 12, fsrsDifficulty: 4.2, reps: 8, lapses: 1,
      lastSeenAt: '2025-12-20T00:00:00.000Z', nextDueAt: '2026-01-20T00:00:00.000Z',
      masteryLevel: 'strong', mistakePatterns: ['mul_add_instead'], lastItemId: 'MUL_7x8', cardKey: 'fact:mul:7x8',
    });
  });

  it('keeps legacy-only cards while event replay owns event-backed cards', async () => {
    await putSchemaBackup([legacy(), legacy('MUL_2x3', { attemptCount: 4, reps: 3 })]);
    await db.mathAnswerEvents.put(event());
    const result = await runCardStateMigration();
    expect(result.status).toBe('completed');
    expect(await db.itemStates.count()).toBe(2);
    expect((await db.itemStates.get(['s1', 'fact:mul:7x8']))?.attemptCount).toBe(1);
    expect((await db.itemStates.get(['s1', 'fact:mul:2x3']))?.attemptCount).toBe(4);
  });

  it('merges commutative legacy collisions conservatively', async () => {
    await putSchemaBackup([
      legacy('MUL_7x8'),
      legacy('MUL_8x7', { attemptCount: 11, reps: 10, stabilityDays: 20, nextDueAt: '2026-02-01T00:00:00.000Z', mistakePatterns: ['other'] }),
    ]);
    const result = await runCardStateMigration();
    expect(result.coverage?.collisionCount).toBe(1);
    expect(await db.itemStates.count()).toBe(1);
    expect(await db.itemStates.get(['s1', 'fact:mul:7x8'])).toMatchObject({ attemptCount: 11, reps: 10, stabilityDays: 20, nextDueAt: '2026-02-01T00:00:00.000Z', mistakePatterns: ['mul_add_instead', 'other'] });
  });

  it('fails safely and persists coverage when a legacy row is unparseable', async () => {
    await putSchemaBackup([legacy('REMOVED_ITEM')]);
    const result = await runCardStateMigration();
    expect(result.status).toBe('failed');
    expect(result.coverage).toMatchObject({ unparseableLegacyCount: 1, unexplainedLossCount: 1 });
    expect((await db.dataMigrationRuns.get(result.runId))?.coverage?.unexplainedLossCount).toBe(1);
    expect(await isCardStateMigrationComplete()).toBe(false);
  });

  it('can repair directly from the real schema-v7 backup', async () => {
    await putSchemaBackup([legacy()]);
    const rollback = await rollbackCardStateMigration('schema-v7-auto-backup');
    expect(rollback.ok).toBe(true);
    expect(await db.itemStates.get(['s1', 'fact:mul:7x8'])).toMatchObject({ reps: 8, lastItemId: 'MUL_7x8' });
  });
});

describe('rollbackCardStateMigration', () => {
  it('restores itemStates to the pre-run backup', async () => {
    await db.mathAnswerEvents.put(event());
    const result = await runCardStateMigration();
    expect(await db.itemStates.count()).toBe(1);

    const rollback = await rollbackCardStateMigration(result.runId);

    expect(rollback.ok).toBe(true);
    expect(await db.itemStates.count()).toBe(0);
    const run = await db.dataMigrationRuns.get(result.runId);
    expect(run?.status).toBe('rolled_back');
  });

  it('fails gracefully when no backup exists for the given run id', async () => {
    const result = await rollbackCardStateMigration('nonexistent-run');
    expect(result.ok).toBe(false);
  });
});
