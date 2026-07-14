import type { GradeLevel, PracticeItem, StudentItemState } from '../../types/math';
import { makeWordProblem, generateWordProblemItems, type Schema } from '../curriculum/wordProblemItems';
import { makeFactorItem, generateNumberTheoryItems } from '../curriculum/numberTheoryItems';
import { enrichRelatedMetadata } from './relatedItemMapping';
import { isNeedyState, scoreCandidateItem } from './adaptiveItemSelector';

/**
 * Cap on how many targeted weak/due candidates to keep, as a multiple of the
 * session length. We collect *every* matching weak/due fact in range first and
 * rank by need, so an urgent fact never gets dropped just for appearing late in
 * stateMap iteration order — only the lowest-need overflow beyond this cap is
 * trimmed.
 */
const TARGET_CAP_FACTOR = 5;

/**
 * State-first candidate pools for the random calculation-embedded modes.
 *
 * Rather than generate a random pool and hope a weak fact lands in it, these
 * builders first scan the student's item-state history for due/weak
 * multiplication & division facts within the chosen operand range and construct
 * higher-level items *around* those exact facts, then mix in fresh random items
 * for variety. The adaptive selector then ranks the combined pool.
 */

const WORD_MUL_SCHEMAS: Schema[] = ['eg', 'ar', 'cmp'];

function factorMax(grade: GradeLevel): number {
  return grade === 3 ? 10 : 12;
}

function factorsHi(grade: GradeLevel): number {
  return grade === 3 ? 30 : grade === 4 ? 60 : 100;
}

/** Word-problem candidates targeting the student's weak/due ×/÷ facts, plus variety. */
export function buildWordProblemCandidates(
  grade: GradeLevel,
  count: number,
  stateMap: Map<string, StudentItemState>,
  now: Date,
  rangeMin?: number,
  rangeMax?: number,
): PracticeItem[] {
  const max = Math.max(0, Math.floor(rangeMax ?? factorMax(grade)));
  const min = Math.max(0, Math.min(max, Math.floor(rangeMin ?? (grade === 3 ? 2 : 3))));
  const inRange = (n: number) => n >= min && n <= max;

  // Targeted: build a word problem around EVERY weak/due ×/÷ fact in range, so
  // ranking — not stateMap iteration order — decides which ones make the cut.
  const targeted: PracticeItem[] = [];
  const targetSeen = new Set<string>();
  const addTargeted = (item: PracticeItem) => {
    if (targetSeen.has(item.id)) return;
    targetSeen.add(item.id);
    targeted.push(item);
  };
  for (const state of stateMap.values()) {
    if (!isNeedyState(state, now)) continue;
    // stateMap is keyed by canonical card key; the concrete, parseable id
    // (e.g. "MUL_7x8") lives on lastItemId — see features/scheduler/cardModel.
    const id = state.lastItemId ?? state.cardKey;
    let m: RegExpMatchArray | null;
    if ((m = id.match(/^MUL_(\d+)x(\d+)$/))) {
      const a = +m[1], b = +m[2];
      if (inRange(a) && inRange(b)) {
        addTargeted(makeWordProblem(WORD_MUL_SCHEMAS[(a + b) % WORD_MUL_SCHEMAS.length], a, b));
      }
    } else if ((m = id.match(/^DIV_(\d+)d(\d+)$/))) {
      // WORD_dv_{groups}_{each} embeds DIV_{groups*each}d{groups}; map divisor→groups, quotient→each.
      const dividend = +m[1], divisor = +m[2];
      const quotient = divisor > 0 ? dividend / divisor : 0;
      if (Number.isInteger(quotient) && divisor >= 1 && inRange(divisor) && inRange(quotient)) {
        addTargeted(makeWordProblem('dv', divisor, quotient));
      }
    }
  }
  // Highest-need first, then trim the long tail.
  targeted.sort((a, b) => scoreCandidateItem(b, stateMap, now) - scoreCandidateItem(a, stateMap, now));

  const out: PracticeItem[] = [];
  const seen = new Set<string>();
  const add = (item: PracticeItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    out.push(enrichRelatedMetadata(item));
  };
  for (const item of targeted.slice(0, count * TARGET_CAP_FACTOR)) add(item);

  // Variety: fresh random word problems mixed in alongside the targeted facts.
  for (const item of generateWordProblemItems(grade, count, rangeMin, rangeMax)) add(item);
  return out;
}

/** Factor/prime candidates derived from weak/due ×/÷ facts, plus prime-composite variety. */
export function buildFactorCandidates(
  grade: GradeLevel,
  count: number,
  stateMap: Map<string, StudentItemState>,
  now: Date,
  rangeMin?: number,
  rangeMax?: number,
): PracticeItem[] {
  const hi = Math.max(3, Math.floor(rangeMax ?? factorsHi(grade)));
  const lo = Math.max(2, Math.min(hi, Math.floor(rangeMin ?? 2)));

  // Targeted: "is X a factor of Y?" items where the divisor/factor relation is
  // known to be true, built from EVERY weak/due division & multiplication fact.
  const targeted: PracticeItem[] = [];
  const targetSeen = new Set<string>();
  const addTargeted = (item: PracticeItem) => {
    if (targetSeen.has(item.id)) return;
    targetSeen.add(item.id);
    targeted.push(item);
  };
  for (const state of stateMap.values()) {
    if (!isNeedyState(state, now)) continue;
    // stateMap is keyed by canonical card key; the concrete, parseable id
    // (e.g. "MUL_7x8") lives on lastItemId — see features/scheduler/cardModel.
    const id = state.lastItemId ?? state.cardKey;
    let m: RegExpMatchArray | null;
    if ((m = id.match(/^DIV_(\d+)d(\d+)$/))) {
      const dividend = +m[1], divisor = +m[2];
      if (divisor >= 2 && dividend >= lo && dividend <= hi) {
        addTargeted(makeFactorItem(divisor, dividend)); // divisor is a factor of dividend
      }
    } else if ((m = id.match(/^MUL_(\d+)x(\d+)$/))) {
      const a = +m[1], b = +m[2], product = a * b;
      if (a >= 2 && product >= lo && product <= hi) {
        addTargeted(makeFactorItem(a, product));
      }
    }
  }
  // Highest-need first, then trim the long tail.
  targeted.sort((a, b) => scoreCandidateItem(b, stateMap, now) - scoreCandidateItem(a, stateMap, now));

  const out: PracticeItem[] = [];
  const seen = new Set<string>();
  const add = (item: PracticeItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    out.push(enrichRelatedMetadata(item));
  };
  for (const item of targeted.slice(0, count * TARGET_CAP_FACTOR)) add(item);

  // Variety: prime/composite + factor mix from the standard generator.
  for (const item of generateNumberTheoryItems(grade, count, rangeMin, rangeMax)) add(item);
  return out;
}
