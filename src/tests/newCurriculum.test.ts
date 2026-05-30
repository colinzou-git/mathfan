import { describe, it, expect } from 'vitest';
import { generateWordProblemItems } from '../features/curriculum/wordProblemItems';
import { generateRoundingItems, makeRoundingItem, roundToNearest } from '../features/curriculum/roundingItems';
import { generateNumberTheoryItems, isPrime, makePrimeItem, makeFactorItem } from '../features/curriculum/numberTheoryItems';
import { generateDecimalItems, makeDecimalAddItem, makeDecimalSubItem, fmtDecimal } from '../features/curriculum/decimalItems';
import { describeItem } from '../features/curriculum/describeItem';

describe('word problems', () => {
  it('generates the requested count with numeric answers', () => {
    const items = generateWordProblemItems(4, 12);
    expect(items.length).toBe(12);
    for (const it of items) {
      expect(it.itemType).toBe('word_problem');
      expect(typeof it.answer).toBe('number');
      expect(it.prompt.length).toBeGreaterThan(10); // a real sentence
    }
  });

  it('answer matches the embedded factors for equal-groups/array/compare', () => {
    const items = generateWordProblemItems(5, 30);
    for (const it of items) {
      if (it.id.startsWith('WORD_dv_')) {
        // sharing: answer is the quotient (factB)
        expect(it.answer).toBe(it.factB);
      } else {
        expect(it.answer).toBe((it.factA ?? 0) * (it.factB ?? 0));
      }
    }
  });

  it('describeItem renders a compact label', () => {
    expect(describeItem('WORD_eg_6_8')).toMatchObject({ group: 'word' });
    expect(describeItem('WORD_eg_6_8').prompt).toContain('6 × 8');
  });
});

describe('rounding', () => {
  it('roundToNearest works', () => {
    expect(roundToNearest(47, 10)).toBe(50);
    expect(roundToNearest(432, 100)).toBe(400);
    expect(roundToNearest(1500, 1000)).toBe(2000);
  });

  it('makeRoundingItem builds a correct item', () => {
    const it = makeRoundingItem(47, 10);
    expect(it.answer).toBe(50);
    expect(it.prompt).toBe('Round 47 to the nearest ten.');
  });

  it('generates count items, none already-round', () => {
    const items = generateRoundingItems(4, 15);
    expect(items.length).toBe(15);
    for (const it of items) {
      const n = it.factA ?? 0, place = it.factB ?? 10;
      expect(n % place).not.toBe(0);
      expect(it.answer).toBe(roundToNearest(n, place));
    }
  });

  it('describeItem parses rounding', () => {
    expect(describeItem('ROUND_47_10')).toMatchObject({ group: 'round', prompt: 'Round 47 → 10' });
  });
});

describe('number theory', () => {
  it('isPrime is correct', () => {
    expect(isPrime(2)).toBe(true);
    expect(isPrime(17)).toBe(true);
    expect(isPrime(1)).toBe(false);
    expect(isPrime(15)).toBe(false);
    expect(isPrime(49)).toBe(false);
  });

  it('prime item is a choice with correct answer', () => {
    expect(makePrimeItem(17)).toMatchObject({ answer: 'prime', answerInput: 'choice' });
    expect(makePrimeItem(15).answer).toBe('composite');
  });

  it('factor item answers yes/no correctly', () => {
    expect(makeFactorItem(3, 12).answer).toBe('yes');
    expect(makeFactorItem(5, 12).answer).toBe('no');
  });

  it('generates count items', () => {
    const items = generateNumberTheoryItems(5, 20);
    expect(items.length).toBe(20);
    for (const it of items) {
      expect(['prime', 'composite', 'yes', 'no']).toContain(it.answer);
    }
  });

  it('describeItem parses prime and factor', () => {
    expect(describeItem('PRIME_17')).toMatchObject({ group: 'factors' });
    expect(describeItem('FACT_3_12')).toMatchObject({ group: 'factors' });
  });
});

describe('decimals', () => {
  it('fmtDecimal trims trailing zeros', () => {
    expect(fmtDecimal(250)).toBe('2.5');
    expect(fmtDecimal(175)).toBe('1.75');
    expect(fmtDecimal(100)).toBe('1');
  });

  it('add and subtract compute correctly', () => {
    expect(makeDecimalAddItem(250, 175).answer).toBeCloseTo(4.25, 5);
    expect(makeDecimalSubItem(175, 250).answer).toBeCloseTo(0.75, 5); // ordered larger − smaller
  });

  it('subtraction never goes negative', () => {
    const items = generateDecimalItems(5, 30);
    for (const it of items) {
      expect(Number(it.answer)).toBeGreaterThanOrEqual(0);
    }
  });

  it('generates count items', () => {
    expect(generateDecimalItems(4, 18).length).toBe(18);
  });

  it('describeItem parses decimal add/sub', () => {
    expect(describeItem('DADD_2p5_1p75')).toMatchObject({ group: 'dec', prompt: '2.5 + 1.75' });
    expect(describeItem('DSUB_2p5_1p75')).toMatchObject({ group: 'dec', prompt: '2.5 − 1.75' });
  });
});
