import { describe, it, expect } from 'vitest';
import { validateSnapshot } from '../features/sync/snapshot';
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
    }))).toBe(true);
  });

  it('accepts snapshot with non-empty arrays', () => {
    const snap = validSnapshot({ students: [{ id: 's1' } as never] });
    expect(validateSnapshot(snap)).toBe(true);
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
