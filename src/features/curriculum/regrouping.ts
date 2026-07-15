import type { PracticeItem } from '../../types/math';
import type { Rng } from '../../utils/rng';

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

export function analyzeArithmeticStructure(
  operation: 'addition' | 'subtraction', a: number, b: number,
): ArithmeticStructure {
  const digits: 2 | 3 = Math.max(a, b) >= 100 ? 3 : 2;
  let ones: boolean;
  let tens: boolean;
  if (operation === 'addition') {
    ones = digit(a, 0) + digit(b, 0) >= 10;
    tens = digit(a, 1) + digit(b, 1) + (ones ? 1 : 0) >= 10;
  } else {
    ones = digit(a, 0) < digit(b, 0);
    tens = digit(a, 1) - (ones ? 1 : 0) < digit(b, 1);
  }

  let regrouping: RegroupingProfile = ones && tens ? 'ones_and_tens' : ones ? 'ones_only' : tens ? 'tens_only' : 'none';
  if (operation === 'subtraction' && ones && digit(a, 1) === 0) {
    regrouping = digit(a, 0) === 0 ? 'multiple_zeroes' : 'across_zero';
  }
  return {
    operation,
    digits,
    regrouping,
    columnActions: [
      { place: 'ones', action: ones ? (operation === 'addition' ? 'compose' : 'decompose') : 'none' },
      { place: 'tens', action: tens ? (operation === 'addition' ? 'compose' : 'decompose') : 'none' },
      ...(digits === 3 ? [{ place: 'hundreds' as const, action: 'none' as const }] : []),
    ],
  };
}

export function arithmeticTemplateKey(spec: ArithmeticQuestionSpec): string {
  const op = spec.operation === 'addition' ? 'add' : 'sub';
  return `template:g3-${op}-${spec.structure.digits}digit-${spec.structure.regrouping}-${spec.mode}`;
}

export function buildRegroupingWorkedExample(spec: ArithmeticQuestionSpec): WorkedStep[] {
  const symbol = spec.operation === 'addition' ? '+' : '−';
  const steps: WorkedStep[] = [{ expression: `${spec.a} ${symbol} ${spec.b}`, explanation: 'Line up hundreds, tens, and ones by place value.' }];
  for (const column of spec.structure.columnActions) {
    if (column.action === 'none') continue;
    steps.push({
      expression: column.action === 'compose' ? '10 ones make 1 ten' : '1 larger unit becomes 10 smaller units',
      explanation: `${column.action === 'compose' ? 'Compose' : 'Decompose'} in the ${column.place} column before continuing.`,
      highlightPlace: column.place,
    });
  }
  steps.push({ expression: 'Check each column', explanation: 'Work from ones to tens to hundreds, then use an estimate to check reasonableness.' });
  return steps;
}

export function simulateArithmeticMisconception(
  spec: ArithmeticQuestionSpec,
  code: ArithmeticMisconceptionCode,
): number | null {
  const { a, b, operation } = spec;
  const correct = operation === 'addition' ? a + b : a - b;
  if (code === 'copied_operand_or_partial_result') return a;
  if (operation === 'addition') {
    if (code === 'add_failed_to_carry_ones' && digit(a, 0) + digit(b, 0) >= 10) return correct - 10;
    if (code === 'add_failed_to_carry_tens' && spec.structure.columnActions[1].action === 'compose') return correct - 100;
    if (code === 'add_double_carried' && spec.structure.regrouping !== 'none') return correct + (spec.structure.regrouping === 'ones_only' ? 10 : 100);
    return null;
  }
  if (code === 'sub_failed_to_regroup_ones' && spec.structure.columnActions[0].action === 'decompose') {
    return correct - 10;
  }
  if (code === 'sub_failed_to_regroup_tens' && spec.structure.columnActions[1].action === 'decompose') return correct - 100;
  if (code === 'sub_across_zero_error' && (spec.structure.regrouping === 'across_zero' || spec.structure.regrouping === 'multiple_zeroes')) return correct + 10;
  if (code === 'sub_borrowed_without_reducing_source' && spec.structure.regrouping !== 'none') return correct + 10;
  if (code === 'sub_place_value_shift_10') return correct + 10;
  if (code === 'sub_place_value_shift_100') return correct + 100;
  return null;
}

export function generateArithmeticErrorAnalysis(
  spec: ArithmeticQuestionSpec,
  errorCode: ArithmeticMisconceptionCode,
): PracticeItem {
  const shownAnswer = simulateArithmeticMisconception(spec, errorCode) ?? (spec.operation === 'addition' ? spec.a + spec.b : spec.a - spec.b) + 10;
  const correctPlace = errorCode.includes('ones') || errorCode.includes('10') ? 'ones' : errorCode.includes('tens') || errorCode.includes('100') ? 'tens' : 'regrouping';
  const choices = ['ones', 'tens', 'hundreds', 'regrouping'];
  const errorSpec: ArithmeticQuestionSpec = { ...spec, mode: 'error_analysis', workedError: { shownAnswer, errorCode } };
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
  if (!base.arithmeticSpec) throw new Error('Structured arithmetic item required');
  const source = base.arithmeticSpec;
  const spec: ArithmeticQuestionSpec = { ...source, mode };
  const symbol = source.operation === 'addition' ? '+' : '−';
  if (mode === 'choose_regroup_step') {
    const first = source.structure.columnActions.find(column => column.action !== 'none');
    const answer = first?.place ?? 'none';
    return {
      ...base, id: `ARSTEP_${source.operation}_${source.a}_${source.b}`,
      prompt: `For ${source.a} ${symbol} ${source.b}, which place needs regrouping first?`,
      answer, answerInput: 'choice', choices: ['ones', 'tens', 'hundreds', 'none'], arithmeticSpec: spec,
      cardKey: arithmeticTemplateKey(spec), schemaId: `${source.operation}_${source.structure.digits}digit_${source.structure.regrouping}_${mode}`,
      tags: [...base.tags, 'choose_regroup_step'],
    };
  }
  if (mode === 'complete_expanded_form') {
    const place = source.structure.digits === 3 ? 100 : 10;
    const answer = Math.floor(source.a / place) * place;
    return {
      ...base, id: `AREXP_${source.operation}_${source.a}_${source.b}`,
      prompt: `Complete the expanded form: ${source.a} = ? + ${source.a % place}. What belongs in the blank?`,
      answer, answerInput: 'numeric', arithmeticSpec: spec,
      cardKey: arithmeticTemplateKey(spec), schemaId: `${source.operation}_${source.structure.digits}digit_${source.structure.regrouping}_${mode}`,
      tags: [...base.tags, 'expanded_form'],
    };
  }
  const answer = source.operation === 'addition' ? source.a + source.b : source.a - source.b;
  return {
    ...base, id: `AREST_${source.operation}_${source.a}_${source.b}`,
    prompt: `Estimate to check, then compute ${source.a} ${symbol} ${source.b}.`,
    answer, answerInput: 'numeric', arithmeticSpec: spec,
    cardKey: arithmeticTemplateKey(spec), schemaId: `${source.operation}_${source.structure.digits}digit_${source.structure.regrouping}_${mode}`,
    tags: [...base.tags, 'estimate_then_compute'],
  };
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
