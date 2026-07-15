import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compareFractions,
  fractionsEqual,
  generateGrade3FractionItem,
  makeFractionCompareItem,
  makeFractionEquivalentItem,
  makeFractionNumberLineItem,
  makeFractionStrategyChoiceItem,
  normalizeFraction,
  validateFractionItem,
  type Grade3FractionSchema,
} from '../features/curriculum/fractionItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { detectMistakes } from '../features/mastery/misconceptionEngine';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import { planFractionFocusSequence } from '../features/mastery/skillPracticePlanner';
import { deriveGrade3SkillSummaries } from '../features/mastery/skillMasteryEngine';
import { getHint } from '../features/practice/hintEngine';
import { deriveCardKey } from '../features/scheduler/cardModel';
import { VisualModel } from '../features/visuals/VisualModel';

afterEach(cleanup);

describe('exact fraction arithmetic and validation', () => {
  it('normalizes and compares with integer arithmetic', () => {
    expect(normalizeFraction({ numerator: 4, denominator: 12 })).toEqual({ numerator: 1, denominator: 3 });
    expect(fractionsEqual({ numerator: 2, denominator: 6 }, { numerator: 1, denominator: 3 })).toBe(true);
    expect(compareFractions({ numerator: 3, denominator: 8 }, { numerator: 3, denominator: 4 })).toBe(-1);
  });

  it('validates every generated schema and keeps a stable template card', () => {
    const schemas: Grade3FractionSchema[] = [
      'unit_fraction_model', 'number_line_location', 'equivalent_visual',
      'equivalent_missing_numerator', 'equivalent_missing_denominator',
      'compare_same_denominator', 'compare_same_numerator', 'compare_benchmark_half', 'compare_mixed',
    ];
    for (const schema of schemas) {
      const first = generateGrade3FractionItem(schema, { rng: () => 0.2 });
      const second = generateGrade3FractionItem(schema, { rng: () => 0.8 });
      expect(validateFractionItem(first), schema).toEqual({ valid: true, issues: [] });
      expect(first.cardKey).toBe(`template:g3-fraction:${schema}`);
      expect(second.cardKey).toBe(first.cardKey);
    }
  });

  it('randomizes choice order deterministically and preserves the shown order', () => {
    const a = makeFractionStrategyChoiceItem(
      { numerator: 3, denominator: 8 }, { numerator: 3, denominator: 4 }, 'same_numerator', () => 0,
    );
    const b = makeFractionStrategyChoiceItem(
      { numerator: 3, denominator: 8 }, { numerator: 3, denominator: 4 }, 'same_numerator', () => 0,
    );
    expect(a.choices).toEqual(b.choices);
    expect(a.fractionSpec?.kind === 'compare' && a.fractionSpec.explanationChoice?.choices).toEqual(a.choices);
    expect(new Set(a.choices).size).toBe(a.choices!.length);
    expect(a.choices).toContain(a.answer);
  });
});

describe('relationship-focused fraction visuals', () => {
  it('shows both equivalent quantities against the same whole without revealing equality early', () => {
    const item = makeFractionEquivalentItem(1, 3, 2);
    render(<VisualModel item={item} revealAnswer={false} />);
    const image = screen.getByRole('img');
    expect(image.getAttribute('aria-label')).toMatch(/two equal-sized fraction bars/i);
    expect(image.getAttribute('aria-label')).not.toMatch(/equal amounts/i);
  });

  it('shows both comparison quantities and reveals the relation only in review mode', () => {
    const item = makeFractionCompareItem(3, 8, 3, 4);
    const { rerender } = render(<VisualModel item={item} revealAnswer={false} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('<');
    rerender(<VisualModel item={item} revealAnswer />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('3/8 < 3/4');
  });
});

describe('fraction misconceptions, hints, mastery mapping, and focus order', () => {
  it('detects structured equivalence and comparison misconception codes', () => {
    expect(detectMistakes(makeFractionEquivalentItem(2, 3, 2), 2))
      .toContain('fraction:equivalent_changed_denominator_only');
    expect(detectMistakes(makeFractionEquivalentItem(2, 3, 2), 6))
      .toContain('fraction:equivalent_changed_numerator_only');
    expect(detectMistakes(makeFractionEquivalentItem(2, 3, 3), 4))
      .toContain('fraction:equivalent_wrong_multiplier');
    expect(detectMistakes(makeFractionCompareItem(3, 8, 3, 4), '>'))
      .toContain('fraction:compare_larger_denominator_means_larger');
    expect(detectMistakes(makeFractionCompareItem(3, 8, 3, 4), '>'))
      .toContain('fraction:compare_reversed_symbol');
    expect(detectMistakes(makeFractionNumberLineItem(2, 6), 3))
      .toContain('fraction:number_line_counted_tick_marks_not_intervals');
    const explanation = makeFractionStrategyChoiceItem(
      { numerator: 3, denominator: 8 }, { numerator: 3, denominator: 4 }, 'same_numerator', () => 0.5,
    );
    expect(detectMistakes(explanation, 'The fractions use different-sized wholes, so they cannot be compared.'))
      .toContain('fraction:fraction_not_same_whole');
  });

  it('gives strategy-aware hints without revealing the final answer', () => {
    const equivalent = makeFractionEquivalentItem(2, 6, 3);
    expect(getHint(equivalent, 1)!.text).toBe('What number changes 6 into 18?');
    expect(getHint(equivalent, 1)!.text).not.toMatch(/answer is|equals 6/i);
    expect(getHint(makeFractionCompareItem(3, 8, 3, 4), 1)!.text).toMatch(/numerators match/i);
  });

  it('distinguishes comparison strategy skills and prioritizes a visual bridge', () => {
    expect(inferGrade3SkillId(makeFractionCompareItem(1, 4, 3, 4))).toBe('g3-frac-compare-same-denominator');
    expect(inferGrade3SkillId(makeFractionCompareItem(3, 8, 3, 4))).toBe('g3-frac-compare-same-numerator');
    const sequence = planFractionFocusSequence('g3-frac-compare', ['fraction:compare_larger_denominator_means_larger']);
    expect(sequence.representations).toContain('same_numerator');
    expect(sequence.itemIds[0]).toMatch(/^FCMP_1_4_1_2|^FCMP_1_3_1_4|^FCMP_3_8_3_4/);
  });

  it('reconstructs legacy IDs and explanation-choice IDs', () => {
    for (const item of [makeFractionEquivalentItem(2, 3, 2), makeFractionCompareItem(3, 8, 3, 4)]) {
      expect(makeItemFromId(item.id)?.answer).toBe(item.answer);
    }
    const choice = makeFractionStrategyChoiceItem(
      { numerator: 3, denominator: 8 }, { numerator: 3, denominator: 4 }, 'same_numerator', () => 0.5,
    );
    expect(makeItemFromId(choice.id)?.answer).toBe(choice.answer);
    expect(deriveCardKey(choice)).toBe('template:g3-fraction:compare_same_numerator');
  });

  it('requires strategy diversity and delayed evidence for broad comparison mastery', () => {
    const mixed = [
      makeFractionCompareItem(2, 3, 3, 4),
      makeFractionCompareItem(3, 4, 5, 8),
      makeFractionCompareItem(2, 5, 3, 4),
    ];
    const benchmark = makeFractionStrategyChoiceItem(
      { numerator: 3, denominator: 8 }, { numerator: 4, denominator: 6 }, 'benchmark_half', () => 0.5,
    );
    const items = [...mixed, benchmark];
    const events = [...items, mixed[0]].map((item, index) => ({
      id: `event-${index}`, studentId: 'student', sessionId: `session-${index}`,
      itemId: item.id, mode: 'practice' as const, promptShown: item.prompt,
      correctAnswer: item.answer, studentAnswer: item.answer, isCorrect: true, isRetry: false,
      hintUsed: false, latencyMs: 1000, createdAt: index < 3 ? '2026-01-01T12:00:00.000Z' : '2026-01-03T12:00:00.000Z',
    }));
    const summary = deriveGrade3SkillSummaries({
      studentId: 'student', items, mathAnswerEvents: events, itemStates: [], now: '2026-01-04T00:00:00.000Z',
    }).find(value => value.skillId === 'g3-frac-compare');
    expect(summary?.status).toBe('mastered');

    const oneStrategyItems = [
      makeFractionCompareItem(2, 3, 3, 4), makeFractionCompareItem(3, 4, 5, 8),
      makeFractionCompareItem(2, 5, 3, 4), makeFractionCompareItem(3, 5, 5, 8),
    ];
    const oneStrategyEvents = [...oneStrategyItems, oneStrategyItems[0]].map((item, index) => ({
      ...events[index], itemId: item.id, promptShown: item.prompt, correctAnswer: item.answer, studentAnswer: item.answer,
    }));
    const oneStrategy = deriveGrade3SkillSummaries({
      studentId: 'student', items: oneStrategyItems, mathAnswerEvents: oneStrategyEvents,
      itemStates: [], now: '2026-01-04T00:00:00.000Z',
    }).find(value => value.skillId === 'g3-frac-compare');
    expect(oneStrategy?.status).toBe('strong');
  });
});
