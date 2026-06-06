import type { PracticeItem } from '../../types/math';
import { ITEM_MAP, makeMultiplicationItem } from './multiplicationItems';
import { makeAdditionItem, makeSubtractionItem, makeDivisionItem } from './arithmeticItems';
import { makeFractionEquivalentItem, makeFractionCompareItem, makeFractionNumberLineItem } from './fractionItems';
import { makeRoundingItem } from './roundingItems';
import { makePrimeItem, makeFactorItem } from './numberTheoryItems';
import { makeDecimalAddItem, makeDecimalSubItem } from './decimalItems';
import { makeWordProblem, type Schema } from './wordProblemItems';
import { makeAreaUnitSquaresItem, makeAreaRectangleItem, makePerimeterRectangleItem, makeRectilinearAreaItem } from './areaItems';
import { GEO_ITEM_MAP } from './geometryItems';
import { makePropCommutativityItem, makePropIdentityItem, makePropZeroItem } from './mulPropertiesItems';
import { makeTimeItem, makeElapsedTimeItem, makeBarGraphItem, makeLinePlotItem, makeMeasurementWordProblem, type MeasSchema } from './measurementItems';

/**
 * Reconstruct a PracticeItem from its deterministic itemId.
 * Returns null for IDs that cannot be parsed (should not happen for tracked items).
 */
export function makeItemFromId(itemId: string): PracticeItem | null {
  const staticItem = ITEM_MAP.get(itemId);
  if (staticItem) return staticItem;

  const geoItem = GEO_ITEM_MAP.get(itemId);
  if (geoItem) return geoItem;

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

  m = itemId.match(/^AREA_SQ_(\d+)x(\d+)$/);
  if (m) return makeAreaUnitSquaresItem(+m[1], +m[2]);

  m = itemId.match(/^AREA_RECT_(\d+)x(\d+)$/);
  if (m) return makeAreaRectangleItem(+m[1], +m[2]);

  m = itemId.match(/^PERIM_RECT_(\d+)x(\d+)$/);
  if (m) return makePerimeterRectangleItem(+m[1], +m[2]);

  // FNL_n_d — fraction number line
  m = itemId.match(/^FNL_(\d+)_(\d+)$/);
  if (m) return makeFractionNumberLineItem(+m[1], +m[2]);

  // RECTI_a1xb1_a2xb2 — rectilinear area (two rectangles)
  m = itemId.match(/^RECTI_(\d+)x(\d+)_(\d+)x(\d+)$/);
  if (m) return makeRectilinearAreaItem(+m[1], +m[2], +m[3], +m[4]);

  // PROP_CMT_AxB — commutative property
  m = itemId.match(/^PROP_CMT_(\d+)x(\d+)$/);
  if (m) return makePropCommutativityItem(+m[1], +m[2]);

  // PROP_IDT_A — identity property
  m = itemId.match(/^PROP_IDT_(\d+)$/);
  if (m) return makePropIdentityItem(+m[1]);

  // PROP_ZERO_A — zero property
  m = itemId.match(/^PROP_ZERO_(\d+)$/);
  if (m) return makePropZeroItem(+m[1]);

  // CLCK_h_m — time to minute (analog clock reading)
  m = itemId.match(/^CLCK_(\d+)_(\d+)$/);
  if (m) return makeTimeItem(+m[1], +m[2]);

  // ETIME_h1_m1_h2_m2 — elapsed time in minutes
  m = itemId.match(/^ETIME_(\d+)_(\d+)_(\d+)_(\d+)$/);
  if (m) return makeElapsedTimeItem(+m[1], +m[2], +m[3], +m[4]);

  // BARG_scale_bars — scaled bar graph reading
  m = itemId.match(/^BARG_(\d+)_(\d+)$/);
  if (m) return makeBarGraphItem(+m[1], +m[2]);

  // LPLOT_v1_v2_v3_v4 — line plot total
  m = itemId.match(/^LPLOT_(\d+)_(\d+)_(\d+)_(\d+)$/);
  if (m) return makeLinePlotItem(+m[1], +m[2], +m[3], +m[4]);

  // MWRD_schema_a_b — measurement word problem
  m = itemId.match(/^MWRD_([a-z]+)_(\d+)_(\d+)$/);
  if (m) return makeMeasurementWordProblem(m[1] as MeasSchema, +m[2], +m[3]);

  return null;
}
