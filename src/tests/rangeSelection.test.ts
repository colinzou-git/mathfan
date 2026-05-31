import { describe, it, expect } from 'vitest';
import { generateMultiplicationRangeItems } from '../features/curriculum/multiplicationItems';
import { generateAdditionItems, generateSubtractionItems, generateDivisionItemsRange } from '../features/curriculum/arithmeticItems';
import { generateFractionItems } from '../features/curriculum/fractionItems';
import { specFor } from '../components/opSpecs';

describe('multiplication range generator', () => {
  it('draws each factor from its own range and meets the count', () => {
    const items = generateMultiplicationRangeItems(11, 15, 2, 4, 30);
    expect(items.length).toBe(30);
    for (const it of items) {
      expect(it.factA).toBeGreaterThanOrEqual(11);
      expect(it.factA).toBeLessThanOrEqual(15);
      expect(it.factB).toBeGreaterThanOrEqual(2);
      expect(it.factB).toBeLessThanOrEqual(4);
      expect(it.answer).toBe((it.factA ?? 0) * (it.factB ?? 0));
      expect(it.id).toMatch(/^MUL_\d+x\d+$/); // stays compatible with stats/describeItem
    }
  });
});

describe('addition / subtraction with two independent ranges', () => {
  it('respects each addend range', () => {
    const items = generateAdditionItems(1, 5, 25, 90, 100);
    expect(items.length).toBe(25);
    for (const it of items) {
      expect(it.factA).toBeGreaterThanOrEqual(1);
      expect(it.factA).toBeLessThanOrEqual(5);
      expect(it.factB).toBeGreaterThanOrEqual(90);
      expect(it.factB).toBeLessThanOrEqual(100);
    }
  });

  it('subtraction stays non-negative across two ranges', () => {
    const items = generateSubtractionItems(0, 9, 25, 50, 99);
    expect(items.length).toBe(25);
    for (const it of items) expect(Number(it.answer)).toBeGreaterThanOrEqual(0);
  });
});

describe('division with a dividend range', () => {
  it('keeps the dividend in range, divisor in range, and divides evenly', () => {
    const items = generateDivisionItemsRange(2, 9, 30, 20, 100);
    expect(items.length).toBe(30);
    for (const it of items) {
      const dividend = it.factA ?? 0;
      const divisor = it.factB ?? 1;
      expect(divisor).toBeGreaterThanOrEqual(2);
      expect(divisor).toBeLessThanOrEqual(9);
      expect(dividend).toBeGreaterThanOrEqual(20);
      expect(dividend).toBeLessThanOrEqual(100);
      expect(dividend % divisor).toBe(0);
    }
  });
});

describe('fractions with numerator / denominator ranges', () => {
  it('compare mode keeps denominators within the chosen range', () => {
    const items = generateFractionItems('compare', 20, 1, 4, 5, 8);
    expect(items.length).toBe(20);
    for (const it of items) {
      const m = it.id.match(/^FCMP_(\d+)_(\d+)_(\d+)_(\d+)$/);
      expect(m).not.toBeNull();
      const [, , d1, , d2] = m!.map(Number);
      expect(d1).toBeGreaterThanOrEqual(5);
      expect(d1).toBeLessThanOrEqual(8);
      expect(d2).toBeGreaterThanOrEqual(5);
      expect(d2).toBeLessThanOrEqual(8);
    }
  });
});

describe('opSpecs', () => {
  it('multiplication builds a two-range config', () => {
    const spec = specFor('multiplication', 4);
    expect(spec.ranges.length).toBe(2);
    const cfg = spec.buildConfig([{ lo: 2, hi: 9 }, { lo: 3, hi: 6 }], '', 12);
    expect(cfg).toMatchObject({
      mode: 'multiplication', sessionLength: 12,
      operandMin: 2, operandMax: 9, operand2Min: 3, operand2Max: 6,
    });
  });

  it('division maps operand range to dividend and operand2 to divisor', () => {
    const cfg = specFor('division', 5).buildConfig([{ lo: 20, hi: 100 }, { lo: 2, hi: 9 }], '', 10);
    expect(cfg.operandMin).toBe(20);
    expect(cfg.operand2Max).toBe(9);
  });

  it('fraction carries the chosen sub-mode and num/den ranges', () => {
    const cfg = specFor('fraction', 4).buildConfig([{ lo: 1, hi: 5 }, { lo: 2, hi: 10 }], 'compare', 8);
    expect(cfg.fractionMode).toBe('compare');
    expect(cfg.operandMax).toBe(5);
    expect(cfg.operand2Max).toBe(10);
  });

  it('grade-scaled ops carry the grade through', () => {
    expect(specFor('word', 3).buildConfig([{ lo: 2, hi: 10 }], '', 10).grade).toBe(3);
    expect(specFor('decimals', 5).buildConfig([{ lo: 0, hi: 20 }], '', 10).grade).toBe(5);
  });
});
