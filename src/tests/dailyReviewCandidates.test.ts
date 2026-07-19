import { describe, expect, it } from 'vitest';
import type { StudentItemState } from '../types/math';
import {
  resolveCanonicalReviewCards,
  resolveDueReviewCards,
} from '../features/scheduler/dailyReviewCandidates';
import { deriveCardKeyFromItemId } from '../features/scheduler/cardModel';

const NOW = new Date('2026-07-18T12:00:00Z');
const PAST = '2026-07-17T12:00:00Z';
const FUTURE = '2026-08-18T12:00:00Z';

function state(
  itemId: string | undefined,
  overrides: Partial<StudentItemState> = {},
): StudentItemState {
  return {
    studentId: 'student',
    cardKey: itemId ? deriveCardKeyFromItemId(itemId) : 'unresolvable:card',
    lastItemId: itemId,
    skillId: 'g3-mul-facts',
    attemptCount: 4,
    correctCount: 3,
    lastCorrect: true,
    lastLatencyMs: 1200,
    medianLatencyMs: 1300,
    ease: 2.5,
    stabilityDays: 4,
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

describe('canonical daily-review candidates', () => {
  it('collapses 79 raw multiplication aliases into six launchable canonical cards', () => {
    const itemIds = ['MUL_2x3', 'MUL_3x4', 'MUL_4x5', 'MUL_5x6', 'MUL_6x7', 'MUL_7x8'];
    const rows: StudentItemState[] = [];

    for (let index = 0; index < 79; index++) {
      const itemId = itemIds[index % itemIds.length];
      rows.push(state(itemId, {
        cardKey: `legacy:${itemId}:${index}`,
        lastSeenAt: new Date(Date.parse(PAST) + index * 1000).toISOString(),
      }));
    }

    const resolution = resolveCanonicalReviewCards(rows);
    expect(resolution.cards).toHaveLength(6);
    expect(resolution.aliasRowCount).toBe(73);
    expect(resolveDueReviewCards(rows, NOW)).toHaveLength(6);
  });

  it('prefers a future-due exact canonical row over obsolete due aliases', () => {
    const itemId = 'MUL_7x8';
    const canonicalKey = deriveCardKeyFromItemId(itemId);
    const rows = [
      state(itemId, {
        cardKey: 'legacy:mul:7x8:a',
        nextDueAt: PAST,
        lastSeenAt: '2026-07-17T11:30:00Z',
      }),
      state(itemId, {
        cardKey: 'legacy:mul:7x8:b',
        nextDueAt: PAST,
        lastSeenAt: '2026-07-17T11:45:00Z',
      }),
      state(itemId, {
        cardKey: canonicalKey,
        nextDueAt: FUTURE,
        lastSeenAt: '2026-07-17T10:00:00Z',
      }),
    ];

    const resolution = resolveCanonicalReviewCards(rows);
    expect(resolution.cards).toHaveLength(1);
    expect(resolution.cards[0].state.cardKey).toBe(canonicalKey);
    expect(resolution.cards[0].state.nextDueAt).toBe(FUTURE);
    expect(resolveDueReviewCards(rows, NOW)).toHaveLength(0);
  });

  it('reconstructs an atomic card from cardKey when lastItemId is missing', () => {
    const row = state(undefined, {
      cardKey: 'fact:mul:7x8',
      lastItemId: undefined,
      nextDueAt: PAST,
    });

    const resolution = resolveCanonicalReviewCards([row]);
    expect(resolution.cards).toHaveLength(1);
    expect(resolution.cards[0]).toMatchObject({
      cardKey: 'fact:mul:7x8',
      itemId: 'MUL_7x8',
    });
  });

  it('excludes unresolvable derived-cache rows from launchable counts', () => {
    const invalid = state(undefined, {
      cardKey: 'not-a-real-card',
      lastItemId: 'NOT_A_REAL_ID',
    });
    const valid = state('MUL_2x3');

    const resolution = resolveCanonicalReviewCards([invalid, valid]);
    expect(resolution.cards).toHaveLength(1);
    expect(resolution.unresolvedRows).toEqual([invalid]);
    expect(resolveDueReviewCards([invalid, valid], NOW)).toHaveLength(1);
  });

  it('selects the latest alias deterministically when no exact canonical row exists', () => {
    const older = state('MUL_7x8', {
      cardKey: 'legacy:a',
      lastSeenAt: '2026-07-16T00:00:00Z',
      nextDueAt: PAST,
      lastAnswer: 'older',
    });
    const newer = state('MUL_8x7', {
      cardKey: 'legacy:b',
      lastSeenAt: '2026-07-17T00:00:00Z',
      nextDueAt: FUTURE,
      lastAnswer: 'newer',
    });

    const card = resolveCanonicalReviewCards([older, newer]).cards[0];
    expect(card.itemId).toBe('MUL_8x7');
    expect(card.state.lastAnswer).toBe('newer');
    expect(card.state.nextDueAt).toBe(FUTURE);
  });

  it('merges monotonic counters without moving the authoritative due date backward', () => {
    const itemId = 'MUL_7x8';
    const canonical = state(itemId, {
      cardKey: deriveCardKeyFromItemId(itemId),
      attemptCount: 5,
      correctCount: 4,
      reps: 5,
      lapses: 1,
      nextDueAt: FUTURE,
      mistakePatterns: ['swap'],
    });
    const alias = state(itemId, {
      cardKey: 'legacy:mul:7x8',
      attemptCount: 12,
      correctCount: 9,
      reps: 11,
      lapses: 3,
      nextDueAt: PAST,
      mistakePatterns: ['off_by_one'],
    });

    const merged = resolveCanonicalReviewCards([alias, canonical]).cards[0].state;
    expect(merged.nextDueAt).toBe(FUTURE);
    expect(merged.attemptCount).toBe(12);
    expect(merged.correctCount).toBe(9);
    expect(merged.reps).toBe(11);
    expect(merged.lapses).toBe(3);
    expect(merged.mistakePatterns).toEqual(expect.arrayContaining(['swap', 'off_by_one']));
  });
});
