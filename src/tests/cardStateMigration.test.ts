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
