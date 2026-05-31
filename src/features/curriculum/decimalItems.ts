import type { PracticeItem, GradeLevel } from '../../types/math';

const SKILL_DEC = 'SKILL_DECIMALS';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Format hundredths-int → decimal string, trimming trailing zero ("250"→"2.5"). */
export function fmtDecimal(hundredths: number): string {
  const v = hundredths / 100;
  // up to 2 dp, drop trailing zeros
  return String(parseFloat(v.toFixed(2)));
}

/** Encode a decimal string into an id-safe token: "2.5" → "2p5". */
function tok(hundredths: number): string {
  return fmtDecimal(hundredths).replace('.', 'p');
}

export function decAddId(a: number, b: number): string { return `DADD_${tok(a)}_${tok(b)}`; }
export function decSubId(a: number, b: number): string { return `DSUB_${tok(a)}_${tok(b)}`; }

function round2(n: number): number { return Math.round(n * 100) / 100; }

export function makeDecimalAddItem(aH: number, bH: number): PracticeItem {
  return {
    id: decAddId(aH, bH),
    skillId: SKILL_DEC,
    itemType: 'decimal_add',
    prompt: `${fmtDecimal(aH)} + ${fmtDecimal(bH)}`,
    answer: round2((aH + bH) / 100),
    answerInput: 'numeric',
    tags: ['decimals', 'add'],
    difficulty: 0.55,
  };
}

export function makeDecimalSubItem(aH: number, bH: number): PracticeItem {
  const hi = Math.max(aH, bH), lo = Math.min(aH, bH);
  return {
    id: decSubId(hi, lo),
    skillId: SKILL_DEC,
    itemType: 'decimal_sub',
    prompt: `${fmtDecimal(hi)} − ${fmtDecimal(lo)}`,
    answer: round2((hi - lo) / 100),
    answerInput: 'numeric',
    tags: ['decimals', 'subtract'],
    difficulty: 0.6,
  };
}

/** Grade 4 → tenths (step 10), grade 5 → hundredths (step 5); max value scales too. */
function decimalParams(grade: GradeLevel): { step: number; maxH: number } {
  if (grade <= 4) return { step: 10, maxH: 990 };   // 0.1 .. 9.9
  return { step: 5, maxH: 2000 };                     // 0.05 .. 20.00
}

/**
 * `rangeMin`/`rangeMax` are decimal *values* (e.g. 0 and 20). The step (tenths
 * vs hundredths) still follows the grade; the range just caps the magnitude.
 */
export function generateDecimalItems(
  grade: GradeLevel, count: number, rangeMin?: number, rangeMax?: number,
): PracticeItem[] {
  const { step, maxH } = decimalParams(grade);
  const hiH = rangeMax !== undefined ? Math.max(step, Math.round(rangeMax * 100)) : maxH;
  const loH = rangeMin !== undefined ? Math.max(0, Math.round(rangeMin * 100)) : 0;
  const loStep = Math.max(1, Math.ceil(loH / step));
  const hiStep = Math.max(loStep, Math.floor(hiH / step));
  const items: PracticeItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard < count * 40) {
    guard++;
    const aH = randInt(loStep, hiStep) * step;
    const bH = randInt(loStep, hiStep) * step;
    const item = Math.random() < 0.5 ? makeDecimalAddItem(aH, bH) : makeDecimalSubItem(aH, bH);
    if (seen.has(item.id) && items.length < count) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}
