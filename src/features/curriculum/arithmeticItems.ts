import type { PracticeItem } from '../../types/math';

const SKILL_ADD = 'SKILL_ADD';
const SKILL_SUB = 'SKILL_SUB';
const SKILL_DIV = 'SKILL_DIV_FACTS';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clampRange(min: number, max: number): [number, number] {
  let lo = Math.max(0, Math.floor(min));
  let hi = Math.max(lo, Math.floor(max));
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

/** Generate `count` addition items with operands in [min, max], deduped where possible. */
export function generateAdditionItems(min: number, max: number, count: number): PracticeItem[] {
  const [lo, hi] = clampRange(min, max);
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 30) {
    guard++;
    const a = randInt(lo, hi);
    const b = randInt(lo, hi);
    const id = addId(a, b);
    if (seen.has(id) && items.length < (hi - lo + 1) ** 2) continue;
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

export function generateSubtractionItems(min: number, max: number, count: number): PracticeItem[] {
  const [lo, hi] = clampRange(min, max);
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 30) {
    guard++;
    const a = randInt(lo, hi);
    const b = randInt(lo, hi);
    const item = makeSubtractionItem(a, b);
    if (seen.has(item.id) && items.length < (hi - lo + 1) ** 2) continue;
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
 * Divisor and quotient are drawn from [max(2,min), max] so the dividend stays in a sane range.
 */
export function generateDivisionItemsRange(min: number, max: number, count: number): PracticeItem[] {
  const [loRaw, hi] = clampRange(min, max);
  const lo = Math.max(2, loRaw); // avoid ÷1 and ÷0
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 30) {
    guard++;
    const divisor = randInt(lo, Math.max(lo, hi));
    const quotient = randInt(lo, Math.max(lo, hi));
    const dividend = divisor * quotient;
    const item = makeDivisionItem(dividend, divisor);
    if (seen.has(item.id) && items.length < (hi - lo + 1) ** 2) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}
