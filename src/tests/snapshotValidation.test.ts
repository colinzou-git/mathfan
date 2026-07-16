import { describe, it, expect } from 'vitest';
import { normalizeSnapshot, validateSnapshot } from '../features/sync/snapshot';
import type { AppSnapshot } from '../features/sync/snapshot';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixture = (name: string): unknown => JSON.parse(readFileSync(resolve(process.cwd(), 'src/tests/fixtures/snapshots', name), 'utf8'));

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
  it.each(['v1-valid-item-id-states.json', 'v2-valid-goals.json', 'v3-valid-current.json'])('normalizes immutable backward fixture %s', name => {
    const result = normalizeSnapshot(fixture(name));
    expect(result.problems).toEqual([]);
    expect(result.snapshot?.snapshotVersion).toBe(3);
    expect(result.snapshot?.itemStates.every(state => Boolean(state.cardKey))).toBe(true);
  });
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

  it('imports v2 goal data together with legacy itemId states', () => {
    const result = normalizeSnapshot(validSnapshot({
      snapshotVersion: 2,
      students: [{ id: 's1', displayName: 'Alex' } as never],
      itemStates: [{ studentId: 's1', itemId: 'MUL_7x8', skillId: 'mul', attemptCount: 2, correctCount: 1, lastCorrect: true, lastLatencyMs: 900, medianLatencyMs: 900, ease: 2.5, stabilityDays: 3, difficulty: .2, reps: 2, lapses: 0, masteryLevel: 'learning', mistakePatterns: [] } as never],
      learningGoals: [], goalEvents: [], goalEvaluations: [],
    }));
    expect(result.problems).toEqual([]);
    expect(result.snapshot?.itemStates[0]).toMatchObject({ cardKey: 'fact:mul:7x8', lastItemId: 'MUL_7x8' });
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

describe('normalizeSnapshot — strict external record boundary', () => {
  const profile = { id: 's1', displayName: 'Alex', createdAt: '2026-01-01T00:00:00.000Z', settings: {} } as never;

  it.each([
    ['v3-invalid-attempt-missing-student.json', 'attempts', 'bad-attempt', 'missing_owner'],
    ['v3-invalid-event-date.json', 'mathAnswerEvents', 'bad-event', 'invalid_timestamp'],
    ['v3-invalid-goal-evaluation-response.json', 'goalEvaluations', 'bad-evaluation', 'invalid_answer'],
    ['v3-orphaned-child.json', 'attempts', 'orphan-attempt', 'unknown_student_id'],
  ])('returns precise diagnostics for fixture %s', (name, table, recordId, code) => {
    const result = normalizeSnapshot(fixture(name));
    expect(result.snapshot).toBeUndefined();
    expect(result.problems).toContainEqual(expect.objectContaining({ table, recordId, code, message: expect.any(String) }));
  });

  it.each([
    ['attempts', { id: 'a1', itemId: 'MUL_2x3' }, 'missing_owner'],
    ['sessions', { id: 'session-1', studentId: 's1', startedAt: 'not-a-date' }, 'invalid_timestamp'],
    ['mathAnswerEvents', { id: 'event-1', studentId: 's1', sessionId: 'session-1', itemId: 'MUL_2x3', mode: 'practice', promptShown: '2 × 3', latencyMs: 1, isCorrect: true, isRetry: false, hintUsed: false, createdAt: 'bad' }, 'invalid_timestamp'],
  ] as const)('reports malformed %s rows before merge', (table, row, code) => {
    const raw = validSnapshot({ students: [profile], [table]: [row] } as never);
    const result = normalizeSnapshot(raw);
    expect(result.snapshot).toBeUndefined();
    expect(result.problems).toContainEqual(expect.objectContaining({ table, recordId: expect.any(String), code }));
  });

  it('reports invalid nested goal evaluation answers at the evaluation record', () => {
    const result = normalizeSnapshot(validSnapshot({
      snapshotVersion: 2, students: [profile], learningGoals: [], goalEvents: [],
      goalEvaluations: [{ id: 'evaluation-1', studentId: 's1', status: 'completed', source: 'manual', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', currentQuestionIndex: 1, plannedQuestionCount: 1, itemIds: ['MUL_2x3'], targetSkillIds: [], answers: [{ itemId: 'MUL_2x3' }] }] as never,
    }));
    expect(result.problems).toContainEqual(expect.objectContaining({ table: 'goalEvaluations', recordId: 'evaluation-1', code: 'invalid_answer' }));
  });

  it('rejects v3 cache rows without cardKey instead of treating them as optional legacy caches', () => {
    const result = normalizeSnapshot(validSnapshot({
      snapshotVersion: 3, students: [profile], itemStates: [{ studentId: 's1', itemId: 'REMOVED_ITEM' }] as never,
      learningGoals: [], goalEvents: [], goalEvaluations: [],
    }));
    expect(result.problems).toContainEqual(expect.objectContaining({ table: 'itemStates', code: 'missing_card_key' }));
    expect(result.warnings).toEqual([]);
  });

  it('rejects orphaned child ownership and does not mutate the raw input', () => {
    const raw = validSnapshot({ attempts: [{ id: 'a1', studentId: 'missing', itemId: 'MUL_2x3', skillId: 'mul', sessionId: 'session', promptShown: '2 × 3', correctAnswer: 6, studentAnswer: 6, isCorrect: true, latencyMs: 1, reviewGrade: 'good', createdAt: '2026-01-01T00:00:00Z' }] as never });
    const before = structuredClone(raw);
    const result = normalizeSnapshot(raw);
    expect(result.problems).toContainEqual(expect.objectContaining({ table: 'attempts', recordId: 'a1', code: 'unknown_student_id' }));
    expect(raw).toEqual(before);
  });
});

describe('normalizeSnapshot — practice content contracts', () => {
  it('repairs a single legacy content field in a persisted daily lesson', () => {
    const item = makeItemFromId('FEQ_1_2_4')!;
    const legacyItem = { ...item, contentSpec: undefined };
    const result = normalizeSnapshot(validSnapshot({
      students: [{ id: 's1', displayName: 'Alex' } as never],
      dailyLessonPlans: [{
        id: 'lesson-1', studentId: 's1', localDate: '2026-06-01', timezone: 'UTC',
        plannerVersion: 'legacy', revision: 1, generatedAt: '', updatedAt: '', status: 'planned',
        estimatedMinutes: 1, completedItemInstanceIds: [], warnings: [],
        items: [{ item: legacyItem, cardKey: 'x', segment: 'focus', rationale: 'legacy', schedulingEligible: true }],
      }],
    }));
    expect(result.problems).toEqual([]);
    expect(result.snapshot?.dailyLessonPlans?.[0].items[0].item.contentSpec?.domain).toBe('fraction');
  });

  it('rejects contradictory persisted items with multiple primary legacy specs', () => {
    const fraction = makeItemFromId('FEQ_1_2_4')!;
    const arithmetic = makeItemFromId('ADD_47p28')!;
    const contradictory = {
      ...fraction, contentSpec: undefined, arithmeticSpec: arithmetic.arithmeticSpec,
    };
    const result = normalizeSnapshot(validSnapshot({
      dailyLessonPlans: [{
        id: 'lesson-1', studentId: 's1', localDate: '2026-06-01', timezone: 'UTC',
        plannerVersion: 'legacy', revision: 1, generatedAt: '', updatedAt: '', status: 'planned',
        estimatedMinutes: 1, completedItemInstanceIds: [], warnings: [],
        items: [{ item: contradictory, cardKey: 'x', segment: 'focus', rationale: 'invalid', schedulingEligible: true }],
      }],
    }));
    expect(result.snapshot).toBeUndefined();
    expect(result.problems).toContainEqual(expect.objectContaining({
      table: 'dailyLessonPlans', code: 'invalid_practice_item',
    }));
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
