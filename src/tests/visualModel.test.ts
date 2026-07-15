import { createElement } from 'react';
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { hasVisualModel } from '../features/visuals/visualModelUtils';
import { VisualModel } from '../features/visuals/VisualModel';
import { makeMultiplicationItem } from '../features/curriculum/multiplicationItems';
import { makeWordProblem } from '../features/curriculum/wordProblemItems';
import { makeFractionNumberLineItem } from '../features/curriculum/fractionItems';
import { makeAreaUnitSquaresItem, makeAreaRectangleItem, makePerimeterRectangleItem } from '../features/curriculum/areaItems';
import { makeFractionCompareItem, makeFractionEquivalentItem } from '../features/curriculum/fractionItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';

afterEach(cleanup);

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

  it('renders the structured sharing model for division word problems', () => {
    const item = makeWordProblem('dv', 3, 4);
    expect(hasVisualModel(item)).toBe(true);
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

  it('does not reveal the answer label during practice rendering', () => {
    const item = makeItemFromId('FNL_3_4')!;
    render(createElement(VisualModel, { item }));
    expect(screen.queryByText('3/4')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /divided into 4 equal parts/i })).toBeInTheDocument();
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

describe('VisualModel — answer-leakage: revealAnswer=false hides computed values', () => {
  it('3×4 multiplication array does not expose 12 in aria-label', () => {
    const item = makeMultiplicationItem(3, 4);
    render(createElement(VisualModel, { item, revealAnswer: false }));
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).not.toMatch(/12/);
    expect(img.getAttribute('aria-label')).not.toMatch(/total/i);
  });

  it('3×4 multiplication array includes 12 when revealAnswer=true', () => {
    const item = makeMultiplicationItem(3, 4);
    render(createElement(VisualModel, { item, revealAnswer: true }));
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toMatch(/12/);
  });

  it('area_rectangle 3×4 does not expose area 12 in aria-label when revealAnswer=false', () => {
    const item = makeAreaRectangleItem(3, 4);
    render(createElement(VisualModel, { item, revealAnswer: false }));
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).not.toMatch(/area 12/i);
    expect(img.getAttribute('aria-label')).not.toMatch(/12 square/i);
  });

  it('area_rectangle 3×4 includes area 12 when revealAnswer=true', () => {
    const item = makeAreaRectangleItem(3, 4);
    render(createElement(VisualModel, { item, revealAnswer: true }));
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toMatch(/12/);
  });

  it('perimeter_rectangle 3×5 does not expose perimeter 16 in aria-label when revealAnswer=false', () => {
    const item = makePerimeterRectangleItem(3, 5);
    render(createElement(VisualModel, { item, revealAnswer: false }));
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).not.toMatch(/perimeter/i);
    expect(img.getAttribute('aria-label')).not.toMatch(/16/);
  });

  it('perimeter_rectangle 3×5 includes perimeter 16 when revealAnswer=true', () => {
    const item = makePerimeterRectangleItem(3, 5);
    render(createElement(VisualModel, { item, revealAnswer: true }));
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toMatch(/perimeter/i);
    expect(img.getAttribute('aria-label')).toMatch(/16/);
  });

  it('area_unit_squares 3×4 does not expose total 12 in aria-label when revealAnswer=false', () => {
    const item = makeAreaUnitSquaresItem(3, 4);
    render(createElement(VisualModel, { item, revealAnswer: false }));
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).not.toMatch(/12/);
    expect(img.getAttribute('aria-label')).not.toMatch(/total/i);
  });

  it('equal-groups word problem 3×4 does not expose total 12 in aria-label when revealAnswer=false', () => {
    const item = makeWordProblem('eg', 3, 4);
    render(createElement(VisualModel, { item, revealAnswer: false }));
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).not.toMatch(/12/);
    expect(img.getAttribute('aria-label')).not.toMatch(/total/i);
  });

  it('equal-groups word problem 3×4 includes total 12 when revealAnswer=true', () => {
    const item = makeWordProblem('eg', 3, 4);
    render(createElement(VisualModel, { item, revealAnswer: true }));
    const img = screen.getByRole('img');
    expect(img.getAttribute('aria-label')).toMatch(/12/);
  });
});
