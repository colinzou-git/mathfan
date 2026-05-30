import { describe, it, expect } from 'vitest';
import {
  nextIntervalDays, applyReview, createInitialState,
  updateMasteryLevel, planSession, planTableSession,
} from '../features/scheduler/scheduler';
import { generateMultiplicationItems, generateSingleTableItems } from '../features/curriculum/multiplicationItems';
import type { StudentItemState } from '../types/math';

describe('nextIntervalDays', () => {
  it('again → 0 days', () => expect(nextIntervalDays(3, 'again')).toBe(0));
  it('hard → shorter than current', () => expect(nextIntervalDays(10, 'hard')).toBeLessThan(10));
  it('hard → at least 1 day', () => expect(nextIntervalDays(0.5, 'hard')).toBeGreaterThanOrEqual(1));
  it('good → at least 2 days', () => expect(nextIntervalDays(1, 'good')).toBeGreaterThanOrEqual(2));
  it('easy → at least 4 days', () => expect(nextIntervalDays(1, 'easy')).toBeGreaterThanOrEqual(4));
  it('easy grows faster than good', () => {
    expect(nextIntervalDays(5, 'easy')).toBeGreaterThan(nextIntervalDays(5, 'good'));
  });
});

describe('applyReview — personal best', () => {
  const items = generateMultiplicationItems();
  const item = items.find(i => i.id === 'MUL_8x9')!;
  const initial = createInitialState('s1', item);
  const now = new Date('2026-06-01T10:00:00Z');

  it('sets personalBestMs on first correct answer', () => {
    const updated = applyReview(initial, 'easy', 1200, '72', now);
    expect(updated.personalBestMs).toBe(1200);
  });

  it('updates personalBestMs when faster', () => {
    const first = applyReview(initial, 'easy', 1200, '72', now);
    const second = applyReview(first, 'easy', 900, '72', now);
    expect(second.personalBestMs).toBe(900);
  });

  it('keeps personalBestMs when slower', () => {
    const first = applyReview(initial, 'easy', 900, '72', now);
    const second = applyReview(first, 'good', 2500, '72', now);
    expect(second.personalBestMs).toBe(900);
  });

  it('does not set personalBestMs on wrong answer', () => {
    const updated = applyReview(initial, 'again', 1200, '63', now);
    expect(updated.personalBestMs).toBeUndefined();
  });
});

describe('applyReview — core mechanics', () => {
  const items = generateMultiplicationItems();
  const item = items.find(i => i.id === 'MUL_8x9')!;
  const initial = createInitialState('s1', item);
  const now = new Date('2026-06-01T10:00:00Z');

  it('correct increments correctCount and attemptCount', () => {
    const u = applyReview(initial, 'good', 2500, '72', now);
    expect(u.correctCount).toBe(1);
    expect(u.attemptCount).toBe(1);
  });

  it('wrong does not increment correctCount', () => {
    const u = applyReview(initial, 'again', 2500, '63', now);
    expect(u.correctCount).toBe(0);
    expect(u.attemptCount).toBe(1);
  });

  it('again schedules immediate retry', () => {
    const u = applyReview(initial, 'again', 1000, '63', now);
    expect(u.nextDueAt).toBe(now.toISOString());
  });

  it('easy schedules review ≥4 days out', () => {
    const u = applyReview(initial, 'easy', 1000, '72', now);
    const daysOut = (new Date(u.nextDueAt!).getTime() - now.getTime()) / 86_400_000;
    expect(daysOut).toBeGreaterThanOrEqual(4);
  });
});

describe('updateMasteryLevel', () => {
  const base: StudentItemState = {
    studentId: 's1', itemId: 'x', skillId: 'sk',
    attemptCount: 0, correctCount: 0, lastCorrect: false,
    lastLatencyMs: 0, medianLatencyMs: 0, ease: 2.5,
    stabilityDays: 1, difficulty: 0.5, masteryLevel: 'new', mistakePatterns: [],
  };

  it('no attempts → new', () => expect(updateMasteryLevel(base)).toBe('new'));
  it('low accuracy → learning', () => {
    expect(updateMasteryLevel({ ...base, attemptCount: 4, correctCount: 1, stabilityDays: 2 })).toBe('learning');
  });
  it('high accuracy + long stability → mastered', () => {
    expect(updateMasteryLevel({ ...base, attemptCount: 20, correctCount: 19, stabilityDays: 20 })).toBe('mastered');
  });
  it('mid accuracy → developing', () => {
    expect(updateMasteryLevel({ ...base, attemptCount: 10, correctCount: 7, stabilityDays: 5 })).toBe('developing');
  });
});

describe('planSession', () => {
  const items = generateMultiplicationItems().slice(0, 30);
  const now = new Date('2026-06-01T10:00:00Z');

  it('all unseen → fills new bucket', () => {
    const plan = planSession(items, new Map(), now, 20);
    const total = plan.dueItems.length + plan.weakItems.length + plan.newItems.length;
    expect(total).toBeLessThanOrEqual(20);
    expect(plan.newItems.length).toBeGreaterThan(0);
  });

  it('due items prioritized over new items', () => {
    const states = new Map<string, StudentItemState>();
    const pastDue = new Date('2026-05-01T10:00:00Z').toISOString();
    states.set(items[0].id, {
      ...createInitialState('s1', items[0]),
      attemptCount: 3, correctCount: 2, masteryLevel: 'developing', nextDueAt: pastDue,
    });
    const plan = planSession(items, states, now, 20);
    expect(plan.dueItems).toContain(items[0].id);
  });

  it('mastered items are not included', () => {
    const states = new Map<string, StudentItemState>();
    states.set(items[0].id, {
      ...createInitialState('s1', items[0]),
      attemptCount: 20, correctCount: 19, masteryLevel: 'mastered',
      nextDueAt: new Date('2027-01-01').toISOString(),
    });
    const plan = planSession(items, states, now, 20);
    const allIds = [...plan.dueItems, ...plan.weakItems, ...plan.newItems];
    expect(allIds).not.toContain(items[0].id);
  });
});

describe('planTableSession', () => {
  const pool = generateSingleTableItems(7);

  it('returns exactly count items', () => {
    expect(planTableSession(pool, 10).length).toBe(10);
    expect(planTableSession(pool, 20).length).toBe(20);
    expect(planTableSession(pool, 25).length).toBe(25);
  });

  it('uses items from pool', () => {
    const poolIds = new Set(pool.map(i => i.id));
    const result = planTableSession(pool, 25);
    expect(result.every(id => poolIds.has(id))).toBe(true);
  });

  it('empty pool → empty queue', () => {
    expect(planTableSession([], 10)).toEqual([]);
  });
});
