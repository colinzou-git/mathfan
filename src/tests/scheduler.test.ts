import { describe, it, expect } from 'vitest';
import {
  applyReview, createInitialState, updateMasteryLevel, planSession, planTableSession,
  fsrsRetrievability, fsrsInterval, TARGET_RETENTION,
} from '../features/scheduler/scheduler';
import { generateMultiplicationItems, generateSingleTableItems } from '../features/curriculum/multiplicationItems';
import type { StudentItemState } from '../types/math';

const MS_DAY = 86_400_000;
const items = generateMultiplicationItems();
const item = items.find(i => i.id === 'MUL_8x9')!;
const now = new Date('2026-06-01T10:00:00Z');
const fresh = () => createInitialState('s1', item);

// ── FSRS core math ────────────────────────────────────────────────────────────

describe('fsrsRetrievability', () => {
  it('is 1.0 at t=0', () => expect(fsrsRetrievability(0, 5)).toBeCloseTo(1, 5));
  it('is 0.5 after t = 9·S days', () => expect(fsrsRetrievability(9 * 5, 5)).toBeCloseTo(0.5, 5));
  it('decreases as time passes', () => {
    expect(fsrsRetrievability(10, 5)).toBeLessThan(fsrsRetrievability(2, 5));
  });
});

describe('fsrsInterval', () => {
  it('≈ stability at 90% target retention', () => {
    expect(fsrsInterval(10, 0.9)).toBeCloseTo(10, 0);
  });
  it('lower target retention → longer interval', () => {
    expect(fsrsInterval(10, 0.8)).toBeGreaterThan(fsrsInterval(10, 0.9));
  });
  it('default target retention is 0.9', () => expect(TARGET_RETENTION).toBe(0.9));
});

// ── applyReview: FSRS scheduling ──────────────────────────────────────────────

describe('applyReview — first review initial values', () => {
  it('easy schedules further out than good, good further than hard', () => {
    const easy = applyReview(fresh(), 'easy', 1000, '72', now);
    const good = applyReview(fresh(), 'good', 2500, '72', now);
    const hard = applyReview(fresh(), 'hard', 5000, '72', now);
    const days = (s: StudentItemState) => (new Date(s.nextDueAt!).getTime() - now.getTime()) / MS_DAY;
    expect(days(easy)).toBeGreaterThan(days(good));
    expect(days(good)).toBeGreaterThan(days(hard));
  });

  it('again is due immediately and counts a lapse', () => {
    const u = applyReview(fresh(), 'again', 1000, '63', now);
    expect(u.nextDueAt).toBe(now.toISOString());
    expect(u.lapses).toBe(1);
    expect(u.reps).toBe(1);
  });

  it('difficulty: again ends up harder than easy', () => {
    const easy = applyReview(fresh(), 'easy', 1000, '72', now);
    const again = applyReview(fresh(), 'again', 1000, '63', now);
    expect(again.fsrsDifficulty!).toBeGreaterThan(easy.fsrsDifficulty!);
  });

  it('clamps difficulty into [1,10]', () => {
    const u = applyReview(fresh(), 'again', 1000, '63', now);
    expect(u.fsrsDifficulty!).toBeGreaterThanOrEqual(1);
    expect(u.fsrsDifficulty!).toBeLessThanOrEqual(10);
  });
});

describe('applyReview — stability growth on later reviews', () => {
  it('a correct review after real elapsed time increases stability', () => {
    const first = applyReview(fresh(), 'good', 2000, '72', now);
    const s1 = first.stabilityDays;
    // review again ~s1 days later, still correct
    const later = new Date(now.getTime() + s1 * MS_DAY);
    const second = applyReview(first, 'good', 2000, '72', later);
    expect(second.stabilityDays).toBeGreaterThan(s1);
    expect(second.reps).toBe(2);
  });

  it('a lapse after a long interval shrinks stability sharply', () => {
    const first = applyReview(fresh(), 'easy', 1000, '72', now); // big stability
    const later = new Date(now.getTime() + first.stabilityDays * MS_DAY);
    const lapsed = applyReview(first, 'again', 5000, '0', later);
    expect(lapsed.stabilityDays).toBeLessThan(first.stabilityDays);
    expect(lapsed.lapses).toBe(1);
  });
});

describe('applyReview — counts & personal best', () => {
  it('correct increments correct + attempt counts', () => {
    const u = applyReview(fresh(), 'good', 2500, '72', now);
    expect(u.correctCount).toBe(1);
    expect(u.attemptCount).toBe(1);
  });
  it('wrong does not increment correctCount', () => {
    const u = applyReview(fresh(), 'again', 2500, '63', now);
    expect(u.correctCount).toBe(0);
    expect(u.attemptCount).toBe(1);
  });
  it('tracks personal best only on correct, keeps the fastest', () => {
    const a = applyReview(fresh(), 'easy', 1200, '72', now);
    expect(a.personalBestMs).toBe(1200);
    const b = applyReview(a, 'good', 900, '72', now);
    expect(b.personalBestMs).toBe(900);
    const c = applyReview(b, 'good', 3000, '72', now);
    expect(c.personalBestMs).toBe(900);
  });
  it('does not set personal best on a wrong answer', () => {
    expect(applyReview(fresh(), 'again', 1200, '63', now).personalBestMs).toBeUndefined();
  });
});

// ── mastery / planning (unchanged behaviour) ──────────────────────────────────

describe('updateMasteryLevel', () => {
  const base: StudentItemState = {
    studentId: 's1', itemId: 'x', skillId: 'sk',
    attemptCount: 0, correctCount: 0, lastCorrect: false,
    lastLatencyMs: 0, medianLatencyMs: 0, ease: 2.5,
    stabilityDays: 1, difficulty: 0.5, masteryLevel: 'new', mistakePatterns: [],
  };
  it('no attempts → new', () => expect(updateMasteryLevel(base)).toBe('new'));
  it('low accuracy → learning', () =>
    expect(updateMasteryLevel({ ...base, attemptCount: 4, correctCount: 1, stabilityDays: 2 })).toBe('learning'));
  it('high accuracy + long stability → mastered', () =>
    expect(updateMasteryLevel({ ...base, attemptCount: 20, correctCount: 19, stabilityDays: 20 })).toBe('mastered'));
  it('mid → developing', () =>
    expect(updateMasteryLevel({ ...base, attemptCount: 10, correctCount: 7, stabilityDays: 5 })).toBe('developing'));
});

describe('planSession', () => {
  const pool = generateMultiplicationItems().slice(0, 30);

  it('all unseen → fills new bucket', () => {
    const plan = planSession(pool, new Map(), now, 20);
    const total = plan.dueItems.length + plan.weakItems.length + plan.newItems.length;
    expect(total).toBeLessThanOrEqual(20);
    expect(plan.newItems.length).toBeGreaterThan(0);
  });

  it('due items are included', () => {
    const states = new Map<string, StudentItemState>();
    states.set(pool[0].id, {
      ...createInitialState('s1', pool[0]),
      attemptCount: 3, correctCount: 2, masteryLevel: 'developing',
      nextDueAt: new Date('2026-05-01T10:00:00Z').toISOString(),
    });
    expect(planSession(pool, states, now, 20).dueItems).toContain(pool[0].id);
  });

  it('mastered items are excluded', () => {
    const states = new Map<string, StudentItemState>();
    states.set(pool[0].id, {
      ...createInitialState('s1', pool[0]),
      attemptCount: 20, correctCount: 19, masteryLevel: 'mastered',
      nextDueAt: new Date('2027-01-01').toISOString(),
    });
    const plan = planSession(pool, states, now, 20);
    expect([...plan.dueItems, ...plan.weakItems, ...plan.newItems]).not.toContain(pool[0].id);
  });
});

describe('planTableSession', () => {
  const pool = generateSingleTableItems(7);
  it('returns exactly count items', () => {
    expect(planTableSession(pool, 10).length).toBe(10);
    expect(planTableSession(pool, 25).length).toBe(25);
  });
  it('uses items from the pool', () => {
    const ids = new Set(pool.map(i => i.id));
    expect(planTableSession(pool, 25).every(id => ids.has(id))).toBe(true);
  });
  it('empty pool → empty queue', () => expect(planTableSession([], 10)).toEqual([]));
});
