import { describe, expect, it } from 'vitest';
import { buildDailyReviewQueue } from '../features/scheduler/dailyReviewQueue';
import { deriveCardKeyFromItemId } from '../features/scheduler/cardModel';
import type { StudentItemState } from '../types/math';

const NOW = new Date('2026-06-09T00:00:00Z');
const PAST = '2026-06-01T00:00:00Z';
const FUTURE = '2026-12-01T00:00:00Z';

function state(itemId: string, overrides: Partial<StudentItemState> = {}): StudentItemState {
  return {
    studentId: 's', cardKey: deriveCardKeyFromItemId(itemId), lastItemId: itemId, skillId: '',
    attemptCount: 4, correctCount: 3, lastCorrect: true, lastLatencyMs: 0, medianLatencyMs: 0,
    ease: 2.5, stabilityDays: 1, difficulty: 0.3, masteryLevel: 'developing',
    nextDueAt: PAST, mistakePatterns: [],
    ...overrides,
  };
}

const rng = () => 0.5; // deterministic, no shuffling surprises
const ids = (queue: ReturnType<typeof buildDailyReviewQueue>) => queue.map(value => value.itemId);

describe('buildDailyReviewQueue', () => {
  it('presents two canonical cards exactly three times when rounds are requested', () => {
    const queue = buildDailyReviewQueue({
      requestedItemIds: ['MUL_2x3', 'MUL_4x5'], states: new Map(), sessionLength: 6, now: NOW, rng,
      repeatPolicy: 'user_requested_rounds', rounds: 3,
    });
    expect(queue).toHaveLength(6);
    expect(queue.filter(value => value.itemId === 'MUL_2x3')).toHaveLength(3);
    expect(queue.filter(value => value.itemId === 'MUL_4x5')).toHaveLength(3);
    expect(queue.every(value => value.selection.origin === 'due_retrieval')).toBe(true);
  });

  it('folds commutative orientations to one presentation per requested round', () => {
    const queue = buildDailyReviewQueue({
      requestedItemIds: ['MUL_7x8', 'MUL_8x7'], states: new Map(), sessionLength: 6, now: NOW, rng,
      repeatPolicy: 'user_requested_rounds', rounds: 3,
    });
    expect(ids(queue)).toEqual(['MUL_7x8', 'MUL_7x8', 'MUL_7x8']);
  });

  it('produces a reproducible seeded round queue without unrelated backfill', () => {
    const args = { requestedItemIds: ['MUL_2x3', 'MUL_4x5'], states: new Map<string, StudentItemState>(), sessionLength: 8, now: NOW, repeatPolicy: 'user_requested_rounds' as const, rounds: 2 };
    expect(buildDailyReviewQueue({ ...args, rng: () => .25 })).toEqual(buildDailyReviewQueue({ ...args, rng: () => .25 }));
    expect(buildDailyReviewQueue({ ...args, rng: () => .25 })).toHaveLength(4);
  });

  it('includes each requested due card at most once, even if requested twice under different orientations', () => {
    const queue = buildDailyReviewQueue({
      requestedItemIds: ['MUL_7x8', 'MUL_8x7'], // same canonical card
      states: new Map(),
      sessionLength: 5,
      now: NOW,
      rng,
    });
    expect(queue).toHaveLength(1);
  });

  it('does not repeat a due card just to fill sessionLength when no distinct backfill exists', () => {
    const queue = buildDailyReviewQueue({
      requestedItemIds: ['MUL_7x8'],
      states: new Map(),
      sessionLength: 5,
      now: NOW,
      rng,
    });
    expect(ids(queue)).toEqual(['MUL_7x8']);
  });

  it('returns exactly sessionLength when enough distinct requested cards exist', () => {
    const queue = buildDailyReviewQueue({
      requestedItemIds: ['MUL_2x3', 'MUL_4x5', 'MUL_6x7'],
      states: new Map(),
      sessionLength: 2,
      now: NOW,
      rng,
    });
    expect(queue).toHaveLength(2);
    expect(new Set(ids(queue)).size).toBe(2);
  });

  it('backfills with other overdue cards from the student\'s history not in the requested set', () => {
    const s1 = state('MUL_2x2');
    const states = new Map([[s1.cardKey, s1]]);
    const queue = buildDailyReviewQueue({
      requestedItemIds: ['MUL_7x8'],
      states,
      sessionLength: 2,
      now: NOW,
      rng,
    });
    expect(queue).toHaveLength(2);
    expect(ids(queue)).toContain('MUL_7x8');
    expect(ids(queue)).toContain('MUL_2x2');
    expect(queue.find(value => value.itemId === 'MUL_2x2')?.selection).toMatchObject({
      origin: 'due_retrieval', rationaleCodes: ['daily_review_backfill_overdue'],
    });
  });

  it('backfills with weak/developing not-yet-due cards when no more overdue cards remain', () => {
    const weak = state('MUL_2x2', { nextDueAt: FUTURE, masteryLevel: 'learning' });
    const states = new Map([[weak.cardKey, weak]]);
    const queue = buildDailyReviewQueue({
      requestedItemIds: ['MUL_7x8'],
      states,
      sessionLength: 2,
      now: NOW,
      rng,
    });
    expect(ids(queue)).toContain('MUL_2x2');
    expect(queue.find(value => value.itemId === 'MUL_2x2')?.selection).toMatchObject({
      origin: 'weak_skill', rationaleCodes: ['daily_review_backfill_weak'],
    });
  });

  it('does not backfill from a mastered, not-yet-due card', () => {
    const mastered = state('MUL_2x2', { nextDueAt: FUTURE, masteryLevel: 'mastered' });
    const states = new Map([[mastered.cardKey, mastered]]);
    const queue = buildDailyReviewQueue({
      requestedItemIds: ['MUL_7x8'],
      states,
      sessionLength: 2,
      now: NOW,
      rng,
    });
    expect(ids(queue)).not.toContain('MUL_2x2');
    expect(queue).toHaveLength(1);
  });

  it('never backfills a card already present in the requested set', () => {
    const s1 = state('MUL_7x8');
    const states = new Map([[s1.cardKey, s1]]);
    const queue = buildDailyReviewQueue({
      requestedItemIds: ['MUL_7x8'],
      states,
      sessionLength: 3,
      now: NOW,
      rng,
    });
    expect(ids(queue)).toEqual(['MUL_7x8']);
  });

  it('skips unparseable requested ids', () => {
    const queue = buildDailyReviewQueue({
      requestedItemIds: ['NOT_A_REAL_ID', 'MUL_7x8'],
      states: new Map(),
      sessionLength: 5,
      now: NOW,
      rng,
    });
    expect(ids(queue)).toEqual(['MUL_7x8']);
  });
});
