import { describe, it, expect } from 'vitest';
import {
  makeAdditionItem, makeSubtractionItem, makeDivisionItem,
  generateAdditionItems, generateSubtractionItems, generateDivisionItemsRange,
} from '../features/curriculum/arithmeticItems';

describe('addition items', () => {
  it('computes the sum', () => {
    const it1 = makeAdditionItem(3, 5);
    expect(it1.answer).toBe(8);
    expect(it1.prompt).toBe('3 + 5');
    expect(it1.itemType).toBe('addition_fact');
    expect(it1.answerInput).toBe('numeric');
  });

  it('generates the requested count within range', () => {
    const items = generateAdditionItems(0, 10, 15);
    expect(items.length).toBe(15);
    for (const item of items) {
      expect(item.factA).toBeGreaterThanOrEqual(0);
      expect(item.factA).toBeLessThanOrEqual(10);
      expect(item.factB).toBeGreaterThanOrEqual(0);
      expect(item.factB).toBeLessThanOrEqual(10);
      expect(item.answer).toBe((item.factA ?? 0) + (item.factB ?? 0));
    }
  });
});

describe('subtraction items', () => {
  it('always yields a non-negative answer (larger − smaller)', () => {
    const it1 = makeSubtractionItem(3, 9);
    expect(it1.answer).toBe(6);
    expect(it1.prompt).toBe('9 − 3');
  });

  it('generated items never go negative', () => {
    const items = generateSubtractionItems(0, 20, 30);
    expect(items.length).toBe(30);
    for (const item of items) {
      expect(Number(item.answer)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('division items', () => {
  it('computes a whole-number quotient', () => {
    const it1 = makeDivisionItem(56, 8);
    expect(it1.answer).toBe(7);
    expect(it1.prompt).toBe('56 ÷ 8');
  });

  it('generated division always divides evenly and avoids ÷1', () => {
    const items = generateDivisionItemsRange(2, 12, 25);
    expect(items.length).toBe(25);
    for (const item of items) {
      const dividend = item.factA ?? 0;
      const divisor = item.factB ?? 1;
      expect(divisor).toBeGreaterThanOrEqual(2);
      expect(dividend % divisor).toBe(0);
      expect(item.answer).toBe(dividend / divisor);
    }
  });
});
