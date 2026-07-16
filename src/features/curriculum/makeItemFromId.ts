import type { PracticeItem } from '../../types/math';
import { ITEM_MAP, makeMultiplicationItem } from './multiplicationItems';
import { makeAdditionItem, makeSubtractionItem, makeDivisionItem } from './arithmeticItems';
import { generateArithmeticErrorAnalysis, type ArithmeticMisconceptionCode } from './regrouping';
import { findFriendlyDivisionDecomposition, makeStructuredDivisionItem, type DivisionSchema } from './divisionItems';
import { makeFractionEquivalentItem, makeFractionMissingDenominatorItem, makeFractionCompareItem, makeFractionNumberLineItem, makeFractionStrategyChoiceItem, makeUnitFractionModelItem } from './fractionItems';
import { makeRoundingItem } from './roundingItems';
import { makePrimeItem, makeFactorItem } from './numberTheoryItems';
import { makeDecimalAddItem, makeDecimalSubItem } from './decimalItems';
import { makeWordProblem, type Schema } from './wordProblemItems';
import {
  makeAreaUnitSquaresItem, makeAreaRectangleItem, makePerimeterRectangleItem, makeRectilinearAreaItem,
  makePerimeterPolygonItem, makePerimeterUnknownSideItem, makeAreaPerimCompareItem, type AreaPerimVariant,
  makePerimeterEquationChoiceItem, makePerimeterSumKnownSidesItem, makePerimeterMixedReasoningItem,
  makeAreaPerimeterOperationChoiceItem, makeAreaPerimeterExpressionChoiceItem,
} from './areaItems';
import { GEO_ITEM_MAP } from './geometryItems';
import { makePropCommutativityItem, makePropIdentityItem, makePropZeroItem, makePropAssociativeItem, makePropDistributiveItem } from './mulPropertiesItems';
import { makeTimeItem, makeElapsedTimeItem, makeBarGraphItem, makeLinePlotItem, makeMeasurementWordProblem, type MeasSchema } from './measurementItems';
import type { MeasurementSchema } from './measurementTypes';
import { makeTwoStepWordProblem, type TwoStepSchema } from './twoStepItems';
import { makeArithmeticPatternItem } from './patternItems';

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

  m = itemId.match(/^MEAS_(bar_(?:read_value|compare|total|missing))_(\d+)_(\d+(?:-\d+)*)$/);
  if (m) {
    const schema = m[1] as MeasurementSchema, scale = +m[2], values = m[3].split('-').map(Number);
    const item = makeBarGraphItem(scale, values[0] / scale);
    const spec = item.measurementSpec as Extract<NonNullable<PracticeItem['measurementSpec']>, { kind: 'bar_graph' }>;
    spec.values = values; item.id = itemId; item.cardKey = `template:g3-measurement:${schema}`;
    if (schema === 'bar_compare') { spec.question = 'compare'; spec.comparedIndices = [0, 1]; item.prompt = 'Use the bar graph. How many more books did Mia read than Leo?'; item.answer = values[0] - values[1]; }
    if (schema === 'bar_total') { spec.question = 'total'; spec.comparedIndices = [0, 1]; item.prompt = 'Use the bar graph. How many books did Mia and Leo read in all?'; item.answer = values[0] + values[1]; }
    if (schema === 'bar_missing') { spec.question = 'missing'; spec.requestedIndex = 2; item.prompt = 'The Ava bar is missing. What value should it show?'; item.answer = values[2]; }
    return item;
  }

  m = itemId.match(/^MEAS_(line_plot_(?:count|range|fractional))_(1|2|4)_(\d+(?:-\d+)*)$/);
  if (m) {
    const schema = m[1] as MeasurementSchema, denominator = +m[2] as 1 | 2 | 4, ticks = m[3].split('-').map(Number);
    const item = makeLinePlotItem(ticks[0], ticks[1], ticks[2], ticks[3]);
    item.id = itemId; item.cardKey = `template:g3-measurement:${schema}`;
    item.measurementSpec = { kind: 'line_plot', unit: 'inch', denominator, valuesInTicks: ticks, question: schema === 'line_plot_range' ? 'range' : 'count_at_value', targetTick: ticks[0] };
    item.prompt = schema === 'line_plot_range' ? 'Use the line plot. What is the difference between the longest and shortest measurements?' : `Use the line plot. How many measurements are at ${ticks[0]}/${denominator} inches?`;
    item.answer = schema === 'line_plot_range' ? (Math.max(...ticks) - Math.min(...ticks)) / denominator : ticks.filter(tick => tick === ticks[0]).length;
    return item;
  }

  m = itemId.match(/^DIVQ_([a-z_]+)_(\d+)_(\d+)$/);
  if (m) {
    const encoded = m[1];
    const groupingWordProblem = encoded === 'word_problem_choose_model_grouping';
    const schema = (groupingWordProblem ? 'word_problem_choose_model' : encoded) as DivisionSchema;
    const dividend = +m[2], divisor = +m[3], quotient = dividend / divisor;
    const decomposition = schema.startsWith('decompose_') ? findFriendlyDivisionDecomposition(dividend, divisor) : null;
    return makeStructuredDivisionItem({
      schema, dividend, divisor, quotient,
      ...(decomposition ? { decomposition: decomposition.parts.map((part, i) => ({ dividendPart: part, quotientPart: decomposition.partialQuotients[i] })) } : {}),
      ...(['equal_sharing', 'measurement_grouping', 'word_problem_choose_model'].includes(schema) ? {
        context: { interpretation: schema === 'measurement_grouping' || groupingWordProblem ? 'grouping' as const : 'sharing' as const, noun: 'counters', groupNoun: schema === 'measurement_grouping' || groupingWordProblem ? 'bag' : 'child' },
        unknownPosition: schema === 'measurement_grouping' || groupingWordProblem ? 'group_count' as const : 'group_size' as const,
      } : {}),
    });
  }

  m = itemId.match(/^ARERR_(addition|subtraction)_(\d+)_(\d+)_(.+)$/);
  if (m) {
    const base = m[1] === 'addition' ? makeAdditionItem(+m[2], +m[3]) : makeSubtractionItem(+m[2], +m[3]);
    if (!base.arithmeticSpec) return null;
    return generateArithmeticErrorAnalysis(base.arithmeticSpec, m[4] as ArithmeticMisconceptionCode);
  }

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

  m = itemId.match(/^FEQD_(\d+)_(\d+)_(\d+)$/);
  if (m && +m[1] > 0 && +m[3] % +m[1] === 0) {
    return makeFractionMissingDenominatorItem(+m[1], +m[2], +m[3] / +m[1]);
  }

  m = itemId.match(/^FCMP_(\d+)_(\d+)_(\d+)_(\d+)$/);
  if (m) return makeFractionCompareItem(+m[1], +m[2], +m[3], +m[4]);

  m = itemId.match(/^FCWHY_(same_denominator|same_numerator|benchmark_half)_(\d+)_(\d+)_(\d+)_(\d+)$/);
  if (m) return makeFractionStrategyChoiceItem(
    { numerator: +m[2], denominator: +m[3] },
    { numerator: +m[4], denominator: +m[5] },
    m[1] as 'same_denominator' | 'same_numerator' | 'benchmark_half',
    () => 0.5,
  );

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

  m = itemId.match(/^FUNIT_1_(\d+)$/);
  if (m) return makeUnitFractionModelItem(+m[1], () => 0.5);

  // RECTI_a1xb1_a2xb2 — rectilinear area (two rectangles)
  m = itemId.match(/^RECTI_(\d+)x(\d+)_(\d+)x(\d+)$/);
  if (m) return makeRectilinearAreaItem(+m[1], +m[2], +m[3], +m[4]);

  // PERIM_POLY_s1-s2-... — perimeter of a general polygon
  m = itemId.match(/^PERIM_POLY_(\d+(?:-\d+)*)$/);
  if (m) return makePerimeterPolygonItem(m[1].split('-').map(Number));

  // PERIM_UNKSIDE_EQ|SUM|MIX_total_s1-s2-... — missing-side reasoning progression
  m = itemId.match(/^PERIM_UNKSIDE_(EQ|SUM|MIX)_(\d+)_(\d+(?:-\d+)*)$/);
  if (m) {
    const total = +m[2];
    const knownSides = m[3].split('-').map(Number);
    if (m[1] === 'EQ') return makePerimeterEquationChoiceItem(total, knownSides);
    if (m[1] === 'SUM') return makePerimeterSumKnownSidesItem(total, knownSides);
    return makePerimeterMixedReasoningItem(total, knownSides);
  }

  // PERIM_UNKSIDE_total_s1-s2-... — perimeter with unknown side (legacy "find the number" mode)
  m = itemId.match(/^PERIM_UNKSIDE_(\d+)_(\d+(?:-\d+)*)$/);
  if (m) return makePerimeterUnknownSideItem(+m[1], m[2].split('-').map(Number));

  // AREA_PERIM_CMP_sadp|spad_N — area/perimeter comparison
  m = itemId.match(/^AREA_PERIM_CMP_(sadp|spad)_(\d+)$/);
  if (m) return makeAreaPerimCompareItem(m[1] as AreaPerimVariant, +m[2]);

  // AP_CHOICE_operation|expression_LxW — area-vs-perimeter operation/expression choice
  m = itemId.match(/^AP_CHOICE_(operation|expression)_(\d+)x(\d+)$/);
  if (m) {
    return m[1] === 'operation'
      ? makeAreaPerimeterOperationChoiceItem(+m[2], +m[3])
      : makeAreaPerimeterExpressionChoiceItem(+m[2], +m[3]);
  }

  // PROP_CMT_AxB — commutative property
  m = itemId.match(/^PROP_CMT_(\d+)x(\d+)$/);
  if (m) return makePropCommutativityItem(+m[1], +m[2]);

  // PROP_IDT_A — identity property
  m = itemId.match(/^PROP_IDT_(\d+)$/);
  if (m) return makePropIdentityItem(+m[1]);

  // PROP_ZERO_A — zero property
  m = itemId.match(/^PROP_ZERO_(\d+)$/);
  if (m) return makePropZeroItem(+m[1]);

  // PROP_ASC_AxBxC — associative property
  m = itemId.match(/^PROP_ASC_(\d+)x(\d+)x(\d+)$/);
  if (m) return makePropAssociativeItem(+m[1], +m[2], +m[3]);

  // PROP_DIST_AxBpC — distributive property
  m = itemId.match(/^PROP_DIST_(\d+)x(\d+)p(\d+)$/);
  if (m) return makePropDistributiveItem(+m[1], +m[2], +m[3]);

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

  // WRD2_schema_a_b_c — two-step word problem
  m = itemId.match(/^WRD2_([a-z]+)_(\d+)_(\d+)_(\d+)$/);
  if (m) return makeTwoStepWordProblem(m[1] as TwoStepSchema, +m[2], +m[3], +m[4]);

  // APAT_start_step_terms — arithmetic sequence pattern
  m = itemId.match(/^APAT_(\d+)_(\d+)_(\d+)$/);
  if (m) return makeArithmeticPatternItem(+m[1], +m[2], +m[3]);

  return null;
}
