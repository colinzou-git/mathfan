import type { PracticeItem } from '../../types/math';

const SKILL_FRAC = 'SKILL_FRACTIONS';

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

// ── Fraction number line: mark n/d on a 0-to-1 number line ───────────────────

export function makeFractionNumberLineItem(n: number, d: number): PracticeItem {
  return {
    id: fracNlId(n, d),
    skillId: 'g3-frac-number-line',
    itemType: 'fraction_number_line',
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
    prompt: `${n}/${d} = ?/${targetDen}`,
    answer,
    answerInput: 'numeric',
    explanation: `Multiply top and bottom by ${mult}: ${n}×${mult}=${answer}.`,
    tags: ['fractions', 'equivalent'],
    difficulty: 0.5,
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
  const v1 = n1 / d1;
  const v2 = n2 / d2;
  const answer = Math.abs(v1 - v2) < 1e-9 ? '=' : v1 < v2 ? '<' : '>';
  return {
    id: fracCmpId(n1, d1, n2, d2),
    skillId: SKILL_FRAC,
    itemType: 'fraction_compare',
    prompt: `${n1}/${d1}  ▢  ${n2}/${d2}`,
    answer,
    answerInput: 'choice',
    choices: ['<', '=', '>'],
    tags: ['fractions', 'compare'],
    difficulty: 0.55,
  };
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
