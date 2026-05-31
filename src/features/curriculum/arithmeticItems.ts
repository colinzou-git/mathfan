import type { PracticeItem } from '../../types/math';

const SKILL_ADD = 'SKILL_ADD';
const SKILL_SUB = 'SKILL_SUB';
const SKILL_DIV = 'SKILL_DIV_FACTS';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampRange(min: number, max: number): [number, number] {
  const lo = Math.max(0, Math.floor(min));
  const hi = Math.max(lo, Math.floor(max));
  return [lo, hi];
}

/** Difficulty heuristic for arithmetic: bigger operands and carrying are harder. */
function arithDifficulty(a: number, b: number): number {
  const big = Math.max(a, b);
  if (big <= 10) return 0.25;
  if (big <= 20) return 0.4;
  if (big <= 100) return 0.6;
  if (big <= 1000) return 0.75;
  return 0.85;
}

export function addId(a: number, b: number): string { return `ADD_${a}p${b}`; }
export function subId(a: number, b: number): string { return `SUB_${a}m${b}`; }
export function divIdStd(dividend: number, divisor: number): string { return `DIV_${dividend}d${divisor}`; }

// ── Addition ──────────────────────────────────────────────────────────────────

export function makeAdditionItem(a: number, b: number): PracticeItem {
  return {
    id: addId(a, b),
    skillId: SKILL_ADD,
    itemType: 'addition_fact',
    prompt: `${a} + ${b}`,
    answer: a + b,
    answerInput: 'numeric',
    tags: ['addition'],
    difficulty: arithDifficulty(a, b),
    factA: a,
    factB: b,
  };
}

/**
 * Generate `count` addition items. The first addend is drawn from [min, max];
 * the second from [min2, max2] when given, otherwise from the same [min, max].
 */
export function generateAdditionItems(
  min: number, max: number, count: number, min2?: number, max2?: number,
): PracticeItem[] {
  const [lo, hi] = clampRange(min, max);
  const [lo2, hi2] = clampRange(min2 ?? min, max2 ?? max);
  const distinct = (hi - lo + 1) * (hi2 - lo2 + 1);
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 30) {
    guard++;
    const a = randInt(lo, hi);
    const b = randInt(lo2, hi2);
    const id = addId(a, b);
    if (seen.has(id) && items.length < distinct) continue;
    seen.add(id);
    items.push(makeAdditionItem(a, b));
  }
  return items;
}

// ── Subtraction (non-negative answers) ────────────────────────────────────────

export function makeSubtractionItem(a: number, b: number): PracticeItem {
  // Ensure a >= b so the answer is non-negative
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return {
    id: subId(hi, lo),
    skillId: SKILL_SUB,
    itemType: 'subtraction_fact',
    prompt: `${hi} − ${lo}`,
    answer: hi - lo,
    answerInput: 'numeric',
    tags: ['subtraction'],
    difficulty: arithDifficulty(hi, lo),
    factA: hi,
    factB: lo,
  };
}

/**
 * Generate `count` subtraction items (answers never negative). Operands are
 * drawn from [min, max] and [min2, max2]; the item always shows larger − smaller.
 */
export function generateSubtractionItems(
  min: number, max: number, count: number, min2?: number, max2?: number,
): PracticeItem[] {
  const [lo, hi] = clampRange(min, max);
  const [lo2, hi2] = clampRange(min2 ?? min, max2 ?? max);
  const distinct = (hi - lo + 1) * (hi2 - lo2 + 1);
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 30) {
    guard++;
    const a = randInt(lo, hi);
    const b = randInt(lo2, hi2);
    const item = makeSubtractionItem(a, b);
    if (seen.has(item.id) && items.length < distinct) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

// ── Division (whole-number quotient) ──────────────────────────────────────────

export function makeDivisionItem(dividend: number, divisor: number): PracticeItem {
  return {
    id: divIdStd(dividend, divisor),
    skillId: SKILL_DIV,
    itemType: 'division_fact',
    prompt: `${dividend} ÷ ${divisor}`,
    answer: dividend / divisor,
    answerInput: 'numeric',
    tags: ['division'],
    difficulty: arithDifficulty(dividend, divisor),
    factA: dividend,
    factB: divisor,
  };
}

/**
 * Generate `count` division items with a whole-number answer.
 *
 * The divisor is drawn from [max(2,divisorMin), divisorMax]. When a dividend
 * range is given, the quotient is chosen so the dividend lands inside
 * [dividendMin, dividendMax] (and stays divisible). Without a dividend range,
 * the divisor and quotient are both drawn from the divisor range — preserving
 * the original "pick two small factors" behaviour.
 */
export function generateDivisionItemsRange(
  divisorMin: number, divisorMax: number, count: number,
  dividendMin?: number, dividendMax?: number,
): PracticeItem[] {
  const [dvLoRaw, dvHi] = clampRange(divisorMin, divisorMax);
  const dvLo = Math.max(1, dvLoRaw); // avoid ÷0
  const hasDividend = dividendMin !== undefined && dividendMax !== undefined;
  const [ddLo, ddHi] = hasDividend ? clampRange(dividendMin!, dividendMax!) : [0, 0];

  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 40) {
    guard++;
    const divisor = randInt(dvLo, Math.max(dvLo, dvHi));
    let dividend: number;
    if (hasDividend) {
      // Quotients whose product with `divisor` stays inside the dividend range.
      const qLo = Math.max(0, Math.ceil(ddLo / divisor));
      const qHi = Math.floor(ddHi / divisor);
      if (qHi < qLo) continue; // no whole multiple of this divisor fits the range
      dividend = divisor * randInt(qLo, qHi);
    } else {
      dividend = divisor * randInt(dvLo, Math.max(dvLo, dvHi));
    }
    const item = makeDivisionItem(dividend, divisor);
    if (seen.has(item.id) && items.length < count) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}
