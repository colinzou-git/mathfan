import { describe, it, expect } from 'vitest';
import { normalizeSnapshot, validateSnapshot } from '../features/sync/snapshot';
import type { AppSnapshot } from '../features/sync/snapshot';

function validSnapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    appId: 'mathfan',
    snapshotVersion: 1,
    snapshotAt: new Date().toISOString(),
    students: [],
    itemStates: [],
    attempts: [],
    sessions: [],
    ...overrides,
  };
}

function without(snap: AppSnapshot, key: keyof AppSnapshot): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...snap };
  delete copy[key];
  return copy;
}

// ── valid snapshots ────────────────────────────────────────────────────────────

describe('validateSnapshot — valid inputs', () => {
  it('accepts a minimal valid snapshot', () => {
    expect(validateSnapshot(validSnapshot())).toBe(true);
  });

  it('accepts snapshot with optional arrays present', () => {
    expect(validateSnapshot(validSnapshot({
      multFactStats: [],
      quizSessions: [],
      mathAnswerEvents: [],
      dailyLessonPlans: [],
    }))).toBe(true);
  });

  it('accepts snapshot with non-empty arrays', () => {
    const snap = validSnapshot({ students: [{ id: 's1', displayName: 'Alex' } as never] });
    expect(validateSnapshot(snap)).toBe(true);
  });
});

describe('normalizeSnapshot — legacy card compatibility', () => {
  it('converts a v1 itemId state and canonicalizes multiplication orientation', () => {
    const raw = validSnapshot({
      students: [{ id: 's1', displayName: 'Alex' } as never],
      itemStates: [{ studentId: 's1', itemId: 'MUL_8x7', skillId: 'mul', attemptCount: 4, correctCount: 3, lastCorrect: true, lastLatencyMs: 900, medianLatencyMs: 1000, ease: 2.5, stabilityDays: 8, difficulty: .2, reps: 4, lapses: 1, masteryLevel: 'strong', mistakePatterns: [] } as never],
    });
    const result = normalizeSnapshot(raw);
    expect(result.problems).toEqual([]);
    expect(result.snapshot?.snapshotVersion).toBe(3);
    expect(result.snapshot?.itemStates[0]).toMatchObject({ cardKey: 'fact:mul:7x8', lastItemId: 'MUL_8x7', attemptCount: 4, reps: 4 });
  });

  it('merges mixed legacy orientations deterministically', () => {
    const base = { studentId: 's1', skillId: 'mul', correctCount: 1, lastCorrect: true, lastLatencyMs: 900, medianLatencyMs: 900, ease: 2.5, difficulty: .2, lapses: 0, masteryLevel: 'learning', mistakePatterns: [] };
    const result = normalizeSnapshot(validSnapshot({ students: [{ id: 's1', displayName: 'Alex' } as never], itemStates: [
      { ...base, itemId: 'MUL_7x8', attemptCount: 2, stabilityDays: 3, reps: 2 },
      { ...base, itemId: 'MUL_8x7', attemptCount: 5, stabilityDays: 9, reps: 5 },
    ] as never }));
    expect(result.snapshot?.itemStates).toHaveLength(1);
    expect(result.snapshot?.itemStates[0]).toMatchObject({ cardKey: 'fact:mul:7x8', attemptCount: 5, stabilityDays: 9, reps: 5 });
  });

  it('reports and skips an unparseable optional legacy cache row', () => {
    const result = normalizeSnapshot(validSnapshot({ itemStates: [{ studentId: 's1', itemId: 'REMOVED_ITEM' }] as never }));
    expect(result.problems).toEqual([]);
    expect(result.warnings).toEqual([expect.objectContaining({ table: 'itemStates', code: 'unparseable_legacy_item', recordId: 'REMOVED_ITEM' })]);
    expect(result.snapshot?.itemStates).toEqual([]);
  });

  it('returns structural problems before any merge is possible', () => {
    const result = normalizeSnapshot({ appId: 'mathfan', snapshotVersion: 1, students: [] });
    expect(result.snapshot).toBeUndefined();
    expect(result.problems.map(problem => problem.code)).toContain('missing_array');
  });
});

// ── wrong appId / version ──────────────────────────────────────────────────────

describe('validateSnapshot — wrong appId', () => {
  it('rejects appId that is not "mathfan"', () => {
    expect(validateSnapshot(validSnapshot({ appId: 'other' as never }))).toBe(false);
  });

  it('rejects missing appId', () => {
    expect(validateSnapshot(without(validSnapshot(), 'appId'))).toBe(false);
  });
});

describe('validateSnapshot — wrong snapshotVersion', () => {
  it('accepts version 2 when goal arrays are present', () => {
    expect(validateSnapshot(validSnapshot({
      snapshotVersion: 2,
      learningGoals: [],
      goalEvents: [],
      goalEvaluations: [],
    }))).toBe(true);
  });

  it('rejects version 0', () => {
    expect(validateSnapshot(validSnapshot({ snapshotVersion: 0 as never }))).toBe(false);
  });

  it('rejects string version "1"', () => {
    expect(validateSnapshot(validSnapshot({ snapshotVersion: '1' as never }))).toBe(false);
  });
});

// ── missing required arrays ────────────────────────────────────────────────────

describe('validateSnapshot — missing required arrays', () => {
  it('rejects snapshot without students array', () => {
    expect(validateSnapshot(without(validSnapshot(), 'students'))).toBe(false);
  });

  it('rejects snapshot without itemStates array', () => {
    expect(validateSnapshot(without(validSnapshot(), 'itemStates'))).toBe(false);
  });

  it('rejects snapshot without attempts array', () => {
    expect(validateSnapshot(without(validSnapshot(), 'attempts'))).toBe(false);
  });

  it('rejects snapshot without sessions array', () => {
    expect(validateSnapshot(without(validSnapshot(), 'sessions'))).toBe(false);
  });

  it('rejects when a required array is replaced by null', () => {
    expect(validateSnapshot(validSnapshot({ students: null as never }))).toBe(false);
  });

  it('rejects when a required array is replaced by a non-array object', () => {
    expect(validateSnapshot(validSnapshot({ students: {} as never }))).toBe(false);
  });
});

// ── non-object / null inputs ───────────────────────────────────────────────────

describe('validateSnapshot — non-object inputs', () => {
  it('rejects null', () => {
    expect(validateSnapshot(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateSnapshot(undefined)).toBe(false);
  });

  it('rejects a plain string', () => {
    expect(validateSnapshot('{"appId":"mathfan"}')).toBe(false);
  });

  it('rejects a number', () => {
    expect(validateSnapshot(42)).toBe(false);
  });

  it('rejects an empty object', () => {
    expect(validateSnapshot({})).toBe(false);
  });
});

// ── optional fields are truly optional ────────────────────────────────────────

describe('validateSnapshot — optional fields absent', () => {
  it('accepts snapshot without multFactStats (pre-quiz format)', () => {
    expect(validateSnapshot(without(validSnapshot(), 'multFactStats'))).toBe(true);
  });

  it('accepts snapshot without quizSessions', () => {
    expect(validateSnapshot(without(validSnapshot(), 'quizSessions'))).toBe(true);
  });

  it('accepts snapshot without mathAnswerEvents', () => {
    expect(validateSnapshot(without(validSnapshot(), 'mathAnswerEvents'))).toBe(true);
  });

  it('accepts version 1 without goal arrays', () => {
    expect(validateSnapshot(validSnapshot({ snapshotVersion: 1 }))).toBe(true);
  });

  it('rejects version 2 without goal arrays', () => {
    expect(validateSnapshot(validSnapshot({ snapshotVersion: 2 }))).toBe(false);
  });
});
