/**
 * Tests for the seedable PRNG used by adaptive selection (Priority 5).
 */
import { describe, it, expect } from 'vitest';
import { mulberry32, shuffled, randomSeed } from '../utils/rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 8 }, mulberry32(1));
    const b = Array.from({ length: 8 }, mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it('stays within [0, 1)', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('shuffled', () => {
  it('is a deterministic permutation for a given seed', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const x = shuffled(items, mulberry32(7));
    const y = shuffled(items, mulberry32(7));
    expect(x).toEqual(y);
    expect([...x].sort((a, b) => a - b)).toEqual(items); // same multiset
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);     // input not mutated
  });
});

describe('randomSeed', () => {
  it('returns a 32-bit unsigned integer', () => {
    const s = randomSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });
});
