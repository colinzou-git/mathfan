import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  factFamilyForDivision, findFriendlyDivisionDecomposition, generateDivisionItem,
  generateDivisionNearTransfer, makeStructuredDivisionItem, simulateDivisionMisconception, validateDivisionDecomposition,
  type DivisionMisconceptionCode,
} from '../features/curriculum/divisionItems';
import { makeDivisionItem, generateDivisionItemsRange } from '../features/curriculum/arithmeticItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { getRelatedItemIds } from '../features/adaptive/relatedItemMapping';
import { detectMistakes } from '../features/mastery/misconceptionEngine';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import { buildDivisionFocusSequence, planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { getHint } from '../features/practice/hintEngine';
import { deriveCardKey } from '../features/scheduler/cardModel';
import { policyForItem } from '../features/scheduler/responsePolicy';
import { VisualModel } from '../features/visuals/VisualModel';
import { mulberry32 } from '../utils/rng';

afterEach(cleanup);

describe('structured Grade 3 division generation', () => {
  it('finds and validates friendly decompositions', () => {
    expect(findFriendlyDivisionDecomposition(84, 3)).toEqual({ dividend: 84, divisor: 3, parts: [60, 24], partialQuotients: [20, 8] });
    expect(findFriendlyDivisionDecomposition(96, 4)).toEqual({ dividend: 96, divisor: 4, parts: [80, 16], partialQuotients: [20, 4] });
    expect(validateDivisionDecomposition(findFriendlyDivisionDecomposition(72, 6)!)).toBe(true);
  });

  it('generates valid no-remainder items and avoids recent instances', () => {
    for (const schema of ['fact_recall', 'unknown_factor', 'equal_sharing', 'measurement_grouping', 'decompose_tens_ones', 'decompose_partial_quotients', 'verify_with_multiplication', 'word_problem_choose_model'] as const) {
      const item = generateDivisionItem({ schema, divisorMin: 3, divisorMax: 6, quotientMin: 3, quotientMax: 20, dividendMax: 100 }, { rng: mulberry32(schema.length * 31) });
      expect(item.divisionSpec!.dividend % item.divisionSpec!.divisor).toBe(0);
      expect(item.divisionSpec!.remainder).toBeUndefined();
      if (item.divisionSpec!.decomposition) expect(item.divisionSpec!.decomposition.reduce((sum, p) => sum + p.dividendPart, 0)).toBe(item.divisionSpec!.dividend);
    }
    expect(generateDivisionItemsRange(2, 9, 20, 20, 100).every(item => Number.isInteger(Number(item.answer)))).toBe(true);
  });

  it('preserves legacy IDs and separates atomic from template cards', () => {
    expect(makeItemFromId('DIV_56d7')?.answer).toBe(8);
    expect(deriveCardKey(makeDivisionItem(56, 7))).toBe('fact:div:56/7');
    const decomposition = makeItemFromId('DIVQ_decompose_tens_ones_84_3')!;
    expect(decomposition.divisionSpec?.decomposition?.map(part => part.quotientPart)).toEqual([20, 8]);
    expect(deriveCardKey(decomposition)).toBe('template:g3-div-two-digit-decomposition');
    expect(policyForItem(decomposition).useLatencyForFsrs).toBe(false);
  });

  it('builds conservative fact-family and embedded-fact relations', () => {
    const item = makeItemFromId('DIVQ_decompose_tens_ones_84_3')!;
    expect(factFamilyForDivision(item.divisionSpec!)).toEqual({ factors: [3, 28], product: 84, multiplicationCardKey: 'fact:mul:3x28', divisionCardKeys: ['fact:div:84/3', 'fact:div:84/28'] });
    expect(getRelatedItemIds(item)).toEqual(['DIV_60d3', 'DIV_24d3', 'MUL_3x28']);
  });
});

describe('division meaning, feedback, and planning', () => {
  const sharing = makeStructuredDivisionItem({ schema: 'equal_sharing', dividend: 24, divisor: 4, quotient: 6, context: { interpretation: 'sharing', noun: 'counters', groupNoun: 'children' }, unknownPosition: 'group_size' });
  const grouping = makeStructuredDivisionItem({ schema: 'measurement_grouping', dividend: 24, divisor: 4, quotient: 6, context: { interpretation: 'grouping', noun: 'counters', groupNoun: 'bags' }, unknownPosition: 'group_count' });
  const decomposition = makeItemFromId('DIVQ_decompose_tens_ones_84_3')!;

  it('encodes different sharing and grouping unknowns and accessible visuals', () => {
    expect(sharing.prompt).toMatch(/among 4 groups/);
    expect(grouping.prompt).toMatch(/groups of 4/);
    expect(sharing.divisionSpec?.unknownPosition).toBe('group_size');
    expect(grouping.divisionSpec?.unknownPosition).toBe('group_count');
    render(<VisualModel item={decomposition} />);
    expect(screen.getByRole('figure', { name: /decomposition model for 84 divided by 3/i })).toHaveTextContent('84 = 60 + 24');
    expect(screen.queryByText(/to get 28/)).not.toBeInTheDocument();
  });

  it('offers unique plausible model-choice distractors', () => {
    const item = makeItemFromId('DIVQ_word_problem_choose_model_24_4')!;
    expect(new Set(item.choices).size).toBe(item.choices?.length);
    expect(item.choices).toContain('24 ÷ 4');
  });

  it('detects each structured counterfactual', () => {
    const codes: DivisionMisconceptionCode[] = ['div_swapped_dividend_divisor', 'div_used_multiplication_result', 'div_shared_vs_grouped_confusion', 'div_partial_quotient_missing', 'div_decomposition_sum_error', 'div_quotient_off_by_one', 'div_used_related_fact_incorrectly', 'div_copied_dividend_or_divisor'];
    for (const code of codes) {
      const wrong = simulateDivisionMisconception(decomposition.divisionSpec!, code);
      expect(detectMistakes(decomposition, wrong), code).toContain(`div:${code}`);
    }
  });

  it('uses a progressive decomposition hint ladder', () => {
    expect(getHint(decomposition, 1)?.text).toMatch(/total/);
    expect(getHint(decomposition, 3)?.text).toContain('60 + 24');
    expect(getHint(decomposition, 4)?.text).not.toContain('28');
    expect(getHint(decomposition, 5)?.text).toContain('28');
    const transfer = generateDivisionNearTransfer(decomposition.divisionSpec!, { rng: mulberry32(91) });
    expect(transfer.divisionSpec?.divisor).toBe(3);
    expect(transfer.id).not.toBe(decomposition.id);
  });

  it('keeps mastery skills and focus sequences separate', () => {
    expect(inferGrade3SkillId(makeDivisionItem(56, 7))).toBe('g3-div-mul-relationship');
    expect(inferGrade3SkillId(decomposition)).toBe('g3-div-decomposition');
    expect(inferGrade3SkillId(sharing)).toBe('g3-div-sharing-grouping');
    expect(planPracticeForSkill('g3-div-decomposition').specificItemIds?.every(id => inferGrade3SkillId(makeItemFromId(id)!) === 'g3-div-decomposition')).toBe(true);
    const sequence = buildDivisionFocusSequence('g3-div-decomposition', ['div:div_partial_quotient_missing'], {});
    expect(sequence.representations).toEqual(['related_fact', 'model', 'scaffolded_decomposition', 'near_transfer', 'verify', 'word_problem']);
    expect(sequence.itemIds).toHaveLength(7);
  });
});
