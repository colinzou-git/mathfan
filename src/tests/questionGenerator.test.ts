import { describe, it, expect } from 'vitest';
import {
  generateMultiplicationItems,
  generateDivisionItems,
  generateUnknownFactorItems,
  generateSingleTableItems,
  generateMultipleTablesItems,
  sampleWithReplacement,
  TABLE_MIN, TABLE_MAX,
  mulId, divId,
} from '../features/curriculum/multiplicationItems';

const RANGE = TABLE_MAX - TABLE_MIN + 1; // 12

describe('generateMultiplicationItems — range 2–13', () => {
  const items = generateMultiplicationItems();

  it(`generates ${RANGE * RANGE} items`, () => {
    expect(items.length).toBe(RANGE * RANGE); // 144
  });

  it('does not include 0× or 1× facts', () => {
    expect(items.some(i => i.factA === 0 || i.factB === 0)).toBe(false);
    expect(items.some(i => i.factA === 1 || i.factB === 1)).toBe(false);
  });

  it('includes 13×13 = 169', () => {
    const item = items.find(i => i.id === mulId(13, 13));
    expect(item).toBeDefined();
    expect(item!.answer).toBe(169);
  });

  it('8 × 9 = 72', () => {
    const item = items.find(i => i.id === mulId(8, 9));
    expect(item!.answer).toBe(72);
    expect(item!.itemType).toBe('multiplication_fact');
  });

  it('max answer is 13×13=169', () => {
    expect(Math.max(...items.map(i => Number(i.answer)))).toBe(169);
  });

  it('min answer is 2×2=4', () => {
    expect(Math.min(...items.map(i => Number(i.answer)))).toBe(4);
  });

  it('harder facts have higher difficulty than easier ones', () => {
    const easy = items.find(i => i.id === mulId(2, 3))!;
    const hard = items.find(i => i.id === mulId(12, 13))!;
    expect(hard.difficulty).toBeGreaterThan(easy.difficulty);
  });

  it('all items use × symbol', () => {
    expect(items.every(i => (i.prompt as string).includes('×'))).toBe(true);
  });
});

describe('generateDivisionItems', () => {
  const items = generateDivisionItems();

  it(`generates ${RANGE * RANGE} items`, () => {
    expect(items.length).toBe(RANGE * RANGE);
  });

  it('does not include ÷1 or 0 dividend', () => {
    expect(items.some(i => Number(i.factB) === 1)).toBe(false);
    expect(items.some(i => Number(i.factA) === 0)).toBe(false);
  });

  it('169 ÷ 13 = 13', () => {
    const item = items.find(i => i.id === divId(169, 13));
    expect(item).toBeDefined();
    expect(item!.answer).toBe(13);
  });

  it('72 ÷ 9 = 8', () => {
    const item = items.find(i => i.id === divId(72, 9));
    expect(item!.answer).toBe(8);
  });
});

describe('generateUnknownFactorItems', () => {
  const items = generateUnknownFactorItems();

  it('all prompts contain ? and =', () => {
    expect(items.every(i => i.prompt.includes('?') && i.prompt.includes('='))).toBe(true);
  });

  it('8 × ? = 72 → answer 9', () => {
    const item = items.find(i => i.prompt === '8 × ? = 72');
    expect(item).toBeDefined();
    expect(item!.answer).toBe(9);
  });
});

describe('generateSingleTableItems', () => {
  const items = generateSingleTableItems(7);

  it('generates exactly RANGE items (one per multiplier 2–13)', () => {
    expect(items.length).toBe(RANGE);
  });

  it('all items use the selected table as factA', () => {
    expect(items.every(i => i.factA === 7)).toBe(true);
  });

  it('contains 7×13 = 91', () => {
    const item = items.find(i => i.id === mulId(7, 13));
    expect(item!.answer).toBe(91);
  });

  it('does not contain 7×1 or 7×0', () => {
    expect(items.some(i => i.factB === 0 || i.factB === 1)).toBe(false);
  });
});

describe('generateMultipleTablesItems', () => {
  it('merges tables without duplicates', () => {
    const items = generateMultipleTablesItems([7, 8]);
    const ids = items.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(items.length).toBe(RANGE * 2); // 12 + 12
  });

  it('includes facts from all selected tables', () => {
    const items = generateMultipleTablesItems([3, 5, 9]);
    expect(items.some(i => i.factA === 3)).toBe(true);
    expect(items.some(i => i.factA === 5)).toBe(true);
    expect(items.some(i => i.factA === 9)).toBe(true);
  });
});

describe('sampleWithReplacement', () => {
  const pool = generateSingleTableItems(6); // 12 items

  it('returns exactly count items', () => {
    expect(sampleWithReplacement(pool, 20).length).toBe(20);
    expect(sampleWithReplacement(pool, 10).length).toBe(10);
    expect(sampleWithReplacement(pool, 25).length).toBe(25);
  });

  it('returns empty array for empty pool', () => {
    expect(sampleWithReplacement([], 10)).toEqual([]);
  });

  it('all returned ids exist in pool', () => {
    const poolIds = new Set(pool.map(i => i.id));
    const result = sampleWithReplacement(pool, 25);
    expect(result.every(id => poolIds.has(id))).toBe(true);
  });
});
