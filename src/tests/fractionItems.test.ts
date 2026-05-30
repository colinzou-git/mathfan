import { describe, it, expect } from 'vitest';
import {
  makeFractionEquivalentItem, makeFractionCompareItem,
  generateFractionEquivalentItems, generateFractionCompareItems,
} from '../features/curriculum/fractionItems';

describe('equivalent fractions', () => {
  it('multiplies numerator and denominator', () => {
    const item = makeFractionEquivalentItem(2, 3, 2); // 2/3 = ?/6
    expect(item.prompt).toBe('2/3 = ?/6');
    expect(item.answer).toBe(4);
    expect(item.answerInput).toBe('numeric');
  });

  it('generates the requested count', () => {
    const items = generateFractionEquivalentItems(12);
    expect(items.length).toBe(12);
    for (const item of items) {
      expect(item.itemType).toBe('fraction_equivalent');
      expect(typeof item.answer).toBe('number');
    }
  });
});

describe('compare fractions', () => {
  it('detects less-than', () => {
    const item = makeFractionCompareItem(1, 3, 1, 2); // 1/3 < 1/2
    expect(item.answer).toBe('<');
    expect(item.answerInput).toBe('choice');
    expect(item.choices).toEqual(['<', '=', '>']);
  });

  it('detects greater-than', () => {
    expect(makeFractionCompareItem(3, 4, 1, 2).answer).toBe('>');
  });

  it('detects equality', () => {
    expect(makeFractionCompareItem(2, 4, 1, 2).answer).toBe('=');
  });

  it('generates the requested count with valid answers', () => {
    const items = generateFractionCompareItems(10);
    expect(items.length).toBe(10);
    for (const item of items) {
      expect(['<', '=', '>']).toContain(item.answer);
    }
  });
});
