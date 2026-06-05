import { describe, it, expect } from 'vitest';
import { deriveGrade3SkillSummaries } from '../features/mastery/skillMasteryEngine';
import { makeMultiplicationItem } from '../features/curriculum/multiplicationItems';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { StudentItemState } from '../types/math';

// ── Test helpers ──────────────────────────────────────────────────────────────

let _seq = 0;

function makeEvent(
  studentId: string,
  itemId: string,
  isCorrect: boolean,
  isRetry = false,
): MathAnswerEvent {
  return {
    id: `evt-${++_seq}`,
    studentId,
    sessionId: 'sess-1',
    itemId,
    mode: 'practice',
    promptShown: 'test',
    correctAnswer: 1,
    studentAnswer: isCorrect ? 1 : 0,
    isCorrect,
    isRetry,
    hintUsed: false,
    latencyMs: 1000,
    createdAt: new Date().toISOString(),
  };
}

function makeState(
  studentId: string,
  itemId: string,
  nextDueAt?: string,
  mistakePatterns: string[] = [],
): StudentItemState {
  return {
    studentId,
    itemId,
    skillId: 'any',
    attemptCount: 0,
    correctCount: 0,
    lastCorrect: false,
    lastLatencyMs: 0,
    medianLatencyMs: 0,
    ease: 2.5,
    stabilityDays: 0,
    difficulty: 0.3,
    masteryLevel: 'new',
    mistakePatterns,
    nextDueAt,
  };
}

const NOW = new Date('2026-01-10T12:00:00Z').toISOString();
const PAST = new Date('2026-01-09T12:00:00Z').toISOString(); // yesterday = due
const FUTURE = new Date('2026-01-20T12:00:00Z').toISOString(); // not yet due

// Items used across tests — all Grade 3 multiplication facts
// factA=2, factB=3 → bigTable=3 ≤ 5 → g3-mul-tables-basic
const ITEM_BASIC = makeMultiplicationItem(2, 3);
// factA=7, factB=8 → bigTable=8 > 5 → g3-mul-tables-advanced
const ITEM_ADV = makeMultiplicationItem(7, 8);
// factA=4, factB=5 → bigTable=5 ≤ 5 → also g3-mul-tables-basic
const ITEM_BASIC2 = makeMultiplicationItem(4, 5);

// ── 1. No events → new ────────────────────────────────────────────────────────

describe('status: new', () => {
  it('returns new when there are item states but no events', () => {
    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC],
      mathAnswerEvents: [],
      itemStates: [makeState('s1', ITEM_BASIC.id)],
      now: NOW,
    });

    expect(result).toHaveLength(1);
    expect(result[0].skillId).toBe('g3-mul-tables-basic');
    expect(result[0].status).toBe('new');
    expect(result[0].attemptCount).toBe(0);
    expect(result[0].accuracy).toBe(0);
  });

  it('returns empty array when there are no events and no states', () => {
    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC],
      mathAnswerEvents: [],
      itemStates: [],
      now: NOW,
    });
    expect(result).toHaveLength(0);
  });
});

// ── 2. Weak accuracy → needs_practice ────────────────────────────────────────

describe('status: needs_practice', () => {
  it('returns needs_practice when accuracy < 0.60', () => {
    // 2 correct, 8 wrong → 20% accuracy
    const events = [
      makeEvent('s1', ITEM_BASIC.id, true),
      makeEvent('s1', ITEM_BASIC.id, true),
      ...Array.from({ length: 8 }, () => makeEvent('s1', ITEM_BASIC.id, false)),
    ];

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC],
      mathAnswerEvents: events,
      itemStates: [],
      now: NOW,
    });

    expect(result[0].status).toBe('needs_practice');
    expect(result[0].attemptCount).toBe(10);
    expect(result[0].accuracy).toBeCloseTo(0.2);
  });

  it('needs_practice takes priority over due items', () => {
    // Low accuracy AND a due item state — needs_practice wins
    const events = [makeEvent('s1', ITEM_BASIC.id, false)];
    const state = makeState('s1', ITEM_BASIC.id, PAST);

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC],
      mathAnswerEvents: events,
      itemStates: [state],
      now: NOW,
    });

    expect(result[0].status).toBe('needs_practice');
  });
});

// ── 3. Due item → review_due ──────────────────────────────────────────────────

describe('status: review_due', () => {
  it('returns review_due when accuracy is adequate and an item is past due', () => {
    const events = Array.from({ length: 5 }, () => makeEvent('s1', ITEM_BASIC.id, true));
    const state = makeState('s1', ITEM_BASIC.id, PAST);

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC],
      mathAnswerEvents: events,
      itemStates: [state],
      now: NOW,
    });

    expect(result[0].status).toBe('review_due');
    expect(result[0].dueItemCount).toBe(1);
  });

  it('does not count items whose nextDueAt is in the future', () => {
    const events = Array.from({ length: 5 }, () => makeEvent('s1', ITEM_BASIC.id, true));
    const state = makeState('s1', ITEM_BASIC.id, FUTURE);

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC],
      mathAnswerEvents: events,
      itemStates: [state],
      now: NOW,
    });

    // Not due yet → falls through to mastered (5 attempts, 100% accuracy)
    expect(result[0].dueItemCount).toBe(0);
    expect(result[0].status).toBe('mastered');
  });

  it('does not count items with no nextDueAt as due', () => {
    const events = Array.from({ length: 5 }, () => makeEvent('s1', ITEM_BASIC.id, true));
    const state = makeState('s1', ITEM_BASIC.id, undefined); // no scheduled date

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC],
      mathAnswerEvents: events,
      itemStates: [state],
      now: NOW,
    });

    expect(result[0].dueItemCount).toBe(0);
  });
});

// ── 4. High accuracy → strong / mastered ─────────────────────────────────────

describe('status: strong and mastered', () => {
  it('returns mastered when accuracy ≥ 0.90 and attempts ≥ 5', () => {
    const events = Array.from({ length: 10 }, () => makeEvent('s1', ITEM_BASIC.id, true));

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC],
      mathAnswerEvents: events,
      itemStates: [],
      now: NOW,
    });

    expect(result[0].status).toBe('mastered');
    expect(result[0].accuracy).toBe(1);
    expect(result[0].correctCount).toBe(10);
  });

  it('returns strong when accuracy ≥ 0.60 but attempts < 5 (not yet mastered)', () => {
    // 3 correct, 1 wrong → 75% accuracy, only 4 attempts
    const events = [
      ...Array.from({ length: 3 }, () => makeEvent('s1', ITEM_BASIC.id, true)),
      makeEvent('s1', ITEM_BASIC.id, false),
    ];

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC],
      mathAnswerEvents: events,
      itemStates: [],
      now: NOW,
    });

    expect(result[0].status).toBe('strong');
  });

  it('returns strong when accuracy is exactly 0.75 with enough attempts', () => {
    // 15 correct, 5 wrong → 75% accuracy, not mastered
    const events = [
      ...Array.from({ length: 15 }, () => makeEvent('s1', ITEM_BASIC.id, true)),
      ...Array.from({ length: 5 }, () => makeEvent('s1', ITEM_BASIC.id, false)),
    ];

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC],
      mathAnswerEvents: events,
      itemStates: [],
      now: NOW,
    });

    expect(result[0].status).toBe('strong');
    expect(result[0].accuracy).toBeCloseTo(0.75);
  });

  it('retry events are excluded from attempt count', () => {
    const events = [
      makeEvent('s1', ITEM_BASIC.id, true, false),  // first attempt (counts)
      makeEvent('s1', ITEM_BASIC.id, true, true),   // retry (excluded)
      makeEvent('s1', ITEM_BASIC.id, false, true),  // retry (excluded)
    ];

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC],
      mathAnswerEvents: events,
      itemStates: [],
      now: NOW,
    });

    // Only 1 first attempt counted
    expect(result[0].attemptCount).toBe(1);
    expect(result[0].status).toBe('strong'); // 1 attempt < 5, so not mastered
  });
});

// ── 5. Multiple items map to same skill ───────────────────────────────────────

describe('multiple items mapping to same skill', () => {
  it('groups events from multiple items under one skillId', () => {
    // ITEM_BASIC (2×3) and ITEM_BASIC2 (4×5) both → g3-mul-tables-basic
    const events = [
      ...Array.from({ length: 6 }, () => makeEvent('s1', ITEM_BASIC.id, true)),
      ...Array.from({ length: 4 }, () => makeEvent('s1', ITEM_BASIC2.id, true)),
    ];

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC, ITEM_BASIC2],
      mathAnswerEvents: events,
      itemStates: [],
      now: NOW,
    });

    expect(result).toHaveLength(1);
    expect(result[0].skillId).toBe('g3-mul-tables-basic');
    expect(result[0].attemptCount).toBe(10);
    expect(result[0].itemCount).toBe(2);
    expect(result[0].status).toBe('mastered'); // 10 attempts, 100% accuracy
  });

  it('produces separate summaries for items that map to different skills', () => {
    // ITEM_BASIC → g3-mul-tables-basic, ITEM_ADV → g3-mul-tables-advanced
    const events = [
      ...Array.from({ length: 5 }, () => makeEvent('s1', ITEM_BASIC.id, true)),
      ...Array.from({ length: 3 }, () => makeEvent('s1', ITEM_ADV.id, true)),
    ];

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC, ITEM_ADV],
      mathAnswerEvents: events,
      itemStates: [],
      now: NOW,
    });

    expect(result).toHaveLength(2);
    const basic = result.find(r => r.skillId === 'g3-mul-tables-basic');
    const advanced = result.find(r => r.skillId === 'g3-mul-tables-advanced');
    expect(basic).toBeDefined();
    expect(basic!.attemptCount).toBe(5);
    expect(advanced).toBeDefined();
    expect(advanced!.attemptCount).toBe(3);
  });

  it('collects mistakePatterns from all item states for the same skill', () => {
    const state1 = makeState('s1', ITEM_BASIC.id, undefined, ['skips_twos']);
    const state2 = makeState('s1', ITEM_BASIC2.id, undefined, ['skips_twos', 'reversal']);

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC, ITEM_BASIC2],
      mathAnswerEvents: [],
      itemStates: [state1, state2],
      now: NOW,
    });

    expect(result[0].mistakePatterns).toContain('skips_twos');
    expect(result[0].mistakePatterns).toContain('reversal');
    // deduplicated — 'skips_twos' appears in both states but only once in output
    expect(result[0].mistakePatterns.filter(p => p === 'skips_twos')).toHaveLength(1);
  });
});

// ── Resolver function variant ─────────────────────────────────────────────────

describe('item resolver function', () => {
  it('accepts a resolver function instead of an array', () => {
    const itemMap = new Map([
      [ITEM_BASIC.id, ITEM_BASIC],
      [ITEM_ADV.id, ITEM_ADV],
    ]);
    const resolver = (itemId: string) => itemMap.get(itemId) ?? null;

    const events = [
      ...Array.from({ length: 5 }, () => makeEvent('s1', ITEM_BASIC.id, true)),
    ];

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: resolver,
      mathAnswerEvents: events,
      itemStates: [],
      now: NOW,
    });

    expect(result).toHaveLength(1);
    expect(result[0].skillId).toBe('g3-mul-tables-basic');
    expect(result[0].status).toBe('mastered');
  });
});

// ── Student isolation ─────────────────────────────────────────────────────────

describe('student isolation', () => {
  it('ignores events and states belonging to other students', () => {
    const events = [
      makeEvent('s1', ITEM_BASIC.id, true),
      makeEvent('s2', ITEM_BASIC.id, true), // different student
    ];
    const states = [
      makeState('s2', ITEM_BASIC.id), // different student
    ];

    const result = deriveGrade3SkillSummaries({
      studentId: 's1',
      items: [ITEM_BASIC],
      mathAnswerEvents: events,
      itemStates: states,
      now: NOW,
    });

    expect(result).toHaveLength(1);
    expect(result[0].attemptCount).toBe(1); // only s1's event
  });
});
