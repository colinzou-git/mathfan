import type { PracticeItem } from '../../types/math';

export const TABLE_MIN = 2;
export const TABLE_MAX = 13;

const SKILL_MUL = 'SKILL_MUL_FACTS';
const SKILL_DIV = 'SKILL_DIV_FACTS';

export function mulId(a: number, b: number): string { return `MUL_${a}x${b}`; }
export function divId(dividend: number, divisor: number): string { return `DIV_${dividend}d${divisor}`; }
export function unkId(product: number, known: number): string { return `UNK_${product}k${known}`; }

export function tableFromItemId(itemId: string): number | null {
  const m = itemId.match(/^MUL_(\d+)x/);
  return m ? parseInt(m[1], 10) : null;
}

function difficultyFor(a: number, b: number): number {
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  if (small <= 2) return 0.2;
  if (small === 5 || big === 10) return 0.25;
  if (big <= 6) return 0.4;
  if (big <= 9) return 0.6;
  if (big <= 11) return 0.7;
  return 0.85; // 12× and 13× facts
}

// ── Generators ────────────────────────────────────────────────────────────────

export function generateMultiplicationItems(
  min = TABLE_MIN,
  max = TABLE_MAX
): PracticeItem[] {
  const items: PracticeItem[] = [];
  for (let a = min; a <= max; a++) {
    for (let b = min; b <= max; b++) {
      items.push({
        id: mulId(a, b),
        skillId: SKILL_MUL,
        itemType: 'multiplication_fact',
        prompt: `${a} × ${b}`,
        answer: a * b,
        tags: ['multiplication', `table_${a}`, `table_${b}`],
        difficulty: difficultyFor(a, b),
        factA: a,
        factB: b,
      });
    }
  }
  return items;
}

export function generateDivisionItems(
  min = TABLE_MIN,
  max = TABLE_MAX
): PracticeItem[] {
  const items: PracticeItem[] = [];
  for (let a = min; a <= max; a++) {
    for (let b = min; b <= max; b++) {
      const product = a * b;
      items.push({
        id: divId(product, a),
        skillId: SKILL_DIV,
        itemType: 'division_fact',
        prompt: `${product} ÷ ${a}`,
        answer: b,
        tags: ['division', `table_${a}`],
        difficulty: difficultyFor(a, b),
        factA: product,
        factB: a,
      });
    }
  }
  return items;
}

export function generateUnknownFactorItems(
  min = TABLE_MIN,
  max = TABLE_MAX
): PracticeItem[] {
  const items: PracticeItem[] = [];
  for (let a = min; a <= max; a++) {
    for (let b = min; b <= max; b++) {
      const product = a * b;
      items.push({
        id: unkId(product, a),
        skillId: SKILL_MUL,
        itemType: 'unknown_factor',
        prompt: `${a} × ? = ${product}`,
        answer: b,
        tags: ['unknown_factor', `table_${a}`],
        difficulty: Math.min(1, difficultyFor(a, b) + 0.1),
        factA: a,
        factB: b,
      });
    }
  }
  return items;
}

// ── Range-based generator (factor ranges chosen by the student) ───────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeMultiplicationItem(a: number, b: number): PracticeItem {
  return {
    id: mulId(a, b),
    skillId: SKILL_MUL,
    itemType: 'multiplication_fact',
    prompt: `${a} × ${b}`,
    answer: a * b,
    answerInput: 'numeric',
    tags: ['multiplication', `table_${a}`, `table_${b}`],
    difficulty: difficultyFor(a, b),
    factA: a,
    factB: b,
  };
}

/**
 * Generate `count` multiplication items with the first factor drawn from
 * [aMin, aMax] and the second from [bMin, bMax]. Deduped while the range
 * product is larger than `count`, then allowed to repeat so the count is met.
 */
export function generateMultiplicationRangeItems(
  aMin: number, aMax: number, bMin: number, bMax: number, count: number,
): PracticeItem[] {
  const aLo = Math.max(0, Math.floor(aMin)), aHi = Math.max(aLo, Math.floor(aMax));
  const bLo = Math.max(0, Math.floor(bMin)), bHi = Math.max(bLo, Math.floor(bMax));
  const distinct = (aHi - aLo + 1) * (bHi - bLo + 1);
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 40) {
    guard++;
    const a = randInt(aLo, aHi);
    const b = randInt(bLo, bHi);
    const item = makeMultiplicationItem(a, b);
    if (seen.has(item.id) && items.length < distinct) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

// ── Table-specific helpers ────────────────────────────────────────────────────

/** Items for a single table drill (e.g. table=7 → 7×2…7×13, multiplication only). */
export function generateSingleTableItems(table: number): PracticeItem[] {
  const items: PracticeItem[] = [];
  for (let b = TABLE_MIN; b <= TABLE_MAX; b++) {
    items.push({
      id: mulId(table, b),
      skillId: SKILL_MUL,
      itemType: 'multiplication_fact',
      prompt: `${table} × ${b}`,
      answer: table * b,
      tags: ['multiplication', `table_${table}`, `table_${b}`],
      difficulty: difficultyFor(table, b),
      factA: table,
      factB: b,
    });
  }
  return items;
}

/** Items for a multi-table drill, interleaved from the given tables. */
export function generateMultipleTablesItems(tables: number[]): PracticeItem[] {
  const seen = new Set<string>();
  const items: PracticeItem[] = [];
  for (const t of tables) {
    for (const item of generateSingleTableItems(t)) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        items.push(item);
      }
    }
  }
  return items;
}

/** Sample `count` items from `pool` with replacement if pool is smaller than count. */
export function sampleWithReplacement(pool: PracticeItem[], count: number): string[] {
  if (pool.length === 0) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const result: string[] = [];
  while (result.length < count) {
    for (const item of shuffled) {
      if (result.length >= count) break;
      result.push(item.id);
    }
  }
  return result;
}

// ── Global item catalogue (adaptive daily review uses all facts) ──────────────

export const ALL_ITEMS: PracticeItem[] = [
  ...generateMultiplicationItems(),
  ...generateDivisionItems(),
  ...generateUnknownFactorItems(),
];

export const ITEM_MAP: Map<string, PracticeItem> = new Map(
  ALL_ITEMS.map(i => [i.id, i])
);
