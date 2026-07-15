import type { PracticeItem } from '../../types/math';
import type { ArithmeticGeneratorContext as TemplateGeneratorContext } from './regrouping';

export type DivisionSchema =
  | 'fact_recall' | 'unknown_factor' | 'equal_sharing' | 'measurement_grouping'
  | 'decompose_tens_ones' | 'decompose_partial_quotients'
  | 'verify_with_multiplication' | 'word_problem_choose_model';

export interface DivisionQuestionSpec {
  schema: DivisionSchema;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder?: number;
  decomposition?: Array<{ dividendPart: number; quotientPart: number }>;
  context?: { interpretation: 'sharing' | 'grouping'; noun: string; groupNoun: string };
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

export function makeStructuredDivisionItem(spec: DivisionQuestionSpec): PracticeItem {
  const { schema, dividend, divisor, quotient } = spec;
  const id = schema === 'fact_recall' ? `DIV_${dividend}d${divisor}` : `DIVQ_${schema}_${dividend}_${divisor}`;
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
  return {
    id, skillId: 'SKILL_DIV_FACTS', itemType: schema === 'unknown_factor' ? 'unknown_factor' : schema === 'word_problem_choose_model' ? 'word_problem' : 'division_fact',
    prompt, answer, choices, answerInput: choices ? 'choice' : 'numeric', tags: ['division', schema], difficulty: schema === 'fact_recall' ? 0.45 : 0.65,
    factA: dividend, factB: divisor, divisionSpec: spec, schemaId: `division_${schema}`, cardKey: divisionCardKey(spec),
  };
}

export function generateDivisionItem(constraints: DivisionGenerationConstraints, context: TemplateGeneratorContext = {}): PracticeItem {
  const rng = context.rng ?? Math.random;
  const minD = Math.max(2, constraints.divisorMin ?? 2), maxD = Math.max(minD, constraints.divisorMax ?? 9);
  const minQ = Math.max(1, constraints.quotientMin ?? 2), maxQ = Math.max(minQ, constraints.quotientMax ?? (constraints.schema.startsWith('decompose_') ? 30 : 10));
  for (let attempt = 0; attempt < 100; attempt++) {
    const divisor = minD + Math.floor(rng() * (maxD - minD + 1));
    const quotient = minQ + Math.floor(rng() * (maxQ - minQ + 1));
    const remainder = constraints.allowRemainder ? Math.floor(rng() * divisor) : 0;
    const dividend = divisor * quotient + remainder;
    if (dividend > (constraints.dividendMax ?? 100) || (!constraints.allowRemainder && remainder)) continue;
    const decomposition = constraints.schema.startsWith('decompose_') ? findFriendlyDivisionDecomposition(dividend, divisor) : null;
    if (constraints.schema.startsWith('decompose_') && !decomposition) continue;
    const spec: DivisionQuestionSpec = {
      schema: constraints.schema, dividend, divisor, quotient, ...(remainder ? { remainder } : {}),
      ...(decomposition ? { decomposition: decomposition.parts.map((part, i) => ({ dividendPart: part, quotientPart: decomposition.partialQuotients[i] })) } : {}),
      ...(['equal_sharing', 'measurement_grouping', 'word_problem_choose_model'].includes(constraints.schema) ? {
        context: { interpretation: constraints.schema === 'measurement_grouping' ? 'grouping' : 'sharing', noun: 'counters', groupNoun: constraints.schema === 'measurement_grouping' ? 'bag' : 'child' },
        unknownPosition: constraints.schema === 'measurement_grouping' ? 'group_count' as const : 'group_size' as const,
      } : {}),
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

export function simulateDivisionMisconception(spec: DivisionQuestionSpec, code: DivisionMisconceptionCode): number {
  const first = spec.decomposition?.[0];
  const values: Record<DivisionMisconceptionCode, number> = {
    div_swapped_dividend_divisor: spec.divisor / spec.dividend,
    div_used_multiplication_result: spec.dividend * spec.divisor,
    div_shared_vs_grouped_confusion: spec.divisor,
    div_partial_quotient_missing: first?.quotientPart ?? Math.max(1, spec.quotient - 1),
    div_decomposition_sum_error: spec.decomposition?.reduce((sum, part) => sum + part.dividendPart, 0) ?? spec.dividend,
    div_quotient_off_by_one: spec.quotient + 1,
    div_used_related_fact_incorrectly: spec.quotient + spec.divisor,
    div_copied_dividend_or_divisor: spec.dividend,
  };
  return values[code];
}
