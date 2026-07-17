import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeItemFromId as reconstructItem } from '../features/curriculum/makeItemFromId';
import { projectLegacyCompatibilityFields } from '../features/curriculum/practiceContentSpec';
import type { PracticeItem } from '../types/math';
import {
  areaPerimeterChoiceItemIds,
  areaPerimCompareItemIds,
  canonicalRectangleDimensions,
  generateAreaPerimeterItem,
  makeAreaPerimeterExpressionChoiceItem,
  makeAreaPerimCompareItem,
  makeAreaRectangleItem,
  makePerimeterRectangleItem,
  makePerimeterUnknownSideItem,
  perimeterUnknownSideItemIds,
  rectilinearAreaItemIds,
} from '../features/curriculum/areaItems';
import { detectMistakes } from '../features/mastery/misconceptionEngine';
import { buildFocusSequence } from '../features/mastery/skillPracticePlanner';
import { getHint } from '../features/practice/hintEngine';
import { deriveCardKey } from '../features/scheduler/cardModel';
import { misconceptionBridgeBoost } from '../features/adaptive/adaptiveItemSelector';
import { VisualModel } from '../features/visuals/VisualModel';
import { hasVisualModel } from '../features/visuals/visualModelUtils';

const makeItemFromId = (id: string): PracticeItem | null => {
  const item = reconstructItem(id);
  return item ? projectLegacyCompatibilityFields(item) : null;
};

afterEach(cleanup);

describe('area/perimeter template cards', () => {
  it('uses one schema card across concrete dimensions and orientations', () => {
    const a = makeAreaRectangleItem(4, 8);
    const b = makeAreaRectangleItem(8, 4);
    const c = makeAreaRectangleItem(3, 7);
    expect(canonicalRectangleDimensions(8, 4)).toEqual([4, 8]);
    expect(deriveCardKey(a)).toBe(deriveCardKey(b));
    expect(deriveCardKey(a)).toBe(deriveCardKey(c));
    expect(a.schemaId).toBe('area_rows_columns');
  });

  it('keeps area and perimeter schemas as separate cards', () => {
    expect(deriveCardKey(makeAreaRectangleItem(3, 4)))
      .not.toBe(deriveCardKey(makePerimeterRectangleItem(3, 4)));
  });

  it('generates deterministic valid instances for every schema', () => {
    const schemas = [
      'area_count_squares', 'area_rows_columns', 'perimeter_sum_sides',
      'perimeter_rectangle_structure', 'area_or_perimeter_choice',
      'perimeter_missing_side', 'rectilinear_area_decompose',
      'same_area_diff_perimeter', 'same_perimeter_diff_area',
    ] as const;
    for (const schema of schemas) {
      const item = generateAreaPerimeterItem(schema, { rng: () => 0.25 });
      expect(item.schemaId).toBe(schema);
      expect(item.cardKey).toBe(`template:g3-area-perimeter:${schema}`);
      expect(item.visualSpec).toBeDefined();
      if (typeof item.answer === 'number') expect(Number.isFinite(item.answer)).toBe(true);
    }
  });
});

describe('area/perimeter catalogue constraints', () => {
  it('all missing-side instances are possible and positive', () => {
    for (const id of perimeterUnknownSideItemIds()) {
      const item = makeItemFromId(id)!;
      expect(item.answer).toEqual(expect.any(Number));
      expect(item.answer as number).toBeGreaterThan(0);
      expect(item.reasoningSpec!.knownSides.reduce((sum, side) => sum + side, 0) + (item.answer as number))
        .toBe(item.reasoningSpec!.totalPerimeter);
    }
  });

  it('comparison constraints and rectilinear totals are mathematically valid', () => {
    for (const id of areaPerimCompareItemIds()) {
      const item = makeItemFromId(id)!;
      const spec = item.visualSpec!;
      if (spec.kind !== 'area_perimeter_compare') throw new Error('wrong visual');
      const [a, b] = spec.rectangles;
      if (spec.comparison === 'same_area') expect(a.length * a.width).toBe(b.length * b.width);
      else expect(2 * (a.length + a.width)).toBe(2 * (b.length + b.width));
    }
    for (const id of rectilinearAreaItemIds()) {
      const item = makeItemFromId(id)!;
      expect(item.answer).toBe((item.factA ?? 0) + (item.factB ?? 0));
    }
  });

  it('choice distractors are unique and reconstructable', () => {
    for (const id of areaPerimeterChoiceItemIds()) {
      const item = makeItemFromId(id)!;
      expect(new Set(item.choices).size).toBe(item.choices!.length);
      expect(item.choices).toContain(item.answer);
    }
  });
});

describe('misconception repair and progressive support', () => {
  it('detects the required rectangle and missing-side patterns', () => {
    const perimeter = makePerimeterRectangleItem(4, 7);
    expect(detectMistakes(perimeter, 28)).toContain('area_perim:used_area_for_perimeter');
    expect(detectMistakes(perimeter, 11)).toContain('area_perim:used_half_perimeter');
    expect(detectMistakes(perimeter, 15)).toContain('area_perim:forgot_one_pair_of_sides');
    expect(detectMistakes(makeAreaRectangleItem(4, 7), 22)).toContain('area_perim:used_perimeter_for_area');
    const missing = makePerimeterUnknownSideItem(20, [4, 6, 5]);
    expect(detectMistakes(missing, 20)).toContain('area_perim:copied_given_perimeter');
    expect(detectMistakes(missing, 35)).toContain('area_perim:summed_non_boundary_values');
  });

  it('escalates hints without revealing the missing side in the first three rungs', () => {
    const item = makePerimeterUnknownSideItem(20, [4, 6, 5]);
    for (const attempt of [1, 2, 3]) {
      expect(getHint(item, attempt)!.text).not.toMatch(/missing side is 5|= 5\b/i);
    }
    expect(getHint(item, 3)!.text).toContain(item.reasoningSpec!.equation);
  });

  it('renders comparison visuals without exposing calculated results', () => {
    const item = makeAreaPerimCompareItem('sadp', 0)!;
    expect(hasVisualModel(item)).toBe(true);
    render(<VisualModel item={item} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('2 rectangles to compare');
  });

  it('orders focused instruction by concept and representation', () => {
    expect(buildFocusSequence('g3-area-formula').representations).toEqual(['unit_squares', 'rows_columns']);
    expect(buildFocusSequence('g3-perimeter-missing-side').representations)
      .toEqual(['equation', 'known_side_sum', 'independent']);
  });

  it('uses plausible boundary-expression distractors', () => {
    const item = makeAreaPerimeterExpressionChoiceItem(4, 7);
    expect(item.choices).toEqual(['2×4 + 2×7', '4×7', '4 + 7', '2×4 + 7']);
  });

  it('prioritizes a targeted bridge after a known misconception', () => {
    const bridge = makeAreaPerimeterExpressionChoiceItem(4, 7);
    const state = {
      studentId: 'student', cardKey: bridge.cardKey!, masteryLevel: 'learning' as const,
      skillId: bridge.skillId, stabilityDays: 0, attemptCount: 1, correctCount: 0,
      lastCorrect: false, lastLatencyMs: 0, medianLatencyMs: 0, ease: 2.5, difficulty: bridge.difficulty,
      mistakePatterns: ['area_perim:used_area_for_perimeter'],
    };
    expect(misconceptionBridgeBoost(bridge, state)).toBeGreaterThan(0);
    expect(misconceptionBridgeBoost(makeAreaRectangleItem(4, 7), state)).toBe(0);
  });
});
