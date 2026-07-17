import type { PracticeItem } from '../../types/math';
import type { FractionValue } from '../fractions/types';
import type { Rng } from '../../utils/rng';
import { contentDataForDomain } from './practiceContentSpec';

const SKILL_FRAC = 'SKILL_FRACTIONS';

export type Grade3FractionSchema =
  | 'unit_fraction_model'
  | 'number_line_location'
  | 'equivalent_visual'
  | 'equivalent_missing_numerator'
  | 'equivalent_missing_denominator'
  | 'compare_same_denominator'
  | 'compare_same_numerator'
  | 'compare_benchmark_half'
  | 'compare_mixed';

export interface FractionGeneratorContext {
  rng?: Rng;
}

export interface FractionValidationResult { valid: boolean; issues: string[] }

export function normalizeFraction(value: FractionValue): FractionValue {
  if (!Number.isInteger(value.numerator) || !Number.isInteger(value.denominator) || value.denominator === 0) {
    return value;
  }
  const sign = value.denominator < 0 ? -1 : 1;
  const factor = gcd(Math.abs(value.numerator), Math.abs(value.denominator));
  return { numerator: sign * value.numerator / factor, denominator: sign * value.denominator / factor };
}

export function fractionsEqual(a: FractionValue, b: FractionValue): boolean {
  return a.numerator * b.denominator === b.numerator * a.denominator;
}

export function compareFractions(a: FractionValue, b: FractionValue): -1 | 0 | 1 {
  const delta = a.numerator * b.denominator - b.numerator * a.denominator;
  return delta === 0 ? 0 : delta < 0 ? -1 : 1;
}

function fractionTemplateFields(schemaId: Grade3FractionSchema) {
  return { schemaId, cardKey: `template:g3-fraction:${schemaId}` };
}

function shuffledWithRng<T>(values: readonly T[], rng: Rng): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export function fracEqId(n: number, d: number, targetDen: number): string {
  return `FEQ_${n}_${d}_${targetDen}`;
}
export function fracCmpId(n1: number, d1: number, n2: number, d2: number): string {
  return `FCMP_${n1}_${d1}_${n2}_${d2}`;
}
export function fracNlId(n: number, d: number): string {
  return `FNL_${n}_${d}`;
}

export function makeUnitFractionModelItem(d: number, rng: Rng = Math.random): PracticeItem {
  return {
    id: `FUNIT_1_${d}`, skillId: 'g3-frac-unit', itemType: 'fraction_equivalent',
    ...fractionTemplateFields('unit_fraction_model'),
    fractionSpec: { kind: 'unit_fraction_model', value: { numerator: 1, denominator: d } },
    prompt: `Which fraction names one of ${d} equal parts?`, answer: `1/${d}`, answerInput: 'choice',
    choices: shuffledWithRng([`1/${d}`, `${d}/1`, `1/${d + 1}`], rng),
    tags: ['fractions', 'unit_fraction', 'visual'], difficulty: 0.3,
  };
}

export function unitFractionModelItemIds(): string[] {
  return GRADE3_DENOMINATORS.map(d => `FUNIT_1_${d}`);
}

// ── Fraction number line: mark n/d on a 0-to-1 number line ───────────────────

export function makeFractionNumberLineItem(n: number, d: number): PracticeItem {
  return {
    id: fracNlId(n, d),
    skillId: 'g3-frac-number-line',
    itemType: 'fraction_number_line',
    ...fractionTemplateFields('number_line_location'),
    fractionSpec: { kind: 'locate_number_line', value: { numerator: n, denominator: d }, interval: [0, 1], subdivisions: d },
    prompt: `On a number line from 0 to 1 divided into ${d} equal parts, which mark shows ${n}/${d}? (Count from 0)`,
    answer: n,
    answerInput: 'numeric',
    explanation: `${n}/${d} is ${n} step${n === 1 ? '' : 's'} from 0 when the line is divided into ${d} equal parts.`,
    tags: ['fractions', 'number_line'],
    difficulty: d <= 4 ? 0.4 : 0.55,
    factA: n,
    factB: d,
  };
}

// ── Equivalent fractions: 2/3 = ?/6 ───────────────────────────────────────────

export function makeFractionEquivalentItem(n: number, d: number, mult: number): PracticeItem {
  const targetDen = d * mult;
  const answer = n * mult;
  return {
    id: fracEqId(n, d, targetDen),
    skillId: SKILL_FRAC,
    itemType: 'fraction_equivalent',
    ...fractionTemplateFields('equivalent_missing_numerator'),
    fractionSpec: {
      kind: 'equivalent_visual', left: { numerator: n, denominator: d },
      right: { numerator: answer, denominator: targetDen }, missing: 'right_numerator', multiplier: mult,
    },
    prompt: `${n}/${d} = ?/${targetDen}`,
    answer,
    answerInput: 'numeric',
    explanation: `Multiply top and bottom by ${mult}: ${n}×${mult}=${answer}.`,
    tags: ['fractions', 'equivalent'],
    difficulty: 0.5,
  };
}

export function makeFractionMissingDenominatorItem(n: number, d: number, mult: number): PracticeItem {
  const item = makeFractionEquivalentItem(n, d, mult);
  return {
    ...item,
    id: `FEQD_${n}_${d}_${n * mult}`,
    ...fractionTemplateFields('equivalent_missing_denominator'),
    prompt: `${n}/${d} = ${n * mult}/?`,
    answer: d * mult,
    fractionSpec: {
      kind: 'equivalent_visual', left: { numerator: n, denominator: d },
      right: { numerator: n * mult, denominator: d * mult }, missing: 'right_denominator', multiplier: mult,
    },
  };
}

/** Numerator/denominator ranges with sane fraction defaults. */
function fracRanges(numMin?: number, numMax?: number, denMin?: number, denMax?: number) {
  const dLo = Math.max(2, Math.floor(denMin ?? 2));
  const dHi = Math.max(dLo, Math.floor(denMax ?? 9));
  const nLo = Math.max(0, Math.floor(numMin ?? 0));
  const nHi = Math.max(nLo, Math.floor(numMax ?? 8));
  return { nLo, nHi, dLo, dHi };
}

export function generateFractionEquivalentItems(
  count: number, numMin?: number, numMax?: number, denMin?: number, denMax?: number,
): PracticeItem[] {
  const { nLo, nHi, dLo, dHi } = fracRanges(numMin, numMax, denMin, denMax);
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 60) {
    guard++;
    const d = randInt(dLo, dHi);
    const n = randInt(nLo, Math.min(nHi, d - 1)); // proper fraction
    if (n < 0 || n >= d) continue;
    if (gcd(n, d) !== 1) continue; // start from a reduced fraction
    const mult = randInt(2, 6);
    const item = makeFractionEquivalentItem(n, d, mult);
    if (seen.has(item.id) && items.length < count) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

// ── Compare fractions: 2/3 ▢ 3/4  (answer '<', '=', '>') ──────────────────────

export function makeFractionCompareItem(n1: number, d1: number, n2: number, d2: number): PracticeItem {
  const left = { numerator: n1, denominator: d1 };
  const right = { numerator: n2, denominator: d2 };
  const relation = compareFractions(left, right);
  const answer = relation === 0 ? '=' : relation < 0 ? '<' : '>';
  const strategy = d1 === d2 ? 'same_denominator' : n1 === n2 ? 'same_numerator' : 'general';
  return {
    id: fracCmpId(n1, d1, n2, d2),
    skillId: SKILL_FRAC,
    itemType: 'fraction_compare',
    ...fractionTemplateFields(strategy === 'same_denominator' ? 'compare_same_denominator' : strategy === 'same_numerator' ? 'compare_same_numerator' : 'compare_mixed'),
    fractionSpec: { kind: 'compare', left, right, strategy },
    prompt: `${n1}/${d1}  ▢  ${n2}/${d2}`,
    answer,
    answerInput: 'choice',
    choices: ['<', '=', '>'],
    tags: ['fractions', 'compare'],
    difficulty: 0.55,
  };
}

export function validateFractionItem(item: PracticeItem): FractionValidationResult {
  const issues: string[] = [];
  const spec = contentDataForDomain(item, 'fraction');
  if (!spec) return { valid: false, issues: ['missing_fraction_spec'] };
  const values: FractionValue[] = spec.kind === 'locate_number_line' || spec.kind === 'unit_fraction_model'
    ? [spec.value]
    : spec.kind === 'choose_equivalent_model'
      ? [spec.target, ...spec.options]
      : [spec.left, spec.right];
  if (values.some(value => value.denominator <= 0 || value.numerator < 0)) issues.push('invalid_fraction_value');
  if (spec.kind === 'equivalent_visual' && !fractionsEqual(spec.left, spec.right)) issues.push('not_equivalent');
  if (spec.kind === 'locate_number_line' && spec.subdivisions !== spec.value.denominator) issues.push('invalid_subdivisions');
  if (spec.kind === 'choose_equivalent_model') {
    const correct = spec.options.filter(option => fractionsEqual(option, spec.target));
    if (correct.length !== 1) issues.push('expected_one_equivalent_option');
    if (new Set(spec.options.map(option => `${normalizeFraction(option).numerator}/${normalizeFraction(option).denominator}`)).size !== spec.options.length) {
      issues.push('duplicate_options');
    }
  }
  return { valid: issues.length === 0, issues };
}

export function makeFractionStrategyChoiceItem(
  left: FractionValue,
  right: FractionValue,
  strategy: 'same_denominator' | 'same_numerator' | 'benchmark_half',
  rng: Rng = Math.random,
): PracticeItem {
  const explanationByStrategy = {
    same_denominator: 'The pieces are the same size, so compare the numerators.',
    same_numerator: 'The numerators match, so fewer equal pieces means larger pieces.',
    benchmark_half: 'Compare both fractions with one-half.',
  } as const;
  const correct = explanationByStrategy[strategy];
  const choices = shuffledWithRng([
    correct,
    'The larger denominator always names the larger fraction.',
    'Compare only the numerators and ignore the pieces.',
    'The fractions use different-sized wholes, so they cannot be compared.',
  ], rng);
  const relation = compareFractions(left, right);
  const relationText = relation === 0 ? '=' : relation < 0 ? '<' : '>';
  const schema: Grade3FractionSchema = strategy === 'same_denominator'
    ? 'compare_same_denominator' : strategy === 'same_numerator' ? 'compare_same_numerator' : 'compare_benchmark_half';
  return {
    id: `FCWHY_${strategy}_${left.numerator}_${left.denominator}_${right.numerator}_${right.denominator}`,
    skillId: SKILL_FRAC, itemType: 'fraction_compare', ...fractionTemplateFields(schema),
    prompt: `Why is ${left.numerator}/${left.denominator} ${relationText} ${right.numerator}/${right.denominator}?`,
    answer: correct, answerInput: 'choice', choices,
    fractionSpec: { kind: 'compare', left, right, strategy, explanationChoice: { choices, correct } },
    tags: ['fractions', 'compare', 'explanation', strategy], difficulty: 0.6,
  };
}

export function fractionStrategyChoiceItemIds(): string[] {
  return [
    makeFractionStrategyChoiceItem({ numerator: 1, denominator: 4 }, { numerator: 3, denominator: 4 }, 'same_denominator', () => 0.5).id,
    makeFractionStrategyChoiceItem({ numerator: 3, denominator: 8 }, { numerator: 3, denominator: 4 }, 'same_numerator', () => 0.5).id,
    makeFractionStrategyChoiceItem({ numerator: 3, denominator: 8 }, { numerator: 4, denominator: 6 }, 'benchmark_half', () => 0.5).id,
  ];
}

const GRADE3_DENOMINATORS = [2, 3, 4, 6, 8] as const;

export function generateGrade3FractionItem(
  schema: Grade3FractionSchema,
  context: FractionGeneratorContext = {},
): PracticeItem {
  const rng = context.rng ?? Math.random;
  const pick = <T,>(values: readonly T[]): T => values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
  const denominator = () => pick(GRADE3_DENOMINATORS);
  const properNumerator = (d: number) => 1 + Math.floor(rng() * (d - 1));

  if (schema === 'unit_fraction_model') {
    const d = denominator();
    return makeUnitFractionModelItem(d, rng);
  }
  if (schema === 'number_line_location') {
    const d = denominator();
    return makeFractionNumberLineItem(properNumerator(d), d);
  }
  if (schema.startsWith('equivalent_')) {
    const d = pick([2, 3, 4] as const);
    const n = properNumerator(d);
    const mult = pick([2, 3] as const);
    const item = makeFractionEquivalentItem(n, d, mult);
    if (schema === 'equivalent_missing_denominator') {
      return makeFractionMissingDenominatorItem(n, d, mult);
    }
    return { ...item, ...fractionTemplateFields(schema) };
  }
  if (schema === 'compare_same_denominator') {
    const d = denominator();
    const a = properNumerator(d);
    let b = properNumerator(d);
    if (a === b) b = a === d - 1 ? 1 : a + 1;
    return makeFractionCompareItem(a, d, b, d);
  }
  if (schema === 'compare_same_numerator') {
    const [d1, d2] = pick([[4, 8], [3, 6], [2, 4]] as const);
    const n = Math.min(d1, d2) - 1;
    return makeFractionCompareItem(n, d1, n, d2);
  }
  if (schema === 'compare_benchmark_half') {
    return makeFractionStrategyChoiceItem({ numerator: 3, denominator: 8 }, { numerator: 4, denominator: 6 }, 'benchmark_half', rng);
  }
  const [d1, d2] = pick([[3, 4], [4, 6], [6, 8]] as const);
  const n1 = properNumerator(d1);
  let n2 = properNumerator(d2);
  if (n1 === n2) n2 = n2 === d2 - 1 ? 1 : n2 + 1;
  return makeFractionCompareItem(n1, d1, n2, d2);
}

export function generateFractionCompareItems(
  count: number, numMin?: number, numMax?: number, denMin?: number, denMax?: number,
): PracticeItem[] {
  const { nLo, nHi, dLo, dHi } = fracRanges(numMin, numMax, denMin, denMax);
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 60) {
    guard++;
    const d1 = randInt(dLo, dHi);
    const n1 = randInt(nLo, Math.min(nHi, d1)); // allow n = d (whole)
    const d2 = randInt(dLo, dHi);
    const n2 = randInt(nLo, Math.min(nHi, d2));
    const item = makeFractionCompareItem(n1, d1, n2, d2);
    if (seen.has(item.id) && items.length < count) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

export function generateFractionItems(
  mode: 'equivalent' | 'compare', count: number,
  numMin?: number, numMax?: number, denMin?: number, denMax?: number,
): PracticeItem[] {
  return mode === 'equivalent'
    ? generateFractionEquivalentItems(count, numMin, numMax, denMin, denMax)
    : generateFractionCompareItems(count, numMin, numMax, denMin, denMax);
}
