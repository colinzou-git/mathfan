import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { db } from '../db/dexie';
import {
  runCardStateMigration,
  isCardStateMigrationComplete,
  rollbackCardStateMigration,
  repairLegacyWordProblemCardStates,
  migrateLegacyState,
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

it('repairs exact-instance word cards conservatively into one schema card', async () => {
  const first = legacy('WORD_eg_2_3', { reps: 3, attemptCount: 3 });
  const second = legacy('WORD_eg_4_5', { reps: 5, attemptCount: 5 });
  await db.itemStates.bulkPut([
    { ...first, cardKey: 'template:WORD_eg_2_3', lastItemId: 'WORD_eg_2_3' },
    { ...second, cardKey: 'template:WORD_eg_4_5', lastItemId: 'WORD_eg_4_5' },
  ]);

  expect(await repairLegacyWordProblemCardStates()).toBe(2);
  const states = await db.itemStates.toArray();
  expect(states).toHaveLength(1);
  expect(states[0]).toMatchObject({ cardKey: 'template:g3-word:equal-groups-result', reps: 5, attemptCount: 5 });
});

async function createRealV6Database(rows: LegacyStudentItemState[]) {
  db.close();
  await Dexie.delete('mathfan');
  const legacyDb = new Dexie('mathfan');
  legacyDb.version(1).stores({
    students: 'id, displayName',
    itemStates: '[studentId+itemId], studentId, skillId, nextDueAt, masteryLevel',
    attempts: 'id, studentId, itemId, sessionId, createdAt',
    sessions: 'id, studentId, startedAt, mode',
  });
  legacyDb.version(2).stores({ attempts: 'id, studentId, itemId, sessionId, createdAt, [studentId+createdAt]' });
  legacyDb.version(3).stores({
    multFactStats: '[studentId+key], studentId',
    quizSessions: 'id, studentId, startedAt',
  });
  legacyDb.version(4).stores({ mathAnswerEvents: 'id, studentId, sessionId, mode, createdAt, [studentId+createdAt]' });
  legacyDb.version(5).stores({
    learningGoals: 'id, studentId, status, targetDate, updatedAt, [studentId+status]',
    goalEvents: 'id, studentId, goalId, type, createdAt, [studentId+createdAt]',
    goalEvaluations: 'id, studentId, status, updatedAt',
  });
  legacyDb.version(6).stores({ students: 'id, learnerKey, displayName' });
  await legacyDb.open();
  await legacyDb.table('itemStates').bulkPut(rows);
  legacyDb.close();
  await db.open();
}

async function createRealV7Database(rows: LegacyStudentItemState[]) {
  db.close();
  await Dexie.delete('mathfan');
  const legacyDb = new Dexie('mathfan');
  legacyDb.version(7).stores({
    students: 'id, learnerKey, displayName',
    attempts: 'id, studentId, itemId, sessionId, createdAt, [studentId+createdAt]',
    sessions: 'id, studentId, startedAt, mode',
    multFactStats: '[studentId+key], studentId',
    quizSessions: 'id, studentId, startedAt',
    mathAnswerEvents: 'id, studentId, sessionId, mode, createdAt, [studentId+createdAt]',
    learningGoals: 'id, studentId, status, targetDate, updatedAt, [studentId+status]',
    goalEvents: 'id, studentId, goalId, type, createdAt, [studentId+createdAt]',
    goalEvaluations: 'id, studentId, status, updatedAt',
    migrationBackups: 'id, migrationRunId, createdAt',
    dataMigrationRuns: 'id, kind, status, startedAt',
  });
  await legacyDb.open();
  await legacyDb.table('migrationBackups').put({
    id: 'schema-v7-pre-cardkey-backup',
    migrationRunId: 'schema-v7-auto-backup',
    createdAt: '2026-01-01T00:00:00.000Z',
    itemStates: rows,
  });
  legacyDb.close();
  await db.open();
}

describe('runCardStateMigration', () => {
  it('replays events into card-keyed itemStates', async () => {
    await db.mathAnswerEvents.bulkPut([
      event({ id: 'e1', itemId: 'MUL_7x8' }),
      event({ id: 'e2', sessionId: 'sess-2', itemId: 'MUL_8x7', createdAt: '2026-01-02T00:00:00.000Z' }),
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
    const runBackup = await db.migrationBackups.where('migrationRunId').equals(result.runId).first();
    expect(runBackup?.itemStates).toEqual([expect.objectContaining({ cardKey: 'fact:mul:7x8', reps: 8 })]);
  });

  it('keeps a legacy baseline and applies only newer event deltas', async () => {
    await putSchemaBackup([legacy(), legacy('MUL_2x3', { attemptCount: 4, reps: 3 })]);
    await db.mathAnswerEvents.put(event());
    const result = await runCardStateMigration();
    expect(result.status).toBe('completed');
    expect(await db.itemStates.count()).toBe(2);
    expect(await db.itemStates.get(['s1', 'fact:mul:7x8'])).toMatchObject({ attemptCount: 10, reps: 9 });
    expect((await db.itemStates.get(['s1', 'fact:mul:2x3']))?.attemptCount).toBe(4);
  });

  it('preserves 20 legacy reviews and applies two strictly newer events', async () => {
    await putSchemaBackup([legacy('MUL_7x8', {
      attemptCount: 20, correctCount: 18, reps: 20,
      lastSeenAt: '2026-06-01T00:00:00.000Z', nextDueAt: '2026-07-01T00:00:00.000Z',
    })]);
    await db.mathAnswerEvents.bulkPut([
      event({ id: 'newer-1', sessionId: 's-new-1', createdAt: '2026-06-10T00:00:00.000Z' }),
      event({ id: 'newer-2', sessionId: 's-new-2', createdAt: '2026-06-20T00:00:00.000Z' }),
    ]);
    const result = await runCardStateMigration();
    expect(result.status).toBe('completed');
    expect(result.coverage).toMatchObject({ baselineAdvancedCardCount: 1, baselineReplayEventCount: 2 });
    expect(await db.itemStates.get(['s1', 'fact:mul:7x8'])).toMatchObject({ attemptCount: 22, correctCount: 20, reps: 22 });
  });

  it('does not replay events older than or equal to the baseline boundary', async () => {
    await putSchemaBackup([legacy('MUL_7x8', { attemptCount: 8, reps: 8, lastSeenAt: '2026-06-10T00:00:00.000Z' })]);
    await db.mathAnswerEvents.bulkPut([
      event({ id: 'older', sessionId: 'old', createdAt: '2026-06-01T00:00:00.000Z' }),
      event({ id: 'equal', sessionId: 'equal', createdAt: '2026-06-10T00:00:00.000Z' }),
    ]);
    const result = await runCardStateMigration();
    expect(result.coverage).toMatchObject({ preBaselineEventCount: 1, ambiguousBoundaryEventCount: 1, baselineReplayEventCount: 0 });
    expect(await db.itemStates.get(['s1', 'fact:mul:7x8'])).toMatchObject({ attemptCount: 8, reps: 8 });
  });

  it('fails without mutating itemStates when an unparseable event has no fallback', async () => {
    const current = migrateLegacyState(legacy('MUL_2x3'));
    if ('problem' in current) throw new Error(current.problem);
    await db.itemStates.put(current);
    const before = structuredClone(await db.itemStates.toArray());
    await db.mathAnswerEvents.put(event({ itemId: 'REMOVED_ITEM', id: 'lost-event' }));
    const result = await runCardStateMigration();
    expect(result.status).toBe('failed');
    expect(result.coverage).toMatchObject({ unparseableEventsWithoutFallback: 1, unexplainedLossCount: 1 });
    expect(await db.itemStates.toArray()).toEqual(before);
  });

  it('allows an unparseable event when a legacy baseline explicitly covers its card', async () => {
    await putSchemaBackup([legacy()]);
    await db.mathAnswerEvents.put(event({ itemId: 'REMOVED_ITEM', id: 'covered-event', cardKey: 'fact:mul:7x8' }));
    const result = await runCardStateMigration();
    expect(result.status).toBe('completed');
    expect(result.coverage).toMatchObject({ unparseableEventsWithLegacyFallback: 1, unexplainedLossCount: 0 });
    expect(await db.itemStates.get(['s1', 'fact:mul:7x8'])).toMatchObject({ reps: 8, attemptCount: 9 });
  });

  it('runs v3 once even when older migration kinds are completed', async () => {
    await db.dataMigrationRuns.bulkPut([
      { id: 'v1', kind: 'hybrid-card-v1', status: 'completed', startedAt: '2026-01-01T00:00:00.000Z', sourceEventCount: 0 },
      { id: 'v2', kind: 'semantic-word-cards-v2', status: 'completed', startedAt: '2026-01-02T00:00:00.000Z', sourceEventCount: 0 },
    ]);
    await putSchemaBackup([legacy()]);
    expect((await runCardStateMigration()).status).toBe('completed');
    expect((await runCardStateMigration()).status).toBe('skipped');
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

describe('real IndexedDB schema upgrade', () => {
  it('upgrades a v6 database and preserves legacy-only scheduler rows', async () => {
    const row = legacy();
    await createRealV6Database([row]);

    const backup = await db.migrationBackups.get('schema-v7-pre-cardkey-backup');
    expect(backup?.itemStates).toEqual([row]);

    const result = await runCardStateMigration();
    expect(result.status).toBe('completed');
    expect(await db.itemStates.get(['s1', 'fact:mul:7x8'])).toMatchObject({
      attemptCount: 9,
      correctCount: 7,
      stabilityDays: 12,
      fsrsDifficulty: 4.2,
      reps: 8,
      lapses: 1,
      lastSeenAt: '2025-12-20T00:00:00.000Z',
      nextDueAt: '2026-01-20T00:00:00.000Z',
      masteryLevel: 'strong',
      mistakePatterns: ['mul_add_instead'],
      lastItemId: 'MUL_7x8',
      cardKey: 'fact:mul:7x8',
    });
  });

  it('resumes after an interrupted started run and remains idempotent', async () => {
    await createRealV6Database([legacy()]);
    await db.dataMigrationRuns.put({
      id: 'interrupted-run',
      kind: MIGRATION_KIND,
      status: 'started',
      startedAt: '2026-01-01T00:00:00.000Z',
      sourceEventCount: 0,
    });

    const resumed = await runCardStateMigration();
    expect(resumed.status).toBe('completed');
    expect((await db.dataMigrationRuns.get('interrupted-run'))?.status).toBe('failed');
    expect(await db.itemStates.count()).toBe(1);
    expect((await runCardStateMigration()).status).toBe('skipped');
    expect(await db.itemStates.count()).toBe(1);
  });

  it('opens a v7 database and repairs its retained pre-card-key backup', async () => {
    await createRealV7Database([legacy('MUL_7x8'), legacy('MUL_8x7', { reps: 10 })]);

    const result = await runCardStateMigration();
    expect(result.status).toBe('completed');
    expect(result.coverage).toMatchObject({ legacyInputCount: 2, collisionCount: 1, legacyFallbackCount: 1 });
    expect(await db.itemStates.count()).toBe(1);
    expect(await db.itemStates.get(['s1', 'fact:mul:7x8'])).toMatchObject({ reps: 10, lastItemId: 'MUL_7x8' });
  });
});
