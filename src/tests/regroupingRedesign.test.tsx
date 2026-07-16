import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeAdditionItem, makeSubtractionItem, generateArithmeticItem } from '../features/curriculum/arithmeticItems';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import {
  analyzeArithmeticStructure,
  buildArithmeticTrace,
  buildRegroupingWorkedExample,
  generateArithmeticErrorAnalysis,
  generateArithmeticInstructionItem,
  simulateArithmeticMisconception,
} from '../features/curriculum/regrouping';
import { detectMistakes } from '../features/mastery/misconceptionEngine';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import { buildRegroupingFocusSequence, planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { deriveGrade3SkillSummaries } from '../features/mastery/skillMasteryEngine';
import { getHint } from '../features/practice/hintEngine';
import { deriveCardKey } from '../features/scheduler/cardModel';
import { policyForItem } from '../features/scheduler/responsePolicy';
import { VisualModel } from '../features/visuals/VisualModel';
import { mulberry32 } from '../utils/rng';

afterEach(cleanup);

describe('arithmetic structure analysis and generation', () => {
  it('builds exact golden traces for carries, borrows, and across-zero chains', () => {
    expect(buildArithmeticTrace('addition', 47, 28)).toMatchObject({
      result: 75,
      columns: [
        { place: 'ones', topBefore: 7, bottom: 8, topAfterBorrowOrCarry: 15, resultDigit: 5 },
        { place: 'tens', topBefore: 4, bottom: 2, topAfterBorrowOrCarry: 7, resultDigit: 7 },
      ],
      actions: [{ kind: 'compose', fromPlace: 'ones', toPlace: 'tens', sourceBefore: 15, sourceAfter: 5 }],
    });
    expect(buildArithmeticTrace('addition', 568, 275).result).toBe(843);
    expect(buildArithmeticTrace('subtraction', 52, 28).result).toBe(24);
    expect(buildArithmeticTrace('subtraction', 532, 174).result).toBe(358);
    const acrossZero = buildArithmeticTrace('subtraction', 703, 458);
    expect(acrossZero).toMatchObject({
      result: 245,
      regroupingProfile: 'across_zero',
      actions: [
        { kind: 'decompose', fromPlace: 'hundreds', toPlace: 'tens', sourceBefore: 7, sourceAfter: 6, targetBefore: 0, targetAfter: 10 },
        { kind: 'decompose', fromPlace: 'tens', toPlace: 'ones', sourceBefore: 10, sourceAfter: 9, targetBefore: 3, targetAfter: 13 },
      ],
      columns: [
        { place: 'ones', topAfterBorrowOrCarry: 13, bottom: 8, resultDigit: 5 },
        { place: 'tens', topAfterBorrowOrCarry: 9, bottom: 5, resultDigit: 4 },
        { place: 'hundreds', topAfterBorrowOrCarry: 6, bottom: 4, resultDigit: 2 },
      ],
    });
    expect(buildArithmeticTrace('subtraction', 900, 376)).toMatchObject({
      result: 524, regroupingProfile: 'multiple_zeroes',
    });
    expect(buildArithmeticTrace('subtraction', 864, 321).actions).toEqual([]);
  });

  it('conserves place value and computes exact results across thousands of operand pairs', () => {
    const placeValue = { ones: 1, tens: 10, hundreds: 100, thousands: 1000 };
    for (let a = 10; a < 1000; a += 7) {
      for (let b = 10; b <= a; b += 13) {
        for (const operation of ['addition', 'subtraction'] as const) {
          const trace = buildArithmeticTrace(operation, a, b);
          expect(trace.result).toBe(operation === 'addition' ? a + b : a - b);
          expect(trace.columns.every(column => column.resultDigit >= 0 && column.resultDigit <= 9)).toBe(true);
          for (const action of trace.actions) {
            const sourceChange = (action.sourceBefore - action.sourceAfter) * placeValue[action.fromPlace];
            const targetChange = (action.targetAfter - action.targetBefore) * placeValue[action.toPlace];
            expect(sourceChange).toBe(targetChange);
          }
        }
      }
    }
  });

  it('classifies exact column actions and zero chains', () => {
    expect(analyzeArithmeticStructure('addition', 47, 28).regrouping).toBe('ones_only');
    expect(analyzeArithmeticStructure('addition', 56, 47).regrouping).toBe('ones_and_tens');
    expect(analyzeArithmeticStructure('addition', 40, 70).regrouping).toBe('tens_only');
    expect(analyzeArithmeticStructure('subtraction', 532, 174).regrouping).toBe('ones_and_tens');
    expect(analyzeArithmeticStructure('subtraction', 703, 458).regrouping).toBe('across_zero');
    expect(analyzeArithmeticStructure('subtraction', 900, 376).regrouping).toBe('multiple_zeroes');
  });

  it('generates operands that satisfy every requested profile', () => {
    for (const operation of ['addition', 'subtraction'] as const) {
      for (const profile of ['none', 'ones_only', 'tens_only', 'ones_and_tens'] as const) {
        const item = generateArithmeticItem(
          { operation, digits: 3, regrouping: profile, avoidNegative: true },
          { rng: mulberry32(profile.length * 100 + operation.length) },
        );
        expect(item.arithmeticSpec?.structure.regrouping).toBe(profile);
        if (operation === 'subtraction') expect(item.answer as number).toBeGreaterThanOrEqual(0);
      }
    }
    for (const profile of ['across_zero', 'multiple_zeroes'] as const) {
      const item = generateArithmeticItem(
        { operation: 'subtraction', digits: 3, regrouping: profile, avoidNegative: true },
        { rng: mulberry32(profile.length * 77) },
      );
      expect(item.arithmeticSpec?.structure.regrouping).toBe(profile);
    }
  });

  it('uses template cards by operation, digits, and profile while preserving legacy reconstruction', () => {
    const a = makeSubtractionItem(703, 458);
    const b = makeSubtractionItem(804, 576);
    expect(deriveCardKey(a)).toBe(deriveCardKey(b));
    expect(deriveCardKey(a)).toContain('sub-3digit-across_zero');
    expect(makeItemFromId(a.id)?.answer).toBe(a.answer);
    expect(makeItemFromId(makeAdditionItem(247, 386).id)?.arithmeticSpec).toBeDefined();
  });
});

describe('place-value instruction, misconceptions, and hints', () => {
  it('renders regrouping actions without revealing the result before review', () => {
    const item = makeSubtractionItem(703, 458);
    const { rerender } = render(<VisualModel item={item} />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/decompose/i);
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toContain('245');
    rerender(<VisualModel item={item} revealAnswer />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('answer 245');
  });

  it('builds worked steps and misconception-based error analysis', () => {
    const item = makeSubtractionItem(703, 458);
    const spec = item.arithmeticSpec!;
    expect(buildRegroupingWorkedExample(spec).some(step => step.highlightPlace === 'ones')).toBe(true);
    const shown = simulateArithmeticMisconception(spec, 'sub_across_zero_error');
    expect(shown?.answer).not.toBe(item.answer);
    const analysis = generateArithmeticErrorAnalysis(spec, 'sub_across_zero_error');
    expect(analysis.answerInput).toBe('choice');
    expect(analysis.arithmeticSpec?.workedError?.errorCode).toBe('sub_across_zero_error');
    expect(analysis.arithmeticSpec?.workedError?.shownWork).toEqual([
      'Borrowed from hundreds to ones but skipped updating the tens column.',
    ]);
    const worked = buildRegroupingWorkedExample(spec);
    expect(worked.map(step => step.explanation)).toContain('hundreds: 7 → 6; tens: 0 → 10.');
    expect(worked.map(step => step.explanation)).toContain('tens: 10 → 9; ones: 3 → 13.');
    for (const mode of ['choose_regroup_step', 'complete_expanded_form', 'estimate_then_compute'] as const) {
      const instructional = generateArithmeticInstructionItem(item, mode);
      expect(instructional.arithmeticSpec?.mode).toBe(mode);
      expect(instructional.cardKey).toContain(mode);
    }
  });

  it('detects counterfactual errors and gives place-specific progressive hints', () => {
    const item = makeSubtractionItem(703, 458);
    const wrong = simulateArithmeticMisconception(item.arithmeticSpec!, 'sub_across_zero_error')!;
    expect(detectMistakes(item, wrong.answer)).toContain('arithmetic:sub_across_zero_error');
    expect(getHint(item, 1)!.text).toMatch(/ones column/i);
    expect(getHint(item, 2)!.text).toMatch(/decompose/i);
    expect(getHint(item, 3)!.text).not.toContain(String(item.answer));
  });

  it('simulates every supported regrouping misconception from column structure', () => {
    const specs = {
      addition: makeAdditionItem(56, 47).arithmeticSpec!,
      subtraction: makeSubtractionItem(532, 174).arithmeticSpec!,
      acrossZero: makeSubtractionItem(703, 458).arithmeticSpec!,
    };
    const cases = [
      [specs.subtraction, 'sub_failed_to_regroup_ones'],
      [specs.subtraction, 'sub_failed_to_regroup_tens'],
      [specs.acrossZero, 'sub_across_zero_error'],
      [specs.subtraction, 'sub_borrowed_without_reducing_source'],
      [specs.subtraction, 'sub_place_value_shift_10'],
      [specs.subtraction, 'sub_place_value_shift_100'],
      [specs.addition, 'add_failed_to_carry_ones'],
      [specs.addition, 'add_failed_to_carry_tens'],
      [specs.addition, 'add_double_carried'],
      [specs.subtraction, 'copied_operand_or_partial_result'],
    ] as const;
    for (const [spec, code] of cases) {
      const simulated = simulateArithmeticMisconception(spec, code);
      expect(simulated, code).not.toBeNull();
      const item = spec.operation === 'addition' ? makeAdditionItem(spec.a, spec.b) : makeSubtractionItem(spec.a, spec.b);
      expect(detectMistakes(item, simulated!.answer)).toContain(`arithmetic:${code}`);
    }
  });

  it('returns deterministic alternative algorithms only when applicable and wrong', () => {
    const codes = [
      'sub_failed_to_regroup_ones', 'sub_failed_to_regroup_tens', 'sub_across_zero_error',
      'sub_borrowed_without_reducing_source', 'sub_place_value_shift_10', 'sub_place_value_shift_100',
      'add_failed_to_carry_ones', 'add_failed_to_carry_tens', 'add_double_carried',
      'copied_operand_or_partial_result',
    ] as const;
    const specs = [
      makeAdditionItem(47, 28).arithmeticSpec!,
      makeAdditionItem(568, 275).arithmeticSpec!,
      makeSubtractionItem(52, 28).arithmeticSpec!,
      makeSubtractionItem(532, 174).arithmeticSpec!,
      makeSubtractionItem(703, 458).arithmeticSpec!,
      makeSubtractionItem(900, 376).arithmeticSpec!,
    ];
    for (const spec of specs) {
      const correct = spec.operation === 'addition' ? spec.a + spec.b : spec.a - spec.b;
      for (const code of codes) {
        const first = simulateArithmeticMisconception(spec, code);
        const second = simulateArithmeticMisconception(spec, code);
        expect(second).toEqual(first);
        if (first) {
          expect(first.answer).not.toBe(correct);
          expect(first.shownWork.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps correct multi-step work independent of speed', () => {
    expect(policyForItem(makeSubtractionItem(900, 376))).toEqual({ kind: 'procedural', useLatencyForFsrs: false });
  });
});

describe('regrouping mastery and focus planning', () => {
  it('credits across-zero evidence only to its distinct skill', () => {
    expect(inferGrade3SkillId(makeSubtractionItem(703, 458))).toBe('g3-sub-across-zero');
    expect(inferGrade3SkillId(makeSubtractionItem(532, 174))).toBe('g3-sub-3digit-regrouping');
    const across = planPracticeForSkill('g3-sub-across-zero').specificItemIds!;
    expect(across.length).toBeGreaterThan(0);
    expect(across.every(id => inferGrade3SkillId(makeItemFromId(id)!) === 'g3-sub-across-zero')).toBe(true);
    expect(across.filter(id => id.startsWith('ARERR_'))).toHaveLength(3);
    const errorItem = makeItemFromId('ARERR_subtraction_703_458_sub_across_zero_error');
    expect(errorItem?.arithmeticSpec?.mode).toBe('error_analysis');
    expect(errorItem?.choices).toContain(errorItem?.answer);
  });

  it('builds a misconception-aware concept-to-transfer sequence', () => {
    const sequence = buildRegroupingFocusSequence('g3-sub-across-zero', ['arithmetic:sub_across_zero_error']);
    expect(sequence.representations).toEqual([
      'place_value_activation', 'worked_error_repair', 'scaffolded_compute', 'near_transfer', 'independent',
    ]);
    expect(sequence.itemIds.some(id => id === 'SUB_703m458')).toBe(true);
  });

  it('requires multiple regrouping profiles and sessions before mastery', () => {
    const diverse = [
      makeSubtractionItem(532, 174), makeSubtractionItem(654, 327),
      makeSubtractionItem(652, 371), makeSubtractionItem(835, 467),
    ];
    const eventsFor = (items: typeof diverse) => [...items, items[0]].map((item, index) => ({
      id: `regroup-${index}`, studentId: 'student', sessionId: index < 3 ? 'first' : 'second',
      itemId: item.id, mode: 'practice' as const, promptShown: item.prompt,
      correctAnswer: item.answer, studentAnswer: item.answer, isCorrect: true, isRetry: false,
      hintUsed: false, latencyMs: 12_000, createdAt: `2026-01-0${index < 3 ? 1 : 2}T12:00:00.000Z`,
    }));
    const mastered = deriveGrade3SkillSummaries({
      studentId: 'student', items: diverse, mathAnswerEvents: eventsFor(diverse), itemStates: [], now: '2026-01-03T00:00:00.000Z',
    }).find(summary => summary.skillId === 'g3-sub-3digit-regrouping');
    expect(mastered?.status).toBe('mastered');

    const oneProfile = [
      makeSubtractionItem(532, 174), makeSubtractionItem(835, 467),
      makeSubtractionItem(524, 267), makeSubtractionItem(963, 478),
    ];
    const strong = deriveGrade3SkillSummaries({
      studentId: 'student', items: oneProfile, mathAnswerEvents: eventsFor(oneProfile), itemStates: [], now: '2026-01-03T00:00:00.000Z',
    }).find(summary => summary.skillId === 'g3-sub-3digit-regrouping');
    expect(strong?.status).toBe('strong');
  });
});
