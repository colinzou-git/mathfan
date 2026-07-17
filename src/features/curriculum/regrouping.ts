import type { PracticeItem } from '../../types/math';
import type { Rng } from '../../utils/rng';
import { contentDataForDomain, withPracticeContentSpec } from './practiceContentSpec';

export type RegroupingProfile =
  | 'none'
  | 'ones_only'
  | 'tens_only'
  | 'ones_and_tens'
  | 'across_zero'
  | 'multiple_zeroes';

export type ArithmeticMisconceptionCode =
  | 'sub_failed_to_regroup_ones'
  | 'sub_failed_to_regroup_tens'
  | 'sub_across_zero_error'
  | 'sub_borrowed_without_reducing_source'
  | 'sub_place_value_shift_10'
  | 'sub_place_value_shift_100'
  | 'add_failed_to_carry_ones'
  | 'add_failed_to_carry_tens'
  | 'add_double_carried'
  | 'copied_operand_or_partial_result';

export type ArithmeticPlace = 'ones' | 'tens' | 'hundreds' | 'thousands';

export interface ColumnValue {
  place: ArithmeticPlace;
  topBefore: number;
  bottom: number;
  topAfterBorrowOrCarry: number;
  resultDigit: number;
}

export interface RegroupingAction {
  kind: 'compose' | 'decompose';
  fromPlace: ArithmeticPlace;
  toPlace: ArithmeticPlace;
  sourceBefore: number;
  sourceAfter: number;
  targetBefore: number;
  targetAfter: number;
}

export interface ArithmeticTrace {
  operation: 'addition' | 'subtraction';
  a: number;
  b: number;
  columns: ColumnValue[];
  actions: RegroupingAction[];
  result: number;
  regroupingProfile: RegroupingProfile;
}

export interface ArithmeticStructure {
  operation: 'addition' | 'subtraction';
  digits: 2 | 3;
  regrouping: RegroupingProfile;
  columnActions: Array<{
    place: 'ones' | 'tens' | 'hundreds';
    action: 'none' | 'compose' | 'decompose';
  }>;
}

export interface ArithmeticQuestionSpec {
  operation: 'addition' | 'subtraction';
  a: number;
  b: number;
  structure: ArithmeticStructure;
  mode: 'compute' | 'choose_regroup_step' | 'complete_expanded_form' | 'error_analysis' | 'estimate_then_compute';
  workedError?: { shownAnswer: number; errorCode: ArithmeticMisconceptionCode; shownWork?: string[] };
}

export interface WorkedStep {
  expression: string;
  explanation: string;
  highlightPlace?: 'ones' | 'tens' | 'hundreds';
}

export interface ArithmeticGenerationConstraints {
  operation: 'addition' | 'subtraction';
  digits: 2 | 3;
  regrouping: RegroupingProfile | RegroupingProfile[];
  resultMin?: number;
  resultMax?: number;
  avoidNegative?: boolean;
}

export interface ArithmeticGeneratorContext { rng?: Rng; recentItemIds?: string[] }

const digit = (value: number, place: number) => Math.floor(value / 10 ** place) % 10;
const PLACES: ArithmeticPlace[] = ['ones', 'tens', 'hundreds', 'thousands'];

function profileForTrace(operation: ArithmeticTrace['operation'], a: number, actions: RegroupingAction[]): RegroupingProfile {
  if (actions.length === 0) return 'none';
  const actionPlaces = new Set(actions.map(action => operation === 'addition' ? action.fromPlace : action.toPlace));
  if (operation === 'subtraction'
    && actions.some(action => action.fromPlace === 'hundreds' && action.toPlace === 'tens' && action.targetBefore === 0)
    && actions.some(action => action.fromPlace === 'tens' && action.toPlace === 'ones' && action.sourceBefore === 10)) {
    return digit(a, 0) === 0 ? 'multiple_zeroes' : 'across_zero';
  }
  const ones = actionPlaces.has('ones');
  const tens = actionPlaces.has('tens');
  return ones && tens ? 'ones_and_tens' : ones ? 'ones_only' : 'tens_only';
}

export function buildArithmeticTrace(
  operation: 'addition' | 'subtraction',
  a: number,
  b: number,
): ArithmeticTrace {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) throw new Error('Column arithmetic requires nonnegative integers');
  if (operation === 'subtraction' && a < b) throw new Error('Grade 3 subtraction trace requires a nonnegative result');
  const width = Math.max(2, String(Math.max(a, b)).length);
  const top = Array.from({ length: width + 1 }, (_, index) => digit(a, index));
  const bottom = Array.from({ length: width + 1 }, (_, index) => digit(b, index));
  const columns: ColumnValue[] = [];
  const actions: RegroupingAction[] = [];
  let carry = 0;

  for (let index = 0; index < width; index++) {
    const place = PLACES[index];
    const topBefore = top[index];
    if (operation === 'addition') {
      const total = top[index] + bottom[index] + carry;
      const resultDigit = total % 10;
      const nextCarry = Math.floor(total / 10);
      columns.push({ place, topBefore, bottom: bottom[index], topAfterBorrowOrCarry: total, resultDigit });
      if (nextCarry) {
        actions.push({
          kind: 'compose', fromPlace: place, toPlace: PLACES[index + 1],
          sourceBefore: total, sourceAfter: resultDigit,
          targetBefore: top[index + 1], targetAfter: top[index + 1] + nextCarry,
        });
      }
      carry = nextCarry;
    } else {
      if (top[index] < bottom[index]) {
        let source = index + 1;
        while (source < top.length && top[source] === 0) source++;
        if (source >= top.length) throw new Error('Unable to find a source column to decompose');
        while (source > index) {
          const target = source - 1;
          const sourceBefore = top[source];
          const targetBefore = top[target];
          top[source] -= 1;
          top[target] += 10;
          actions.push({
            kind: 'decompose', fromPlace: PLACES[source], toPlace: PLACES[target],
            sourceBefore, sourceAfter: top[source], targetBefore, targetAfter: top[target],
          });
          source--;
        }
      }
      const resultDigit = top[index] - bottom[index];
      columns.push({
        place, topBefore, bottom: bottom[index],
        topAfterBorrowOrCarry: top[index], resultDigit,
      });
    }
  }
  if (operation === 'addition' && carry) {
    columns.push({
      place: PLACES[width], topBefore: 0, bottom: 0,
      topAfterBorrowOrCarry: carry, resultDigit: carry,
    });
  } else if (top[width] > 0) {
    columns.push({
      place: PLACES[width], topBefore: digit(a, width), bottom: digit(b, width),
      topAfterBorrowOrCarry: top[width], resultDigit: top[width] - bottom[width],
    });
  }
  const result = columns.reduce((sum, column, index) => sum + column.resultDigit * 10 ** index, 0);
  const trace = { operation, a, b, columns, actions, result, regroupingProfile: 'none' as RegroupingProfile };
  trace.regroupingProfile = profileForTrace(operation, a, actions);
  return trace;
}

export function analyzeArithmeticStructure(
  operation: 'addition' | 'subtraction', a: number, b: number,
): ArithmeticStructure {
  const trace = buildArithmeticTrace(operation, a, b);
  const digits: 2 | 3 = Math.max(a, b) >= 100 ? 3 : 2;
  return {
    operation,
    digits,
    regrouping: trace.regroupingProfile,
    columnActions: (['ones', 'tens', 'hundreds'] as const).slice(0, digits).map(place => ({
      place,
      action: trace.actions.some(action => (operation === 'addition' ? action.fromPlace : action.toPlace) === place)
        ? operation === 'addition' ? 'compose' as const : 'decompose' as const
        : 'none' as const,
    })),
  };
}

export function arithmeticTemplateKey(spec: ArithmeticQuestionSpec): string {
  const op = spec.operation === 'addition' ? 'add' : 'sub';
  return `template:g3-${op}-${spec.structure.digits}digit-${spec.structure.regrouping}-${spec.mode}`;
}

export function buildRegroupingWorkedExample(spec: ArithmeticQuestionSpec): WorkedStep[] {
  const symbol = spec.operation === 'addition' ? '+' : '−';
  const steps: WorkedStep[] = [{ expression: `${spec.a} ${symbol} ${spec.b}`, explanation: 'Line up hundreds, tens, and ones by place value.' }];
  const trace = buildArithmeticTrace(spec.operation, spec.a, spec.b);
  for (const action of trace.actions) {
    steps.push({
      expression: action.kind === 'compose'
        ? `${action.sourceBefore} ${action.fromPlace} become ${action.sourceAfter} ${action.fromPlace} and 1 ${action.toPlace}`
        : `1 ${action.fromPlace} becomes 10 ${action.toPlace}`,
      explanation: `${action.fromPlace}: ${action.sourceBefore} → ${action.sourceAfter}; ${action.toPlace}: ${action.targetBefore} → ${action.targetAfter}.`,
      highlightPlace: action.toPlace === 'thousands' ? 'hundreds' : action.toPlace,
    });
  }
  for (const column of trace.columns.slice(0, spec.structure.digits)) {
    steps.push({
      expression: `${column.topAfterBorrowOrCarry} ${spec.operation === 'addition' ? '+' : '−'} ${column.bottom} → ${column.resultDigit}`,
      explanation: `Compute the ${column.place} column.`,
      highlightPlace: column.place === 'thousands' ? 'hundreds' : column.place,
    });
  }
  return steps;
}

export interface ArithmeticMisconceptionSimulation {
  answer: number;
  shownWork: string[];
}

export function simulateArithmeticMisconception(
  spec: ArithmeticQuestionSpec,
  code: ArithmeticMisconceptionCode,
): ArithmeticMisconceptionSimulation | null {
  const { a, b, operation } = spec;
  const correct = operation === 'addition' ? a + b : a - b;
  const result = (answer: number, shownWork: string[]) =>
    Number.isInteger(answer) && answer !== correct && answer >= 0 ? { answer, shownWork } : null;
  if (code === 'copied_operand_or_partial_result') return result(a, ['Copied the first operand as the result.']);
  if (operation === 'addition') {
    const trace = buildArithmeticTrace(operation, a, b);
    const onesCarry = trace.actions.find(action => action.kind === 'compose' && action.fromPlace === 'ones');
    const tensCarry = trace.actions.find(action => action.kind === 'compose' && action.fromPlace === 'tens');
    if (code === 'add_failed_to_carry_ones' && onesCarry) return result(correct - 10, ['Composed the ones but did not add the new ten.']);
    if (code === 'add_failed_to_carry_tens' && tensCarry) return result(correct - 100, ['Composed the tens but did not add the new hundred.']);
    if (code === 'add_double_carried' && (onesCarry || tensCarry)) {
      const placeValue = tensCarry ? 100 : 10;
      return result(correct + placeValue, [`Added the composed ${tensCarry ? 'hundred' : 'ten'} twice.`]);
    }
    return null;
  }
  const trace = buildArithmeticTrace(operation, a, b);
  const digitwise = (skipPlace?: ArithmeticPlace) => {
    const digits = trace.columns.slice(0, spec.structure.digits).map((column, index) =>
      skipPlace === column.place ? Math.abs(digit(a, index) - digit(b, index)) : column.resultDigit);
    return digits.reduce((sum, value, index) => sum + value * 10 ** index, 0);
  };
  if (code === 'sub_failed_to_regroup_ones' && trace.actions.some(action => action.toPlace === 'ones')) {
    return result(digitwise('ones'), ['Subtracted the smaller ones digit from the larger without regrouping.']);
  }
  if (code === 'sub_failed_to_regroup_tens' && trace.actions.some(action => action.toPlace === 'tens')) {
    return result(digitwise('tens'), ['Subtracted the smaller tens digit from the larger without regrouping.']);
  }
  if (code === 'sub_across_zero_error' && (trace.regroupingProfile === 'across_zero' || trace.regroupingProfile === 'multiple_zeroes')) {
    const ones = digit(a, 0) + 10 - digit(b, 0);
    const tens = Math.abs(digit(a, 1) - digit(b, 1));
    const hundreds = digit(a, 2) - 1 - digit(b, 2);
    return result(ones + tens * 10 + hundreds * 100, ['Borrowed from hundreds to ones but skipped updating the tens column.']);
  }
  if (code === 'sub_borrowed_without_reducing_source' && trace.actions.length) {
    const first = trace.actions[trace.actions.length - 1];
    const placeValue = 10 ** PLACES.indexOf(first.fromPlace);
    return result(correct + placeValue, [`Regrouped into ${first.toPlace} but did not reduce ${first.fromPlace}.`]);
  }
  if (code === 'sub_place_value_shift_10') return result(a - Math.floor(b / 10), ['Aligned the second number one place too far right.']);
  if (code === 'sub_place_value_shift_100') return result(a - Math.floor(b / 100), ['Aligned the second number two places too far right.']);
  return null;
}

export function generateArithmeticErrorAnalysis(
  spec: ArithmeticQuestionSpec,
  errorCode: ArithmeticMisconceptionCode,
): PracticeItem {
  const simulation = simulateArithmeticMisconception(spec, errorCode);
  if (!simulation) throw new Error(`${errorCode} is not applicable to ${spec.a} and ${spec.b}`);
  const shownAnswer = simulation.answer;
  const correctPlace = errorCode.includes('ones') || errorCode.includes('10') ? 'ones' : errorCode.includes('tens') || errorCode.includes('100') ? 'tens' : 'regrouping';
  const choices = ['ones', 'tens', 'hundreds', 'regrouping'];
  const errorSpec: ArithmeticQuestionSpec = { ...spec, mode: 'error_analysis', workedError: { shownAnswer, errorCode, shownWork: simulation.shownWork } };
  return {
    id: `ARERR_${spec.operation}_${spec.a}_${spec.b}_${errorCode}`,
    skillId: `g3-${spec.operation === 'addition' ? 'add' : 'sub'}-${spec.structure.digits}digit-regrouping`,
    itemType: spec.operation === 'addition' ? 'addition_fact' : 'subtraction_fact',
    prompt: `A learner wrote ${spec.a} ${spec.operation === 'addition' ? '+' : '−'} ${spec.b} = ${shownAnswer}. Which place should they check first?`,
    answer: correctPlace, answerInput: 'choice', choices, arithmeticSpec: errorSpec,
    cardKey: arithmeticTemplateKey(errorSpec), schemaId: `${spec.operation}_${spec.structure.digits}digit_${spec.structure.regrouping}_error_analysis`,
    tags: ['arithmetic', 'regrouping', 'error_analysis', errorCode], difficulty: 0.7,
    factA: spec.a, factB: spec.b,
  };
}

export function generateArithmeticInstructionItem(
  base: PracticeItem,
  mode: 'choose_regroup_step' | 'complete_expanded_form' | 'estimate_then_compute',
): PracticeItem {
  const source = contentDataForDomain(base, 'arithmetic');
  if (!source) throw new Error('Structured arithmetic item required');
  const spec: ArithmeticQuestionSpec = { ...source, mode };
  const symbol = source.operation === 'addition' ? '+' : '−';
  if (mode === 'choose_regroup_step') {
    const first = source.structure.columnActions.find(column => column.action !== 'none');
    const answer = first?.place ?? 'none';
    return withPracticeContentSpec({
      ...base, id: `ARSTEP_${source.operation}_${source.a}_${source.b}`,
      prompt: `For ${source.a} ${symbol} ${source.b}, which place needs regrouping first?`,
      answer, answerInput: 'choice', choices: ['ones', 'tens', 'hundreds', 'none'],
      cardKey: arithmeticTemplateKey(spec), schemaId: `${source.operation}_${source.structure.digits}digit_${source.structure.regrouping}_${mode}`,
      tags: [...base.tags, 'choose_regroup_step'],
    }, { domain: 'arithmetic', version: 1, data: spec });
  }
  if (mode === 'complete_expanded_form') {
    const place = source.structure.digits === 3 ? 100 : 10;
    const answer = Math.floor(source.a / place) * place;
    return withPracticeContentSpec({
      ...base, id: `AREXP_${source.operation}_${source.a}_${source.b}`,
      prompt: `Complete the expanded form: ${source.a} = ? + ${source.a % place}. What belongs in the blank?`,
      answer, answerInput: 'numeric',
      cardKey: arithmeticTemplateKey(spec), schemaId: `${source.operation}_${source.structure.digits}digit_${source.structure.regrouping}_${mode}`,
      tags: [...base.tags, 'expanded_form'],
    }, { domain: 'arithmetic', version: 1, data: spec });
  }
  const answer = source.operation === 'addition' ? source.a + source.b : source.a - source.b;
  return withPracticeContentSpec({
    ...base, id: `AREST_${source.operation}_${source.a}_${source.b}`,
    prompt: `Estimate to check, then compute ${source.a} ${symbol} ${source.b}.`,
    answer, answerInput: 'numeric',
    cardKey: arithmeticTemplateKey(spec), schemaId: `${source.operation}_${source.structure.digits}digit_${source.structure.regrouping}_${mode}`,
    tags: [...base.tags, 'estimate_then_compute'],
  }, { domain: 'arithmetic', version: 1, data: spec });
}

export function generateArithmeticOperands(
  constraints: ArithmeticGenerationConstraints,
  context: ArithmeticGeneratorContext = {},
): { a: number; b: number; structure: ArithmeticStructure } {
  const rng = context.rng ?? Math.random;
  const profiles = Array.isArray(constraints.regrouping) ? constraints.regrouping : [constraints.regrouping];
  const min = constraints.digits === 2 ? 10 : 100;
  const max = constraints.digits === 2 ? 99 : 999;
  const recent = new Set(context.recentItemIds ?? []);
  for (let attempt = 0; attempt < 20_000; attempt++) {
    const rawA = min + Math.floor(rng() * (max - min + 1));
    const rawB = min + Math.floor(rng() * (max - min + 1));
    const a = constraints.operation === 'subtraction' && constraints.avoidNegative !== false ? Math.max(rawA, rawB) : rawA;
    const b = constraints.operation === 'subtraction' && constraints.avoidNegative !== false ? Math.min(rawA, rawB) : rawB;
    const structure = analyzeArithmeticStructure(constraints.operation, a, b);
    const result = constraints.operation === 'addition' ? a + b : a - b;
    const id = constraints.operation === 'addition' ? `ADD_${a}p${b}` : `SUB_${a}m${b}`;
    if (!profiles.includes(structure.regrouping) || recent.has(id)) continue;
    if (constraints.resultMin != null && result < constraints.resultMin) continue;
    if (constraints.resultMax != null && result > constraints.resultMax) continue;
    return { a, b, structure };
  }
  throw new Error(`Unable to generate ${constraints.operation} ${constraints.digits}-digit ${profiles.join('/')}`);
}
