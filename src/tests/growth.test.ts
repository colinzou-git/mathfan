import { describe, it, expect } from 'vitest';
import { computeFactGrowth, growthWindows } from '../features/stats/statsEngine';
import type { AttemptLog } from '../types/math';

function attempt(over: Partial<AttemptLog> & { itemId: string; createdAt: string; isCorrect: boolean; latencyMs: number }): AttemptLog {
  return {
    id: Math.random().toString(36),
    studentId: 's1',
    skillId: 'SKILL_MUL_FACTS',
    sessionId: 'sess',
    promptShown: '7 × 8',
    correctAnswer: 56,
    studentAnswer: over.isCorrect ? 56 : 0,
    reviewGrade: over.isCorrect ? 'good' : 'again',
    ...over,
  };
}

// Fixed reference: current window = day [2026-06-10], previous = [2026-06-09]
const CUR_START = new Date('2026-06-10T00:00:00');
const CUR_END = new Date('2026-06-11T00:00:00');
const PREV_START = new Date('2026-06-09T00:00:00');
const PREV_END = new Date('2026-06-10T00:00:00');

describe('computeFactGrowth', () => {
  it('classifies a fact with improved accuracy as stronger', () => {
    const attempts = [
      // Previous day: 1/2 correct = 50%
      attempt({ itemId: 'MUL_7x8', createdAt: '2026-06-09T10:00:00.000Z', isCorrect: true, latencyMs: 3000 }),
      attempt({ itemId: 'MUL_7x8', createdAt: '2026-06-09T10:01:00.000Z', isCorrect: false, latencyMs: 4000 }),
      // Current day: 2/2 correct = 100%
      attempt({ itemId: 'MUL_7x8', createdAt: '2026-06-10T10:00:00.000Z', isCorrect: true, latencyMs: 2500 }),
      attempt({ itemId: 'MUL_7x8', createdAt: '2026-06-10T10:01:00.000Z', isCorrect: true, latencyMs: 2500 }),
    ];
    const g = computeFactGrowth(attempts, CUR_START, CUR_END, PREV_START, PREV_END);
    expect(g.stronger.map(f => f.itemId)).toContain('MUL_7x8');
    expect(g.weaker).toHaveLength(0);
  });

  it('classifies a fact with dropped accuracy as weaker', () => {
    const attempts = [
      attempt({ itemId: 'MUL_8x9', createdAt: '2026-06-09T10:00:00.000Z', isCorrect: true, latencyMs: 2000 }),
      attempt({ itemId: 'MUL_8x9', createdAt: '2026-06-09T10:01:00.000Z', isCorrect: true, latencyMs: 2000 }),
      attempt({ itemId: 'MUL_8x9', createdAt: '2026-06-10T10:00:00.000Z', isCorrect: false, latencyMs: 5000 }),
      attempt({ itemId: 'MUL_8x9', createdAt: '2026-06-10T10:01:00.000Z', isCorrect: true, latencyMs: 5000 }),
    ];
    const g = computeFactGrowth(attempts, CUR_START, CUR_END, PREV_START, PREV_END);
    expect(g.weaker.map(f => f.itemId)).toContain('MUL_8x9');
  });

  it('uses speed as tiebreaker when accuracy is equal', () => {
    const attempts = [
      // Both days 100% accuracy, but current is much faster
      attempt({ itemId: 'MUL_6x7', createdAt: '2026-06-09T10:00:00.000Z', isCorrect: true, latencyMs: 4000 }),
      attempt({ itemId: 'MUL_6x7', createdAt: '2026-06-10T10:00:00.000Z', isCorrect: true, latencyMs: 1500 }),
    ];
    const g = computeFactGrowth(attempts, CUR_START, CUR_END, PREV_START, PREV_END);
    expect(g.stronger.map(f => f.itemId)).toContain('MUL_6x7');
  });

  it('marks facts only in current window as new', () => {
    const attempts = [
      attempt({ itemId: 'MUL_9x9', createdAt: '2026-06-10T10:00:00.000Z', isCorrect: true, latencyMs: 2000 }),
    ];
    const g = computeFactGrowth(attempts, CUR_START, CUR_END, PREV_START, PREV_END);
    expect(g.newFacts.map(f => f.itemId)).toContain('MUL_9x9');
    expect(g.stronger).toHaveLength(0);
  });

  it('omits facts not practiced in the current window', () => {
    const attempts = [
      attempt({ itemId: 'MUL_3x3', createdAt: '2026-06-09T10:00:00.000Z', isCorrect: true, latencyMs: 2000 }),
    ];
    const g = computeFactGrowth(attempts, CUR_START, CUR_END, PREV_START, PREV_END);
    const all = [...g.stronger, ...g.weaker, ...g.same, ...g.newFacts];
    expect(all.map(f => f.itemId)).not.toContain('MUL_3x3');
  });

  it('classifies stable accuracy and speed as same', () => {
    const attempts = [
      attempt({ itemId: 'MUL_5x5', createdAt: '2026-06-09T10:00:00.000Z', isCorrect: true, latencyMs: 2000 }),
      attempt({ itemId: 'MUL_5x5', createdAt: '2026-06-10T10:00:00.000Z', isCorrect: true, latencyMs: 2100 }),
    ];
    const g = computeFactGrowth(attempts, CUR_START, CUR_END, PREV_START, PREV_END);
    expect(g.same.map(f => f.itemId)).toContain('MUL_5x5');
  });
});

describe('growthWindows', () => {
  const now = new Date('2026-06-10T15:00:00'); // Wednesday

  it('day window is today vs yesterday', () => {
    const [cs, ce, ps, pe] = growthWindows('day', now);
    expect(cs.getDate()).toBe(10);
    expect(ce.getDate()).toBe(11);
    expect(ps.getDate()).toBe(9);
    expect(pe.getDate()).toBe(10);
  });

  it('week window current starts Monday', () => {
    const [cs, , ps] = growthWindows('week', now);
    expect(cs.getDay()).toBe(1);  // Monday
    expect(ps.getDay()).toBe(1);  // previous Monday
    expect((cs.getTime() - ps.getTime()) / 86400000).toBe(7);
  });

  it('month window current starts on the 1st', () => {
    const [cs, , ps] = growthWindows('month', now);
    expect(cs.getDate()).toBe(1);
    expect(cs.getMonth()).toBe(5);  // June
    expect(ps.getMonth()).toBe(4);  // May
  });
});
