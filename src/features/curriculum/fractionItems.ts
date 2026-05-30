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

export function generateFractionEquivalentItems(count: number): PracticeItem[] {
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 40) {
    guard++;
    const d = randInt(2, 9);
    const n = randInt(1, d - 1);
    if (gcd(n, d) !== 1) continue; // start from a reduced fraction
    const mult = randInt(2, 6);
    const item = makeFractionEquivalentItem(n, d, mult);
    if (seen.has(item.id)) continue;
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

export function generateFractionCompareItems(count: number): PracticeItem[] {
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 40) {
    guard++;
    const d1 = randInt(2, 9);
    const n1 = randInt(1, d1);
    const d2 = randInt(2, 9);
    const n2 = randInt(1, d2);
    const item = makeFractionCompareItem(n1, d1, n2, d2);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

export function generateFractionItems(mode: 'equivalent' | 'compare', count: number): PracticeItem[] {
  return mode === 'equivalent'
    ? generateFractionEquivalentItems(count)
    : generateFractionCompareItems(count);
}
