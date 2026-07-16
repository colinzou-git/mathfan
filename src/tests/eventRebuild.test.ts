/**
 * Regression tests for rebuildItemStatesFromEvents.
 *
 * Guards the invariant that diagnostic-mode events (which write FSRS itemState live
 * via recordDiagnosticAnswerWithRetry → recordPracticeAnswer) are replayed when the
 * derived itemStates cache is rebuilt — e.g. after a Drive sync merge / restore / repair.
 * Before the fix the rebuild filtered only mode === 'practice', so diagnostic-derived
 * scheduler state was silently dropped after any merge.
 *
 * The db/dexie module is replaced with a tiny in-memory fake so the test runs without
 * IndexedDB, mirroring the mocking approach used by practiceSession.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { StudentItemState } from '../types/math';

// ── In-memory Dexie fake (hoisted so the vi.mock factory can reference it) ─────

const { fakeDb } = vi.hoisted(() => {
  class FakeQuery<T> {
    table: FakeTable<T>;
    pred: (r: T) => boolean;
    constructor(table: FakeTable<T>, pred: (r: T) => boolean) {
      this.table = table;
      this.pred = pred;
    }
    and(fn: (r: T) => boolean): FakeQuery<T> {
      const prev = this.pred;
      return new FakeQuery(this.table, r => prev(r) && fn(r));
    }
    async toArray(): Promise<T[]> {
      return this.table.rows.filter(this.pred);
    }
    async delete(): Promise<void> {
      this.table.rows = this.table.rows.filter(r => !this.pred(r));
    }
  }

  class FakeTable<T> {
    rows: T[] = [];
    pk: (r: T) => string;
    constructor(pk: (r: T) => string) {
      this.pk = pk;
    }
    async put(row: T): Promise<void> {
      const key = this.pk(row);
      const i = this.rows.findIndex(r => this.pk(r) === key);
      if (i >= 0) this.rows[i] = row;
      else this.rows.push(row);
    }
    async bulkPut(rows: T[]): Promise<void> {
      for (const r of rows) await this.put(r);
    }
    where(field: keyof T): { equals: (val: unknown) => FakeQuery<T> } {
      return {
        equals: (val: unknown) =>
          new FakeQuery<T>(this, r => (r as Record<string, unknown>)[field as string] === val),
      };
    }
  }

  return {
    fakeDb: {
      mathAnswerEvents: new FakeTable<MathAnswerEvent>(e => e.id),
      itemStates: new FakeTable<StudentItemState>(s => `${s.studentId}+${s.cardKey}`),
    },
  };
});

vi.mock('../db/dexie', () => ({ db: fakeDb }));

// ── Imports (after mock) ──────────────────────────────────────────────────────

import { rebuildItemStatesFromEvents } from '../features/learning/eventRebuild';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STUDENT = 'student1';
let nextId = 0;

function makeEvent(overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return {
    id: `evt-${++nextId}`,
    studentId: STUDENT,
    sessionId: 'sess-diag',
    itemId: 'MUL_7x8',
    mode: 'diagnostic',
    promptShown: '7 × 8 = ?',
    correctAnswer: 56,
    studentAnswer: 56,
    isCorrect: true,
    isRetry: false,
    hintUsed: false,
    latencyMs: 2000,
    reviewGrade: 'good',
    createdAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  fakeDb.mathAnswerEvents.rows = [];
  fakeDb.itemStates.rows = [];
  nextId = 0;
});

// ── Diagnostic events rebuild FSRS itemState ──────────────────────────────────

describe('rebuildItemStatesFromEvents — diagnostic events feed FSRS', () => {
  it('replays a diagnostic first-attempt event into itemState', async () => {
    fakeDb.mathAnswerEvents.rows = [makeEvent({ mode: 'diagnostic' })];

    await rebuildItemStatesFromEvents(STUDENT);

    const state = fakeDb.itemStates.rows.find(s => s.cardKey === 'fact:mul:7x8');
    expect(state).toBeDefined();
    expect(state!.reps).toBe(1);
    expect(state!.nextDueAt).toBeTruthy();
    expect(state!.fsrsCardState).toBeDefined();
    expect(state!.fsrsScheduledDays).toBeGreaterThan(0);
    // A correct first review advances mastery off the initial 'new' level.
    expect(state!.masteryLevel).not.toBe('new');
    expect(state!.attemptCount).toBe(1);
    expect(state!.correctCount).toBe(1);
  });

  it('skips diagnostic retry events (only first attempts update the scheduler)', async () => {
    fakeDb.mathAnswerEvents.rows = [
      makeEvent({ id: 'first', mode: 'diagnostic', isCorrect: false, reviewGrade: 'again', isRetry: false, createdAt: '2026-06-01T10:00:00.000Z' }),
      makeEvent({ id: 'retry', mode: 'diagnostic', isCorrect: true, reviewGrade: 'good', isRetry: true, createdAt: '2026-06-01T10:00:05.000Z' }),
    ];

    await rebuildItemStatesFromEvents(STUDENT);

    const state = fakeDb.itemStates.rows.find(s => s.cardKey === 'fact:mul:7x8');
    expect(state).toBeDefined();
    // Only the first attempt was applied — reps stays at 1, not 2.
    expect(state!.reps).toBe(1);
  });

  it('replays practice and diagnostic events for the same item in chronological order', async () => {
    fakeDb.mathAnswerEvents.rows = [
      makeEvent({ id: 'p1', sessionId: 'practice-session', mode: 'practice', createdAt: '2026-06-01T10:00:00.000Z' }),
      makeEvent({ id: 'd1', sessionId: 'diagnostic-session', mode: 'diagnostic', createdAt: '2026-06-02T10:00:00.000Z' }),
    ];

    await rebuildItemStatesFromEvents(STUDENT);

    const state = fakeDb.itemStates.rows.find(s => s.cardKey === 'fact:mul:7x8');
    expect(state).toBeDefined();
    expect(state!.reps).toBe(2);
  });

  it('still excludes quiz events from the FSRS rebuild', async () => {
    fakeDb.mathAnswerEvents.rows = [
      makeEvent({ id: 'q1', mode: 'quiz', createdAt: '2026-06-01T10:00:00.000Z' }),
      makeEvent({ id: 'd1', mode: 'diagnostic', createdAt: '2026-06-02T10:00:00.000Z' }),
    ];

    await rebuildItemStatesFromEvents(STUDENT);

    const state = fakeDb.itemStates.rows.find(s => s.cardKey === 'fact:mul:7x8');
    expect(state).toBeDefined();
    // Quiz event ignored; only the diagnostic event was applied.
    expect(state!.reps).toBe(1);
  });
});

describe('rebuildItemStatesFromEvents — scheduling eligibility', () => {
  it('does not replay an explicitly ineligible repeat presentation', async () => {
    fakeDb.mathAnswerEvents.rows = [
      makeEvent({ id: 'first', schedulingEligible: true }),
      makeEvent({ id: 'repeat', schedulingEligible: false, createdAt: '2026-06-01T10:01:00.000Z' }),
    ];
    await rebuildItemStatesFromEvents(STUDENT);
    expect(fakeDb.itemStates.rows[0].reps).toBe(1);
  });

  it('honors telemetry-only ineligibility', async () => {
    fakeDb.mathAnswerEvents.rows = [
      makeEvent({ id: 'first', schedulingEligible: true }),
      makeEvent({ id: 'repeat', schedulingTelemetry: { schedulingEligible: false } as never, createdAt: '2026-06-01T10:01:00.000Z' }),
    ];
    await rebuildItemStatesFromEvents(STUDENT);
    expect(fakeDb.itemStates.rows[0].reps).toBe(1);
  });

  it('deduplicates legacy same-session card events but applies a later session', async () => {
    fakeDb.mathAnswerEvents.rows = [
      makeEvent({ id: 'legacy-1', sessionId: 'session-a' }),
      makeEvent({ id: 'legacy-2', sessionId: 'session-a', itemId: 'MUL_8x7', createdAt: '2026-06-01T10:01:00.000Z' }),
      makeEvent({ id: 'later', sessionId: 'session-b', createdAt: '2026-06-02T10:00:00.000Z' }),
    ];
    await rebuildItemStatesFromEvents(STUDENT);
    expect(fakeDb.itemStates.rows[0].reps).toBe(2);
  });

  it('does not apply an explicitly ineligible related-evidence nudge', async () => {
    fakeDb.mathAnswerEvents.rows = [
      makeEvent({ id: 'direct', sessionId: 'session-a', schedulingEligible: true }),
      makeEvent({ id: 'related', sessionId: 'session-b', relatedEvidence: true, evidenceSourceItemId: 'AREA_RECT_8x7', studentAnswer: null, reviewGrade: 'hard', schedulingEligible: false, createdAt: '2026-06-02T10:00:00.000Z' }),
    ];
    await rebuildItemStatesFromEvents(STUDENT);
    expect(fakeDb.itemStates.rows[0].reps).toBe(1);
  });
});

// ── mistakePatterns derived cache is rebuilt from wrong first-attempt events ───

describe('rebuildItemStatesFromEvents — misconception tags survive rebuild', () => {
  it('keeps the mistakePatterns tag from a wrong first-attempt event', async () => {
    // 7 × 8 = 56; answering 15 (= 7 + 8) is the addition-confusion misconception.
    fakeDb.mathAnswerEvents.rows = [
      makeEvent({
        id: 'wrong1',
        mode: 'diagnostic',
        itemId: 'MUL_7x8',
        isCorrect: false,
        studentAnswer: 15,
        reviewGrade: 'again',
        isRetry: false,
      }),
    ];

    await rebuildItemStatesFromEvents(STUDENT, { mode: 'strict' });

    const state = fakeDb.itemStates.rows.find(s => s.cardKey === 'fact:mul:7x8');
    expect(state).toBeDefined();
    expect(state!.mistakePatterns).toContain('mul:addition_confusion');
  });

  it('reproduces resolved misconception evidence from canonical events', async () => {
    fakeDb.mathAnswerEvents.rows = [
      makeEvent({
        id: 'fraction-wrong', sessionId: 'fraction-session-1', mode: 'practice',
        itemId: 'FCMP_1_4_1_2', promptShown: 'Compare 1/4 and 1/2',
        correctAnswer: '<', studentAnswer: '>', isCorrect: false, reviewGrade: 'again',
        createdAt: '2026-06-01T10:00:00.000Z',
        detectedMisconceptions: ['fraction:compare_larger_denominator_means_larger'],
      }),
      makeEvent({
        id: 'fraction-correct-1', sessionId: 'fraction-session-2', mode: 'practice',
        itemId: 'FCMP_1_4_1_2', promptShown: 'Compare 1/4 and 1/2',
        correctAnswer: '<', studentAnswer: '<', isCorrect: true, reviewGrade: 'good',
        createdAt: '2026-06-02T10:00:00.000Z',
        confirmedMisconceptions: ['fraction:compare_larger_denominator_means_larger'],
      }),
      makeEvent({
        id: 'fraction-correct-2', sessionId: 'fraction-session-3', mode: 'practice',
        itemId: 'FCMP_1_4_1_2', promptShown: 'Compare 1/4 and 1/2',
        correctAnswer: '<', studentAnswer: '<', isCorrect: true, reviewGrade: 'good',
        createdAt: '2026-06-03T10:00:00.000Z',
        confirmedMisconceptions: ['fraction:compare_larger_denominator_means_larger'],
      }),
    ];

    await rebuildItemStatesFromEvents(STUDENT, { mode: 'strict' });

    const state = fakeDb.itemStates.rows.find(s => s.lastItemId === 'FCMP_1_4_1_2');
    expect(state?.misconceptionEvidence?.[0]).toMatchObject({
      code: 'fraction:compare_larger_denominator_means_larger',
      status: 'resolved',
      confirmingEventIds: ['fraction-correct-1', 'fraction-correct-2'],
    });
    expect(state?.mistakePatterns).toContain('fraction:compare_larger_denominator_means_larger');
  });
});

// ── Related-evidence events: reinforce-only + FSRS-only through a rebuild ──────

describe('rebuildItemStatesFromEvents — related-evidence (cross-skill) events', () => {
  it('applies an indirect nudge AFTER direct history without touching accuracy counts', async () => {
    fakeDb.mathAnswerEvents.rows = [
      makeEvent({ id: 'd1', sessionId: 'direct-session', mode: 'practice', itemId: 'MUL_8x7', isCorrect: true, reviewGrade: 'good', createdAt: '2026-06-01T10:00:00.000Z' }),
      makeEvent({
        id: 'r1', sessionId: 'related-session', mode: 'practice', itemId: 'MUL_8x7',
        relatedEvidence: true, evidenceSourceItemId: 'AREA_RECT_8x7',
        reviewGrade: 'hard', studentAnswer: null, latencyMs: 0,
        createdAt: '2026-06-02T10:00:00.000Z',
      }),
    ];

    await rebuildItemStatesFromEvents(STUDENT);

    const s = fakeDb.itemStates.rows.find(r => r.cardKey === 'fact:mul:7x8')!;
    expect(s).toBeDefined();
    // FSRS advanced for both the direct review and the indirect nudge …
    expect(s.reps).toBe(2);
    // … but only the direct attempt counts toward accuracy/attempts.
    expect(s.attemptCount).toBe(1);
    expect(s.correctCount).toBe(1);
  });

  it('ignores a related-evidence event that has no prior direct history (reinforce-only)', async () => {
    fakeDb.mathAnswerEvents.rows = [
      makeEvent({
        id: 'r1', mode: 'practice', itemId: 'MUL_8x7',
        relatedEvidence: true, evidenceSourceItemId: 'AREA_RECT_8x7',
        reviewGrade: 'hard', studentAnswer: null, createdAt: '2026-06-01T10:00:00.000Z',
      }),
    ];

    await rebuildItemStatesFromEvents(STUDENT);

    // No direct evidence → no fabricated state row.
    expect(fakeDb.itemStates.rows.find(r => r.cardKey === 'fact:mul:7x8')).toBeUndefined();
  });

  it('skips a related-evidence event that precedes the first direct attempt', async () => {
    fakeDb.mathAnswerEvents.rows = [
      makeEvent({
        id: 'r1', mode: 'practice', itemId: 'MUL_8x7',
        relatedEvidence: true, evidenceSourceItemId: 'AREA_RECT_8x7',
        reviewGrade: 'hard', studentAnswer: null, createdAt: '2026-06-01T10:00:00.000Z',
      }),
      makeEvent({ id: 'd1', mode: 'practice', itemId: 'MUL_8x7', isCorrect: true, reviewGrade: 'good', createdAt: '2026-06-02T10:00:00.000Z' }),
    ];

    await rebuildItemStatesFromEvents(STUDENT);

    const s = fakeDb.itemStates.rows.find(r => r.cardKey === 'fact:mul:7x8')!;
    expect(s).toBeDefined();
    // The earlier related event was skipped; only the direct review applied.
    expect(s.reps).toBe(1);
    expect(s.attemptCount).toBe(1);
  });
});

// ── Sync-style regression: merge + rebuild preserves diagnostic FSRS state ─────

describe('rebuildItemStatesFromEvents — sync merge preserves diagnostic FSRS state', () => {
  it('a diagnostic event surviving a merge still rebuilds itemState after the cache is cleared', async () => {
    // Simulate: device recorded a diagnostic event and its live itemState.
    fakeDb.mathAnswerEvents.rows = [makeEvent({ id: 'd1', mode: 'diagnostic' })];
    await rebuildItemStatesFromEvents(STUDENT);
    const live = fakeDb.itemStates.rows.find(s => s.cardKey === 'fact:mul:7x8');
    expect(live).toBeDefined();
    const liveReps = live!.reps;
    const liveDue = live!.nextDueAt;

    // Sync/merge treats itemStates as a derived cache and rebuilds from the event union.
    // Clear the cache (as a strict rebuild/restore would) then rebuild from events alone.
    fakeDb.itemStates.rows = [];
    await rebuildItemStatesFromEvents(STUDENT, { mode: 'strict' });

    const rebuilt = fakeDb.itemStates.rows.find(s => s.cardKey === 'fact:mul:7x8');
    expect(rebuilt).toBeDefined();
    expect(rebuilt!.reps).toBe(liveReps);
    expect(rebuilt!.nextDueAt).toBe(liveDue);
    expect(rebuilt!.fsrsCardState).toBeDefined();
    expect(rebuilt!.fsrsScheduledDays).toBeGreaterThan(0);
  });
});
