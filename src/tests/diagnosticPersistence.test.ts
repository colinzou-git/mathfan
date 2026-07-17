import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/dexie';
import { buildDiagnosticAnswerProposal } from '../features/diagnosis/diagnosticAnswerProposal';
import {
  DiagnosticIdempotencyConflictError,
  DiagnosticStateConflictError,
  flushDiagnosticWriteJobs,
  persistDiagnosticAnswerProposal,
  type DiagnosticAnswerProposal,
  type DiagnosticWriteJob,
} from '../features/diagnosis/diagnosticPersistence';
import { rebuildItemStatesFromEvents } from '../features/learning/eventRebuild';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';

const studentId = 'diagnostic-persistence-student';

function proposal(suffix: string, itemId: string, answer: string): DiagnosticAnswerProposal {
  const item = makeItemFromId(itemId)!;
  return buildDiagnosticAnswerProposal({
    eventId: `event-${suffix}`,
    attemptId: `attempt-${suffix}`,
    answeredAt: `2026-07-16T08:00:0${suffix}.000Z`,
    studentId,
    sessionId: 'diagnostic-session',
    item,
    rawInput: answer,
    latencyMs: 1200,
  });
}

beforeAll(async () => { if (!db.isOpen()) await db.open(); });
beforeEach(async () => {
  await Promise.all([db.mathAnswerEvents.clear(), db.attempts.clear(), db.itemStates.clear()]);
});

describe('diagnostic immutable answer persistence', () => {
  it('retains partial success and retries only the unsaved job without changing saved FSRS states', async () => {
    const proposals = [proposal('1', 'MUL_2x4', '8'), proposal('2', 'MUL_3x4', '12'), proposal('3', 'MUL_5x4', '20')];
    const stale = proposals[2];
    await db.itemStates.put({ ...stale.stateBefore, attemptCount: 1 });
    const jobs: DiagnosticWriteJob[] = proposals.map(value => ({
      id: value.event.id,
      proposal: value,
      status: 'pending',
    }));

    expect(await flushDiagnosticWriteJobs(jobs)).toBe(1);
    expect(jobs.map(job => job.status)).toEqual(['saved', 'saved', 'failed']);
    const firstState = await db.itemStates.get([studentId, proposals[0].expectedStateRevision.cardKey]);
    const secondState = await db.itemStates.get([studentId, proposals[1].expectedStateRevision.cardKey]);

    await db.itemStates.delete([studentId, stale.expectedStateRevision.cardKey]);
    expect(await flushDiagnosticWriteJobs(jobs)).toBe(0);
    expect(jobs.map(job => job.status)).toEqual(['saved', 'saved', 'saved']);
    expect(await db.itemStates.get([studentId, proposals[0].expectedStateRevision.cardKey])).toEqual(firstState);
    expect(await db.itemStates.get([studentId, proposals[1].expectedStateRevision.cardKey])).toEqual(secondState);
    expect(firstState?.reps).toBe(1);
    expect(secondState?.reps).toBe(1);
  });

  it('treats the same saved proposal as a no-op even after card state changes', async () => {
    const value = proposal('1', 'MUL_2x4', '8');
    await persistDiagnosticAnswerProposal(value);
    const newer = { ...(await db.itemStates.get([studentId, value.expectedStateRevision.cardKey]))!, attemptCount: 9 };
    await db.itemStates.put(newer);
    await persistDiagnosticAnswerProposal(value);
    expect(await db.mathAnswerEvents.count()).toBe(1);
    expect(await db.attempts.count()).toBe(1);
    expect(await db.itemStates.get([studentId, value.expectedStateRevision.cardKey])).toEqual(newer);
  });

  it('rejects the same event ID with a different causal fingerprint', async () => {
    const value = proposal('1', 'MUL_2x4', '8');
    await persistDiagnosticAnswerProposal(value);
    await expect(persistDiagnosticAnswerProposal({
      ...value,
      event: { ...value.event, latencyMs: value.event.latencyMs + 1 },
    })).rejects.toBeInstanceOf(DiagnosticIdempotencyConflictError);
  });

  it('rejects stale card state atomically', async () => {
    const value = proposal('1', 'MUL_2x4', '8');
    await db.itemStates.put({ ...value.stateBefore, reps: 2, attemptCount: 2 });
    await expect(persistDiagnosticAnswerProposal(value)).rejects.toBeInstanceOf(DiagnosticStateConflictError);
    expect(await db.mathAnswerEvents.count()).toBe(0);
    expect(await db.attempts.count()).toBe(0);
    expect((await db.itemStates.get([studentId, value.expectedStateRevision.cardKey]))?.reps).toBe(2);
  });

  it('rolls back the event and state when a transaction write fails', async () => {
    const value = proposal('1', 'MUL_2x4', '8');
    const invalid = { ...value, attempt: { ...value.attempt, id: undefined } } as unknown as DiagnosticAnswerProposal;
    await expect(persistDiagnosticAnswerProposal(invalid)).rejects.toThrow();
    expect(await db.mathAnswerEvents.count()).toBe(0);
    expect(await db.attempts.count()).toBe(0);
    expect(await db.itemStates.count()).toBe(0);
  });

  it('rebuilds the same live state using the immutable answeredAt timestamp', async () => {
    const value = proposal('1', 'MUL_2x4', '8');
    await persistDiagnosticAnswerProposal(value);
    const live = await db.itemStates.get([studentId, value.expectedStateRevision.cardKey]);
    await db.itemStates.clear();
    await rebuildItemStatesFromEvents(studentId, { mode: 'strict' });
    expect(await db.itemStates.get([studentId, value.expectedStateRevision.cardKey])).toEqual(live);
  });
});
