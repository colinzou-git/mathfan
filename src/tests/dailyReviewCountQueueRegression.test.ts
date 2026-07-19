import { describe, expect, it } from 'vitest';
import { buildDailyReviewQueue } from '../features/scheduler/dailyReviewQueue';
import { deriveCardKeyFromItemId } from '../features/scheduler/cardModel';
import type { StudentItemState } from '../types/math';

const NOW = new Date('2026-07-18T12:00:00Z');
const PAST = '2026-07-17T12:00:00Z';
const FUTURE = '2026-08-18T12:00:00Z';
const rng = () => 0.5;

function state(itemId: string, overrides: Partial<StudentItemState> = {}): StudentItemState {
  return {
    studentId: 'student',
    cardKey: deriveCardKeyFromItemId(itemId),
    lastItemId: itemId,
    skillId: 'g3-mul-facts',
    attemptCount: 4,
    correctCount: 3,
    lastCorrect: true,
    lastLatencyMs: 1000,
    medianLatencyMs: 1100,
    ease: 2.5,
    stabilityDays: 3,
    difficulty: 0.3,
    reps: 4,
    lapses: 0,
    masteryLevel: 'developing',
    lastSeenAt: '2026-07-17T11:00:00Z',
    nextDueAt: PAST,
    mistakePatterns: [],
    ...overrides,
  };
}

describe('daily review canonical count regression', () => {
  it('does not queue a stale due alias when the exact canonical row is future-due', () => {
    const itemId = 'MUL_7x8';
    const canonicalKey = deriveCardKeyFromItemId(itemId);
    const alias = state(itemId, {
      cardKey: 'legacy:mul:7x8',
      nextDueAt: PAST,
      lastSeenAt: '2026-07-17T11:30:00Z',
    });
    const completed = state(itemId, {
      cardKey: canonicalKey,
      nextDueAt: FUTURE,
      lastSeenAt: '2026-07-17T10:00:00Z',
    });

    const queue = buildDailyReviewQueue({
      requestedItemIds: [itemId],
      states: new Map([
        [alias.cardKey, alias],
        [completed.cardKey, completed],
      ]),
      sessionLength: 1,
      now: NOW,
      rng,
      repeatPolicy: 'user_requested_rounds',
      rounds: 1,
    });

    expect(queue).toEqual([]);
  });

  it('backfills one item per canonical card even when the cache contains aliases', () => {
    const aliases = [
      state('MUL_7x8', { cardKey: 'legacy:7x8:a' }),
      state('MUL_8x7', { cardKey: 'legacy:7x8:b' }),
      state('MUL_2x3', { cardKey: 'legacy:2x3:a' }),
      state('MUL_3x2', { cardKey: 'legacy:2x3:b' }),
    ];
    const states = new Map(aliases.map(row => [row.cardKey, row]));

    const queue = buildDailyReviewQueue({
      requestedItemIds: [],
      states,
      sessionLength: 10,
      now: NOW,
      rng,
    });

    expect(queue).toHaveLength(2);
    expect(new Set(queue.map(value => deriveCardKeyFromItemId(value.itemId))).size).toBe(2);
  });

  it('one-round queue length matches the canonical launchable count', () => {
    const itemIds = ['MUL_2x3', 'MUL_3x4', 'MUL_4x5', 'MUL_5x6', 'MUL_6x7', 'MUL_7x8'];
    const aliases: StudentItemState[] = [];
    for (let index = 0; index < 79; index++) {
      const itemId = itemIds[index % itemIds.length];
      aliases.push(state(itemId, { cardKey: `legacy:${itemId}:${index}` }));
    }
    const states = new Map(aliases.map(row => [row.cardKey, row]));

    const queue = buildDailyReviewQueue({
      requestedItemIds: aliases.map(row => row.lastItemId!),
      states,
      sessionLength: 79,
      now: NOW,
      rng,
      repeatPolicy: 'user_requested_rounds',
      rounds: 1,
    });

    expect(queue).toHaveLength(6);
  });
});
