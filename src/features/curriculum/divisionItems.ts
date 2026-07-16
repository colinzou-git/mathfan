import type { PracticeItem } from '../../types/math';
import type { ArithmeticGeneratorContext as TemplateGeneratorContext } from './regrouping';

export type DivisionSchema =
  | 'fact_recall' | 'unknown_factor' | 'equal_sharing' | 'measurement_grouping'
  | 'decompose_tens_ones' | 'decompose_partial_quotients'
  | 'verify_with_multiplication' | 'word_problem_choose_model';

export interface DivisionContext {
  interpretation: 'sharing' | 'grouping';
  noun: string;
  groupNoun: string;
}

export interface DivisionQuestionSpec {
  schema: DivisionSchema;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder?: number;
  decomposition?: Array<{ dividendPart: number; quotientPart: number }>;
  context?: DivisionContext;
  unknownPosition?: 'group_size' | 'group_count' | 'factor';
}

export interface DivisionGenerationConstraints {
  schema: DivisionSchema;
  divisorMin?: number;
  divisorMax?: number;
  quotientMin?: number;
  quotientMax?: number;
  dividendMax?: number;
  allowRemainder?: boolean;
}

export interface DivisionDecomposition {
  dividend: number;
  divisor: number;
  parts: number[];
  partialQuotients: number[];
}

export function validateDivisionDecomposition(value: DivisionDecomposition): boolean {
  return value.divisor > 0
    && value.parts.length >= 2
    && value.parts.length === value.partialQuotients.length
    && value.parts.reduce((sum, part) => sum + part, 0) === value.dividend
    && value.parts.every((part, index) => part > 0 && part % value.divisor === 0
      && part / value.divisor === value.partialQuotients[index]);
}

export function findFriendlyDivisionDecomposition(dividend: number, divisor: number): DivisionDecomposition | null {
  if (divisor < 1 || dividend < divisor || dividend % divisor !== 0) return null;
  const quotient = dividend / divisor;
  for (const quotientPart of [20, 10, 5, 4, 3, 2]) {
    if (quotientPart >= quotient) continue;
    const parts = [divisor * quotientPart, dividend - divisor * quotientPart];
    const candidate = { dividend, divisor, parts, partialQuotients: [quotientPart, quotient - quotientPart] };
    if (validateDivisionDecomposition(candidate)) return candidate;
  }
  return null;
}

export function divisionCardKey(spec: DivisionQuestionSpec): string {
  if (spec.schema === 'fact_recall') return `fact:div:${spec.dividend}/${spec.divisor}`;
  const keys: Record<DivisionSchema, string> = {
    fact_recall: '', unknown_factor: 'template:g3-div-unknown-factor',
    equal_sharing: 'template:g3-div-sharing-model', measurement_grouping: 'template:g3-div-grouping-model',
    decompose_tens_ones: 'template:g3-div-two-digit-decomposition',
    decompose_partial_quotients: 'template:g3-div-two-digit-decomposition',
    verify_with_multiplication: 'template:g3-div-verify-multiplication',
    word_problem_choose_model: 'template:g3-div-choose-model',
  };
  return keys[spec.schema];
}

export function divisionSkillIdForSchema(schema: DivisionSchema, divisor: number): string {
  if (schema === 'fact_recall') return divisor <= 5 ? 'g3-div-within-100' : 'g3-div-mul-relationship';
  if (schema === 'unknown_factor' || schema === 'verify_with_multiplication') return 'g3-div-mul-relationship';
  if (schema === 'equal_sharing' || schema === 'measurement_grouping') return 'g3-div-sharing-grouping';
  if (schema.startsWith('decompose_')) return 'g3-div-decomposition';
  return 'g3-div-word-problems';
}

export function validateDivisionItem(item: PracticeItem): string[] {
  const spec = item.divisionSpec;
  if (!spec) return ['missing divisionSpec'];
  const errors: string[] = [];
  if (!Number.isInteger(spec.dividend) || !Number.isInteger(spec.divisor) || spec.divisor <= 0) errors.push('invalid operands');
  if (spec.dividend % spec.divisor !== 0 || spec.remainder) errors.push('unsupported remainder');
  if (spec.quotient !== spec.dividend / spec.divisor || item.answer !== (
    spec.schema === 'verify_with_multiplication' ? `${spec.quotient} × ${spec.divisor} = ${spec.dividend}`
      : spec.schema === 'word_problem_choose_model' ? `${spec.dividend} ÷ ${spec.divisor}`
        : spec.quotient
  )) errors.push('answer/spec mismatch');
  if (item.skillId !== divisionSkillIdForSchema(spec.schema, spec.divisor)) errors.push('skill/schema mismatch');
  if (item.cardKey !== divisionCardKey(spec)) errors.push('card/schema mismatch');
  if (spec.schema.startsWith('decompose_')) {
    const parts = spec.decomposition ?? [];
    const decomposition = {
      dividend: spec.dividend, divisor: spec.divisor,
      parts: parts.map(part => part.dividendPart),
      partialQuotients: parts.map(part => part.quotientPart),
    };
    if (!validateDivisionDecomposition(decomposition)) errors.push('invalid decomposition');
  }
  if (['equal_sharing', 'measurement_grouping', 'word_problem_choose_model'].includes(spec.schema)) {
    if (!spec.context) errors.push('missing division context');
    if (spec.schema === 'equal_sharing' && spec.context?.interpretation !== 'sharing') errors.push('sharing schema/context mismatch');
    if (spec.schema === 'measurement_grouping' && spec.context?.interpretation !== 'grouping') errors.push('grouping schema/context mismatch');
  }
  if ((item.answerInput ?? 'numeric') === 'numeric' && !Number.isInteger(Number(item.answer))) errors.push('non-integer numeric answer');
  return errors;
}

export function makeStructuredDivisionItem(spec: DivisionQuestionSpec): PracticeItem {
  const { schema, dividend, divisor, quotient } = spec;
  if (spec.remainder || dividend % divisor !== 0 || quotient !== dividend / divisor) {
    throw new Error('Grade 3 structured division requires an exact whole-number quotient');
  }
  const interpretationSuffix = schema === 'word_problem_choose_model' && spec.context?.interpretation === 'grouping'
    ? '_grouping' : '';
  const id = schema === 'fact_recall' ? `DIV_${dividend}d${divisor}` : `DIVQ_${schema}${interpretationSuffix}_${dividend}_${divisor}`;
  let prompt = `${dividend} ÷ ${divisor}`;
  let answer: string | number = quotient;
  let choices: Array<string | number> | undefined;
  if (schema === 'unknown_factor') prompt = `${divisor} × ? = ${dividend}`;
  if (schema === 'equal_sharing') prompt = `${dividend} counters are shared equally among ${divisor} groups. How many are in each group?`;
  if (schema === 'measurement_grouping') prompt = `${dividend} counters are put into groups of ${divisor}. How many groups are made?`;
  if (schema.startsWith('decompose_')) {
    const d = spec.decomposition!;
    prompt = `Use ${d[0].dividendPart} + ${d[1].dividendPart} to solve ${dividend} ÷ ${divisor}.`;
  }
  if (schema === 'verify_with_multiplication') {
    prompt = `Which equation verifies ${dividend} ÷ ${divisor} = ${quotient}?`;
    answer = `${quotient} × ${divisor} = ${dividend}`;
    choices = [answer, `${divisor} + ${quotient} = ${dividend}`, `${dividend} × ${divisor} = ${quotient}`];
  }
  if (schema === 'word_problem_choose_model') {
    const grouping = spec.context?.interpretation === 'grouping';
    prompt = grouping
      ? `${dividend} ${spec.context?.noun ?? 'counters'} go ${divisor} in each ${spec.context?.groupNoun ?? 'bag'}. Choose the equation.`
      : `${dividend} ${spec.context?.noun ?? 'counters'} are shared among ${divisor} ${spec.context?.groupNoun ?? 'children'}. Choose the equation.`;
    answer = `${dividend} ÷ ${divisor}`;
    choices = [answer, `${divisor} ÷ ${dividend}`, `${dividend} × ${divisor}`];
  }
  const item: PracticeItem = {
    id, skillId: divisionSkillIdForSchema(schema, divisor), itemType: schema === 'unknown_factor' ? 'unknown_factor' : schema === 'word_problem_choose_model' ? 'word_problem' : 'division_fact',
    prompt, answer, choices, answerInput: choices ? 'choice' : 'numeric', tags: ['division', schema], difficulty: schema === 'fact_recall' ? 0.45 : 0.65,
    factA: dividend, factB: divisor, divisionSpec: spec, schemaId: `division_${schema}`, cardKey: divisionCardKey(spec),
  };
  const errors = validateDivisionItem(item);
  if (errors.length) throw new Error(`Invalid structured division item ${id}: ${errors.join('; ')}`);
  return item;
}

export function generateDivisionItem(constraints: DivisionGenerationConstraints, context: TemplateGeneratorContext = {}): PracticeItem {
  if (constraints.allowRemainder) {
    throw new Error('Grade 3 remainder division is unsupported; use a future quotient-and-remainder schema');
  }
  const rng = context.rng ?? Math.random;
  const minD = Math.max(2, constraints.divisorMin ?? 2), maxD = Math.max(minD, constraints.divisorMax ?? 9);
  const minQ = Math.max(1, constraints.quotientMin ?? 2), maxQ = Math.max(minQ, constraints.quotientMax ?? (constraints.schema.startsWith('decompose_') ? 30 : 10));
  for (let attempt = 0; attempt < 100; attempt++) {
    const divisor = minD + Math.floor(rng() * (maxD - minD + 1));
    const quotient = minQ + Math.floor(rng() * (maxQ - minQ + 1));
    const dividend = divisor * quotient;
    if (dividend > (constraints.dividendMax ?? 100)) continue;
    const decomposition = constraints.schema.startsWith('decompose_') ? findFriendlyDivisionDecomposition(dividend, divisor) : null;
    if (constraints.schema.startsWith('decompose_') && !decomposition) continue;
    const spec: DivisionQuestionSpec = {
      schema: constraints.schema, dividend, divisor, quotient,
      ...(decomposition ? { decomposition: decomposition.parts.map((part, i) => ({ dividendPart: part, quotientPart: decomposition.partialQuotients[i] })) } : {}),
      ...(['equal_sharing', 'measurement_grouping', 'word_problem_choose_model'].includes(constraints.schema) ? (() => {
        const interpretation = constraints.schema === 'measurement_grouping'
          || (constraints.schema === 'word_problem_choose_model' && rng() < .5) ? 'grouping' as const : 'sharing' as const;
        return {
          context: { interpretation, noun: 'counters', groupNoun: interpretation === 'grouping' ? 'bag' : 'child' },
          unknownPosition: interpretation === 'grouping' ? 'group_count' as const : 'group_size' as const,
        };
      })() : {}),
    };
    const item = makeStructuredDivisionItem(spec);
    if (!context.recentItemIds?.includes(item.id)) return item;
  }
  throw new Error('Unable to generate a division item for these constraints');
}

/** Fresh decomposition practice after an error, preserving the strategy's divisor. */
export function generateDivisionNearTransfer(spec: DivisionQuestionSpec, context: TemplateGeneratorContext = {}): PracticeItem {
  return generateDivisionItem({
    schema: spec.schema.startsWith('decompose_') ? spec.schema : 'decompose_tens_ones',
    divisorMin: spec.divisor, divisorMax: spec.divisor, quotientMin: 3, quotientMax: 30, dividendMax: 100,
  }, { ...context, recentItemIds: [...(context.recentItemIds ?? []), `DIVQ_${spec.schema}_${spec.dividend}_${spec.divisor}`] });
}

export interface FactFamily { factors: [number, number]; product: number; multiplicationCardKey: string; divisionCardKeys: string[] }
export function factFamilyForDivision(spec: DivisionQuestionSpec): FactFamily {
  const factors: [number, number] = [spec.divisor, spec.quotient].sort((a, b) => a - b) as [number, number];
  return { factors, product: spec.dividend, multiplicationCardKey: `fact:mul:${factors[0]}x${factors[1]}`, divisionCardKeys: [`fact:div:${spec.dividend}/${spec.divisor}`, `fact:div:${spec.dividend}/${spec.quotient}`] };
}

export type DivisionMisconceptionCode = 'div_swapped_dividend_divisor' | 'div_used_multiplication_result'
  | 'div_shared_vs_grouped_confusion' | 'div_partial_quotient_missing' | 'div_decomposition_sum_error'
  | 'div_quotient_off_by_one' | 'div_used_related_fact_incorrectly' | 'div_copied_dividend_or_divisor';

export interface DivisionMisconceptionSimulation {
  code: DivisionMisconceptionCode;
  answer: number;
  explanation: string;
  applicable: boolean;
}

export function simulateDivisionMisconception(
  spec: DivisionQuestionSpec,
  code: DivisionMisconceptionCode,
): DivisionMisconceptionSimulation {
  const first = spec.decomposition?.[0];
  const simulations: Record<DivisionMisconceptionCode, Omit<DivisionMisconceptionSimulation, 'code'>> = {
    div_swapped_dividend_divisor: {
      answer: 0,
      explanation: 'Reversed division is not represented as a valid Grade 3 whole-number answer.',
      applicable: false,
    },
    div_used_multiplication_result: {
      answer: spec.divisor * spec.divisor,
      explanation: 'Multiplied the divisor by itself instead of finding the missing factor.',
      applicable: spec.divisor * spec.divisor !== spec.quotient,
    },
    div_shared_vs_grouped_confusion: {
      answer: spec.divisor,
      explanation: 'Reported the given number of groups or group size.', applicable: spec.divisor !== spec.quotient,
    },
    div_partial_quotient_missing: {
      answer: first?.quotientPart ?? spec.quotient - 1,
      explanation: 'Stopped after the first partial quotient.', applicable: Boolean(first),
    },
    div_decomposition_sum_error: {
      answer: spec.decomposition ? Math.abs(spec.decomposition[0].quotientPart - spec.decomposition[1].quotientPart) : spec.quotient - 1,
      explanation: 'Subtracted partial quotients instead of adding them.', applicable: Boolean(spec.decomposition?.length === 2),
    },
    div_quotient_off_by_one: {
      answer: spec.quotient + 1,
      explanation: 'Counted one extra group.', applicable: true,
    },
    div_used_related_fact_incorrectly: {
      answer: spec.quotient + spec.divisor,
      explanation: 'Added the divisor after recalling the related fact.', applicable: true,
    },
    div_copied_dividend_or_divisor: {
      answer: spec.dividend,
      explanation: 'Copied the dividend instead of solving.', applicable: true,
    },
  };
  return { code, ...simulations[code] };
}
