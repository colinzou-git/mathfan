import { describe, it, expect } from 'vitest';
import { hasVisualModel } from '../features/visuals/visualModelUtils';
import { makeMultiplicationItem } from '../features/curriculum/multiplicationItems';
import { makeWordProblem } from '../features/curriculum/wordProblemItems';
import { makeFractionNumberLineItem } from '../features/curriculum/fractionItems';
import { makeAreaUnitSquaresItem, makeAreaRectangleItem, makePerimeterRectangleItem } from '../features/curriculum/areaItems';
import { makeFractionCompareItem, makeFractionEquivalentItem } from '../features/curriculum/fractionItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';

describe('hasVisualModel — multiplication', () => {
  it('returns true for multiplication_fact with small factors', () => {
    const item = makeMultiplicationItem(3, 4);
    expect(hasVisualModel(item)).toBe(true);
  });

  it('returns false for multiplication_fact with factor > 10', () => {
    const item = makeMultiplicationItem(11, 4);
    expect(hasVisualModel(item)).toBe(false);
  });
});

describe('hasVisualModel — equal-groups word problem', () => {
  it('returns true for WORD_eg_ items', () => {
    const item = makeWordProblem('eg', 3, 4);
    expect(hasVisualModel(item)).toBe(true);
  });

  it('returns false for non-eg word problems', () => {
    const item = makeWordProblem('dv', 3, 4);
    expect(hasVisualModel(item)).toBe(false);
  });
});

describe('hasVisualModel — fraction_number_line', () => {
  it('returns true for FNL items (factB is denominator)', () => {
    const item = makeFractionNumberLineItem(1, 4);
    expect(hasVisualModel(item)).toBe(true);
  });

  it('FractionNumberLine is used (not FractionBar) for FNL items — itemType check', () => {
    const item = makeFractionNumberLineItem(3, 4);
    expect(item.itemType).toBe('fraction_number_line');
    expect(item.factB).toBe(4);
  });
});

describe('hasVisualModel — fraction bars', () => {
  it('returns true for fraction_compare items', () => {
    const item = makeFractionCompareItem(1, 4, 3, 4);
    expect(hasVisualModel(item)).toBe(true);
  });

  it('returns true for fraction_equivalent items', () => {
    const item = makeFractionEquivalentItem(2, 3, 2);
    expect(hasVisualModel(item)).toBe(true);
  });
});

describe('hasVisualModel — area and perimeter', () => {
  it('returns true for area_unit_squares', () => {
    expect(hasVisualModel(makeAreaUnitSquaresItem(3, 4))).toBe(true);
  });

  it('returns true for area_rectangle', () => {
    expect(hasVisualModel(makeAreaRectangleItem(3, 4))).toBe(true);
  });

  it('returns true for perimeter_rectangle', () => {
    expect(hasVisualModel(makePerimeterRectangleItem(3, 4))).toBe(true);
  });
});

describe('hasVisualModel — geometry', () => {
  it('returns true for GEO_SIDES_triangle', () => {
    const item = makeItemFromId('GEO_SIDES_triangle')!;
    expect(hasVisualModel(item)).toBe(true);
  });

  it('returns true for GEO_NAME_3', () => {
    const item = makeItemFromId('GEO_NAME_3')!;
    expect(hasVisualModel(item)).toBe(true);
  });
});
