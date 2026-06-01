import type { PracticeItem } from '../../types/math';
import { ITEM_MAP, makeMultiplicationItem } from './multiplicationItems';
import { makeAdditionItem, makeSubtractionItem, makeDivisionItem } from './arithmeticItems';
import { makeFractionEquivalentItem, makeFractionCompareItem } from './fractionItems';
import { makeRoundingItem } from './roundingItems';
import { makePrimeItem, makeFactorItem } from './numberTheoryItems';
import { makeDecimalAddItem, makeDecimalSubItem } from './decimalItems';
import { makeWordProblem, type Schema } from './wordProblemItems';

/**
 * Reconstruct a PracticeItem from its deterministic itemId.
 * Returns null for IDs that cannot be parsed (should not happen for tracked items).
 */
export function makeItemFromId(itemId: string): PracticeItem | null {
  const staticItem = ITEM_MAP.get(itemId);
  if (staticItem) return staticItem;

  let m: RegExpMatchArray | null;

  m = itemId.match(/^MUL_(\d+)x(\d+)$/);
  if (m) return makeMultiplicationItem(+m[1], +m[2]);

  m = itemId.match(/^ADD_(\d+)p(\d+)$/);
  if (m) return makeAdditionItem(+m[1], +m[2]);

  m = itemId.match(/^SUB_(\d+)m(\d+)$/);
  if (m) return makeSubtractionItem(+m[1], +m[2]);

  m = itemId.match(/^DIV_(\d+)d(\d+)$/);
  if (m) return makeDivisionItem(+m[1], +m[2]);

  // FEQ_n_d_targetDen — mult = targetDen / d (always exact since targetDen = d * mult)
  m = itemId.match(/^FEQ_(\d+)_(\d+)_(\d+)$/);
  if (m) {
    const d = +m[2], targetDen = +m[3];
    const mult = d > 0 ? targetDen / d : 1;
    return makeFractionEquivalentItem(+m[1], d, mult);
  }

  m = itemId.match(/^FCMP_(\d+)_(\d+)_(\d+)_(\d+)$/);
  if (m) return makeFractionCompareItem(+m[1], +m[2], +m[3], +m[4]);

  m = itemId.match(/^ROUND_(\d+)_(\d+)$/);
  if (m) return makeRoundingItem(+m[1], +m[2]);

  m = itemId.match(/^PRIME_(\d+)$/);
  if (m) return makePrimeItem(+m[1]);

  m = itemId.match(/^FACT_(\d+)_(\d+)$/);
  if (m) return makeFactorItem(+m[1], +m[2]);

  // DADD / DSUB store values as hundredths with 'p' for decimal point (e.g. "2p5" = 2.5 = 250 hundredths)
  m = itemId.match(/^DADD_([\dp]+)_([\dp]+)$/);
  if (m) {
    const aH = Math.round(parseFloat(m[1].replace('p', '.')) * 100);
    const bH = Math.round(parseFloat(m[2].replace('p', '.')) * 100);
    return makeDecimalAddItem(aH, bH);
  }

  m = itemId.match(/^DSUB_([\dp]+)_([\dp]+)$/);
  if (m) {
    const aH = Math.round(parseFloat(m[1].replace('p', '.')) * 100);
    const bH = Math.round(parseFloat(m[2].replace('p', '.')) * 100);
    return makeDecimalSubItem(aH, bH);
  }

  m = itemId.match(/^WORD_([a-z]+)_(\d+)_(\d+)$/);
  if (m) return makeWordProblem(m[1] as Schema, +m[2], +m[3]);

  return null;
}
