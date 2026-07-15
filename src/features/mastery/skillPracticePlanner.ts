import type { SessionConfig } from '../../types/math';
import {
  mulId, divId,
} from '../curriculum/multiplicationItems';
import { fracEqId, fracCmpId, fractionStrategyChoiceItemIds, unitFractionModelItemIds } from '../curriculum/fractionItems';
import { wordId } from '../curriculum/wordProblemItems';
import {
  areaSquaresItemIds, areaRectangleItemIds, perimeterRectangleItemIds, rectilinearAreaItemIds,
  perimeterPolygonItemIds, perimeterUnknownSideItemIds, areaPerimCompareItemIds,
  perimeterReasoningItemIds, areaPerimeterChoiceItemIds,
} from '../curriculum/areaItems';
import { geoItemIds } from '../curriculum/geometryItems';
import { mulPropertyItemIds } from '../curriculum/mulPropertiesItems';
import { fracNlId } from '../curriculum/fractionItems';
import { addId, subId } from '../curriculum/arithmeticItems';
import { roundId } from '../curriculum/roundingItems';
import {
  clckId, etimeId, bargId, lplotId, mwrdId,
} from '../curriculum/measurementItems';
import { wrd2Id, type TwoStepSchema } from '../curriculum/twoStepItems';
import { apatId } from '../curriculum/patternItems';

export interface PlanOptions {
  sessionLength?: number;
  rounds?: number;
}

export interface FocusSequence {
  skillId: string;
  itemIds: string[];
  representations: string[];
}

export function planFractionFocusSequence(skillId: string, misconceptions: string[] = []): FocusSequence {
  const codes = new Set(misconceptions);
  const sameDenominator = fractionComparisonIds('same_denominator');
  const sameNumerator = fractionComparisonIds('same_numerator');
  const mixed = fractionComparisonIds('mixed');
  if (skillId === 'g3-frac-equivalent') {
    return { skillId, itemIds: fracEquivItemIds(), representations: ['aligned_bars', 'symbolic_multiplier'] };
  }
  if (skillId === 'g3-frac-compare-same-denominator') {
    return { skillId, itemIds: sameDenominator, representations: ['equal_wholes', 'same_denominator'] };
  }
  if (skillId === 'g3-frac-compare-same-numerator') {
    return { skillId, itemIds: sameNumerator, representations: ['equal_wholes', 'piece_size'] };
  }
  const bridgeFirst = codes.has('fraction:compare_larger_denominator_means_larger')
    || codes.has('frac_compare:larger_denominator');
  return {
    skillId,
    itemIds: bridgeFirst ? [...sameNumerator, ...sameDenominator, ...mixed] : [...sameDenominator, ...sameNumerator, ...mixed],
    representations: ['same_denominator', 'same_numerator', 'benchmark_half', 'mixed'],
  };
}

/** Ordered conceptual sequence consumed by focused practice and the adaptive lesson planner (#29). */
export function buildFocusSequence(skillId: string): FocusSequence {
  if (skillId.startsWith('g3-frac-')) return planFractionFocusSequence(skillId);
  if (skillId === 'g3-area-concept') {
    return { skillId, itemIds: areaSquaresItemIds(), representations: ['unit_squares'] };
  }
  if (skillId === 'g3-area-formula') {
    return { skillId, itemIds: [...areaSquaresItemIds(), ...areaRectangleItemIds()], representations: ['unit_squares', 'rows_columns'] };
  }
  if (skillId === 'g3-perimeter') {
    return { skillId, itemIds: [...perimeterPolygonItemIds(), ...perimeterRectangleItemIds()], representations: ['boundary_path', 'rectangle_structure'] };
  }
  if (skillId === 'g3-area-perimeter-choice') {
    return { skillId, itemIds: areaPerimeterChoiceItemIds(), representations: ['context', 'expression', 'inside_boundary'] };
  }
  if (skillId === 'g3-perimeter-missing-side') {
    return { skillId, itemIds: [...perimeterReasoningItemIds(), ...perimeterUnknownSideItemIds()], representations: ['equation', 'known_side_sum', 'independent'] };
  }
  if (skillId === 'g3-geo-rectilinear-area') {
    return { skillId, itemIds: rectilinearAreaItemIds(), representations: ['decomposition'] };
  }
  if (skillId === 'g3-area-perimeter-compare') {
    return { skillId, itemIds: areaPerimCompareItemIds(), representations: ['same_area', 'same_perimeter'] };
  }
  return { skillId, itemIds: [], representations: [] };
}

// ── Skill ID constants matching the roadmap spec ─────────────────────────────
// These are the skill IDs used in the Phase 9 spec (G3_OA_…, G3_NF_…).
// Note: grade3MasteryMap.ts uses a different id scheme (g3-mul-…).
// We support both formats here.

// Multiplication table sets.
// BASIC covers tables 0–5 matching the mastery map title "Times Tables 1–5".
// inferGrade3SkillId maps bigTable <= 5 → g3-mul-tables-basic, consistent with this set.
const BASIC_TABLES = [0, 1, 2, 3, 4, 5];    // g3-mul-tables-basic ("Times Tables 1–5")
const INTERMEDIATE_TABLES = [3, 4];          // G3_OA_MUL_FACTS_3_4 (legacy spec ID)
const ADVANCED_TABLES = [6, 7, 8, 9, 10];   // G3_OA_MUL_FACTS_6_9 (includes 10)

// Division divisor sets — must stay >= TABLE_MIN (2) so every generated item ID
// exists in the global ITEM_MAP or is parseable by makeItemFromId.
const DIV_WITHIN_DIVISORS = [2, 3, 4, 5];      // g3-div-within-100
const DIV_ADVANCED_DIVISORS = [6, 7, 8, 9, 10]; // g3-div-mul-relationship

function mulItemIds(tables: number[], factors: number[]): string[] {
  const ids: string[] = [];
  for (const a of tables) {
    for (const b of factors) {
      ids.push(mulId(a, b));
    }
  }
  return ids;
}

function grade3BasicMulItemIds(): string[] {
  const factors = [1, 2, 3, 4, 5];
  return mulItemIds(factors, factors);
}

function grade3AdvancedMulItemIds(): string[] {
  const ids: string[] = [];
  for (let a = 1; a <= 10; a++) {
    for (let b = 1; b <= 10; b++) {
      if (Math.max(a, b) <= 5) continue;
      if (a * b > 100) continue;
      ids.push(mulId(a, b));
    }
  }
  return ids;
}

function divItemIds(divisors: number[]): string[] {
  const ids: string[] = [];
  for (const divisor of divisors) {
    // Divisor 0 → undefined (0÷0 = NaN). Divisor 1 → trivial (any ÷ 1 = itself).
    // TABLE_MIN = 2, so divisors below 2 produce items not in the global catalogue.
    if (divisor < 2) continue;
    for (let quotient = 1; quotient <= 10; quotient++) {
      const dividend = divisor * quotient;
      if (dividend <= 100) ids.push(divId(dividend, divisor));
    }
  }
  return ids;
}

function fracEquivItemIds(): string[] {
  // Only non-unit fractions (n > 1) so every item credits to g3-frac-equivalent,
  // not g3-frac-unit. Unit fractions (n=1) are covered by fracUnitItemIds().
  const fracs = [[2, 3], [3, 4], [2, 5], [3, 5], [2, 6]];
  const ids: string[] = [];
  for (const [n, d] of fracs) {
    for (let mult = 2; mult <= 4; mult++) {
      ids.push(fracEqId(n, d, d * mult));
    }
  }
  return ids;
}

function fracCmpItemIds(): string[] {
  // Compare fractions: same denominator and same numerator families
  const pairs: [number, number, number, number][] = [
    [1, 4, 3, 4], [1, 3, 2, 3], [1, 2, 3, 4],
    [2, 4, 1, 2], [1, 4, 1, 2], [1, 3, 1, 4],
    [3, 8, 3, 4], [2, 6, 1, 3], [5, 8, 5, 6],
  ];
  return pairs.map(([n1, d1, n2, d2]) => fracCmpId(n1, d1, n2, d2));
}

function fractionComparisonIds(kind: 'same_denominator' | 'same_numerator' | 'mixed'): string[] {
  return fracCmpItemIds().filter(id => {
    const match = id.match(/^FCMP_(\d+)_(\d+)_(\d+)_(\d+)$/)!;
    const sameDenominator = match[2] === match[4];
    const sameNumerator = match[1] === match[3];
    return kind === 'same_denominator' ? sameDenominator
      : kind === 'same_numerator' ? sameNumerator && !sameDenominator
        : !sameDenominator && !sameNumerator;
  });
}

function equalGroupsWordItemIds(): string[] {
  // Equal-groups word problems: schema 'eg', a = groups, b = items per group
  const ids: string[] = [];
  for (let a = 2; a <= 6; a++) {
    for (let b = 2; b <= 10; b++) {
      ids.push(wordId('eg', a, b));
    }
  }
  return ids;
}

function divisionWordItemIds(): string[] {
  // Division word problems: schema 'dv', "p items shared into a groups → b each"
  const ids: string[] = [];
  for (let a = 2; a <= 6; a++) {
    for (let b = 2; b <= 10; b++) {
      ids.push(wordId('dv', a, b));
    }
  }
  return ids;
}

function fracNumberLineItemIds(): string[] {
  // Grade 3 fractions with denominators 2–8, numerator 1..d-1
  const items: string[] = [];
  for (const d of [2, 3, 4, 6, 8]) {
    for (let n = 1; n < d; n++) {
      items.push(fracNlId(n, d));
    }
  }
  return items;
}

function fracUnitItemIds(): string[] {
  // Equivalent-fraction items for unit fractions (n=1): 1/2, 1/3, 1/4, 1/6, 1/8
  const unitDenoms = [2, 3, 4, 6, 8];
  const ids: string[] = [];
  for (const d of unitDenoms) {
    for (let mult = 2; mult <= 3; mult++) {
      ids.push(fracEqId(1, d, d * mult));
    }
  }
  return ids;
}

// ── Addition/Subtraction regrouping item generators ──────────────────────────
// Each function returns a deterministic set of item IDs where every item
// requires carrying (addition) or borrowing (subtraction).

function add2DigitRegroupingItemIds(): string[] {
  // Both addends in [10,99]; ones digits sum >= 10 (requires carrying)
  const pairs: [number, number][] = [
    [47, 28], [56, 37], [68, 25], [35, 48], [79, 14],
    [43, 29], [57, 36], [64, 28], [38, 47], [75, 18],
    [26, 47], [53, 39], [82, 19], [45, 56], [67, 24],
    [33, 48], [74, 19], [28, 56], [49, 37], [86, 15],
    [18, 73], [27, 64], [39, 55], [46, 66], [58, 34],
  ];
  return pairs.map(([a, b]) => addId(a, b));
}

function add3DigitRegroupingItemIds(): string[] {
  // Both addends in [100,999]; at least one column requires carrying
  const pairs: [number, number][] = [
    [247, 386], [568, 275], [409, 296], [735, 189], [462, 358],
    [374, 249], [583, 267], [691, 149], [425, 386], [758, 164],
    [347, 285], [463, 279], [572, 348], [681, 259], [394, 437],
    [246, 387], [574, 358], [682, 249], [453, 367], [791, 138],
    [305, 297], [416, 385], [523, 278], [634, 189], [742, 259],
  ];
  return pairs.map(([a, b]) => addId(a, b));
}

function sub2DigitBorrowingItemIds(): string[] {
  // Minuend in [10,99], subtrahend in [10,99]; ones of minuend < ones of subtrahend (requires borrowing)
  // subId(hi, lo) with hi > lo, hi%10 < lo%10
  const pairs: [number, number][] = [
    [52, 28], [71, 46], [90, 37], [63, 47], [84, 29],
    [41, 18], [73, 56], [62, 38], [80, 43], [51, 27],
    [34, 19], [46, 28], [75, 38], [93, 47], [61, 35],
    [40, 23], [72, 49], [83, 57], [92, 65], [50, 34],
    [44, 27], [66, 49], [85, 38], [97, 68], [73, 46],
  ];
  return pairs.map(([hi, lo]) => subId(hi, lo));
}

function sub3DigitBorrowingItemIds(): string[] {
  // Minuend in [100,999], subtrahend in [100,999]; at least one column requires borrowing
  // Includes zero-digit cases (e.g. 703-458, 900-376)
  const pairs: [number, number][] = [
    [524, 286], [703, 458], [900, 376], [835, 467], [612, 345],
    [741, 286], [830, 457], [963, 478], [524, 267], [705, 348],
    [412, 285], [631, 274], [820, 356], [753, 289], [941, 456],
    [302, 175], [500, 237], [403, 168], [700, 423], [800, 547],
    [614, 258], [735, 469], [821, 347], [943, 256], [532, 174],
  ];
  return pairs.map(([hi, lo]) => subId(hi, lo));
}

// ── Two-step word problems ────────────────────────────────────────────────────

function twoStepItemIds(): string[] {
  // schema, a, b, c — all answers are positive integers
  const items: [TwoStepSchema, number, number, number][] = [
    // muls: (a × b) − c
    ['muls', 4, 5, 8],  // 12
    ['muls', 3, 6, 7],  // 11
    ['muls', 5, 4, 9],  // 11
    ['muls', 6, 3, 5],  // 13
    ['muls', 2, 8, 6],  // 10
    ['muls', 3, 7, 8],  // 13
    // mula: (a × b) + c
    ['mula', 3, 4, 8],  // 20
    ['mula', 2, 5, 7],  // 17
    ['mula', 4, 3, 9],  // 21
    ['mula', 5, 4, 6],  // 26
    ['mula', 3, 6, 4],  // 22
    ['mula', 2, 7, 8],  // 22
    // diva: (a ÷ b) + c  [a divisible by b]
    ['diva', 12, 3, 5], // 9
    ['diva', 20, 4, 6], // 11
    ['diva', 15, 5, 4], // 7
    ['diva', 18, 6, 3], // 6
    ['diva', 28, 7, 4], // 8
    ['diva', 16, 4, 7], // 11
    // divs: (a ÷ b) − c  [a divisible by b, a/b > c]
    ['divs', 24, 4, 3], // 3
    ['divs', 60, 6, 4], // 6
    ['divs', 56, 8, 3], // 4
    ['divs', 72, 8, 5], // 4
    ['divs', 70, 7, 6], // 4
    ['divs', 45, 9, 2], // 3
  ];
  return items.map(([s, a, b, c]) => wrd2Id(s, a, b, c));
}

// ── Arithmetic patterns ───────────────────────────────────────────────────────

function arithmeticPatternItemIds(): string[] {
  // [start, step, terms]
  const items: [number, number, number][] = [
    // Count-by sequences (table × n)
    [2, 2, 4],   [3, 3, 4],   [4, 4, 4],   [5, 5, 4],
    [6, 6, 4],   [7, 7, 4],   [8, 8, 4],   [9, 9, 4],
    [10, 10, 4],
    // Starting from 0 (extra terms for readability)
    [0, 3, 5],   [0, 4, 5],   [0, 6, 4],
    // Non-zero starts
    [1, 3, 4],   [2, 4, 4],   [5, 3, 4],
    [10, 5, 4],  [4, 6, 4],   [20, 10, 4],
    [15, 5, 4],  [6, 4, 4],
  ];
  return items.map(([start, step, terms]) => apatId(start, step, terms));
}

// ── Rounding to nearest 10 or 100 ────────────────────────────────────────────

function roundNearest10or100ItemIds(): string[] {
  return [
    // 2-digit, round to 10
    roundId(43, 10), roundId(68, 10), roundId(25, 10), roundId(37, 10), roundId(84, 10),
    roundId(51, 10), roundId(76, 10), roundId(19, 10), roundId(92, 10), roundId(63, 10),
    // 3-digit, round to 100
    roundId(247, 100), roundId(583, 100), roundId(164, 100), roundId(342, 100), roundId(856, 100),
    roundId(431, 100), roundId(675, 100), roundId(124, 100), roundId(968, 100), roundId(450, 100),
    // 3-digit, round to 10
    roundId(243, 10), roundId(687, 10), roundId(351, 10), roundId(824, 10), roundId(462, 10),
  ];
}

// ── Multiply by multiples of 10 ───────────────────────────────────────────────

function mulMultipleOf10ItemIds(): string[] {
  return [
    mulId(3, 20), mulId(4, 20), mulId(5, 20),
    mulId(3, 30), mulId(4, 30), mulId(6, 30),
    mulId(3, 40), mulId(4, 40), mulId(7, 40),
    mulId(3, 50), mulId(5, 50), mulId(6, 50),
    mulId(2, 60), mulId(3, 60), mulId(4, 60),
    mulId(2, 70), mulId(3, 70), mulId(5, 70),
    mulId(2, 80), mulId(3, 80), mulId(4, 80),
    mulId(2, 90), mulId(3, 90), mulId(4, 90),
  ];
}

// ── Time to minute ────────────────────────────────────────────────────────────

function timeToMinuteItemIds(): string[] {
  return [
    clckId(1, 0),  clckId(2, 15), clckId(3, 25), clckId(4, 30),
    clckId(5, 35), clckId(6, 40), clckId(7, 45), clckId(8, 50),
    clckId(9, 55), clckId(10, 5), clckId(11, 10), clckId(12, 20),
    clckId(1, 30), clckId(2, 45), clckId(3, 15), clckId(4, 25),
    clckId(5, 40), clckId(6, 55), clckId(7, 0),  clckId(8, 35),
    clckId(9, 20), clckId(10, 50), clckId(11, 45), clckId(12, 10),
  ];
}

// ── Elapsed time ──────────────────────────────────────────────────────────────

function elapsedTimeItemIds(): string[] {
  return [
    etimeId(9, 15, 9, 45),   // 30 min
    etimeId(10, 0, 10, 30),  // 30 min
    etimeId(2, 30, 3, 15),   // 45 min
    etimeId(1, 0, 1, 45),    // 45 min
    etimeId(3, 15, 4, 0),    // 45 min
    etimeId(11, 30, 12, 0),  // 30 min
    etimeId(8, 45, 9, 30),   // 45 min
    etimeId(4, 0, 4, 20),    // 20 min
    etimeId(2, 10, 2, 40),   // 30 min
    etimeId(7, 30, 8, 15),   // 45 min
    etimeId(9, 0, 9, 25),    // 25 min
    etimeId(10, 15, 11, 0),  // 45 min
    etimeId(1, 30, 2, 15),   // 45 min
    etimeId(3, 0, 3, 40),    // 40 min
    etimeId(6, 15, 7, 0),    // 45 min
    etimeId(11, 0, 11, 35),  // 35 min
    etimeId(8, 30, 9, 0),    // 30 min
    etimeId(4, 45, 5, 30),   // 45 min
    etimeId(2, 0, 2, 55),    // 55 min
    etimeId(7, 20, 8, 5),    // 45 min
  ];
}

// ── Measurement word problems ─────────────────────────────────────────────────

function measurementWordItemIds(): string[] {
  return [
    mwrdId('addg', 250, 150), mwrdId('addg', 350, 200), mwrdId('addg', 125, 175),
    mwrdId('subg', 500, 150), mwrdId('subg', 600, 250), mwrdId('subg', 450, 200),
    mwrdId('addl', 3, 5),     mwrdId('addl', 4, 7),     mwrdId('addl', 2, 8),
    mwrdId('subl', 10, 4),    mwrdId('subl', 8, 3),     mwrdId('subl', 12, 5),
    mwrdId('addkg', 8, 7),    mwrdId('addkg', 12, 8),
    mwrdId('subkg', 25, 8),   mwrdId('subkg', 30, 12),
    mwrdId('addml', 300, 450), mwrdId('addml', 250, 350),
    mwrdId('subml', 750, 250), mwrdId('subml', 800, 300),
  ];
}

// ── Scaled bar graphs ─────────────────────────────────────────────────────────

function scaledBarGraphItemIds(): string[] {
  return [
    bargId(5, 3),  bargId(5, 4),  bargId(5, 6),  bargId(5, 7),  bargId(5, 8),
    bargId(10, 2), bargId(10, 3), bargId(10, 4), bargId(10, 5), bargId(10, 7),
    bargId(2, 5),  bargId(2, 7),  bargId(2, 9),
    bargId(4, 3),  bargId(4, 5),  bargId(4, 7),
    bargId(3, 4),  bargId(3, 6),  bargId(3, 8),
    bargId(10, 8),
  ];
}

// ── Line plots ────────────────────────────────────────────────────────────────

function linePlotItemIds(): string[] {
  return [
    lplotId(1, 2, 2, 3), lplotId(2, 2, 3, 4), lplotId(1, 1, 3, 4),
    lplotId(2, 3, 3, 4), lplotId(1, 2, 4, 4), lplotId(2, 3, 4, 5),
    lplotId(1, 3, 3, 5), lplotId(2, 2, 4, 5), lplotId(3, 3, 3, 4),
    lplotId(1, 2, 3, 6), lplotId(2, 4, 4, 5), lplotId(1, 3, 4, 6),
    lplotId(3, 3, 4, 5), lplotId(2, 3, 5, 5), lplotId(1, 4, 4, 7),
    lplotId(3, 4, 4, 6), lplotId(2, 3, 6, 7), lplotId(4, 4, 5, 5),
    lplotId(3, 4, 5, 8), lplotId(2, 5, 6, 7),
  ];
}

/**
 * Convert a Grade 3 skill ID to a SessionConfig.
 *
 * Supports the roadmap-spec skill IDs (G3_OA_… / G3_NF_…) as well as the
 * grade3MasteryMap.ts IDs (g3-mul-… / g3-frac-… etc.).
 */
export function planPracticeForSkill(
  skillId: string,
  options: PlanOptions = {},
): SessionConfig {
  const sessionLength = options.sessionLength ?? 10;

  // ── G3_OA_MUL_FACTS_0_2_5_10 (also: g3-mul-tables-basic, tables 0/1/2/5/10) ─
  if (
    skillId === 'G3_OA_MUL_FACTS_0_2_5_10' ||
    skillId === 'g3-mul-tables-basic'
  ) {
    return {
      mode: 'multiplication',
      specificItemIds: skillId === 'g3-mul-tables-basic'
        ? grade3BasicMulItemIds()
        : mulItemIds(BASIC_TABLES, [1, 2, 3, 4, 5, 10]),
      sessionLength,
    };
  }

  if (skillId === 'g3-frac-compare-same-denominator') {
    return { mode: 'fraction', specificItemIds: [...fractionComparisonIds('same_denominator'), ...fractionStrategyChoiceItemIds().filter(id => id.includes('same_denominator'))], fractionMode: 'compare', sessionLength };
  }

  if (skillId === 'g3-frac-compare-same-numerator') {
    return { mode: 'fraction', specificItemIds: [...fractionComparisonIds('same_numerator'), ...fractionStrategyChoiceItemIds().filter(id => id.includes('same_numerator'))], fractionMode: 'compare', sessionLength };
  }

  // ── G3_OA_MUL_FACTS_3_4 ──────────────────────────────────────────────────────
  if (skillId === 'G3_OA_MUL_FACTS_3_4') {
    return {
      mode: 'multiplication',
      specificItemIds: mulItemIds(INTERMEDIATE_TABLES, [1, 2, 3, 4, 5, 10]),
      sessionLength,
    };
  }

  // ── G3_OA_MUL_FACTS_6_9 (also: g3-mul-tables-advanced) ───────────────────────
  if (
    skillId === 'G3_OA_MUL_FACTS_6_9' ||
    skillId === 'g3-mul-tables-advanced'
  ) {
    return {
      mode: 'multiplication',
      specificItemIds: skillId === 'g3-mul-tables-advanced'
        ? grade3AdvancedMulItemIds()
        : mulItemIds(ADVANCED_TABLES, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
      sessionLength,
    };
  }

  // ── G3_OA_DIV_UNKNOWN_FACTOR / g3-div-within-100 — divisors 2–5 ─────────────
  // inferGrade3SkillId maps divisors 1–5 → g3-div-within-100.
  if (skillId === 'G3_OA_DIV_UNKNOWN_FACTOR' || skillId === 'g3-div-within-100') {
    return {
      mode: 'division',
      specificItemIds: divItemIds(DIV_WITHIN_DIVISORS),
      sessionLength,
    };
  }

  // ── g3-div-mul-relationship — divisors 6–10 ───────────────────────────────
  // inferGrade3SkillId maps divisors 6–10 → g3-div-mul-relationship.
  if (skillId === 'g3-div-mul-relationship') {
    return {
      mode: 'division',
      specificItemIds: divItemIds(DIV_ADVANCED_DIVISORS),
      sessionLength,
    };
  }

  // ── G3_NF_EQUIVALENT_FRACTIONS (also: g3-frac-equivalent) ────────────────────
  if (
    skillId === 'G3_NF_EQUIVALENT_FRACTIONS' ||
    skillId === 'g3-frac-equivalent'
  ) {
    return {
      mode: 'fraction',
      specificItemIds: fracEquivItemIds(),
      fractionMode: 'equivalent',
      sessionLength,
    };
  }

  // ── G3_NF_COMPARE_FRACTIONS (also: g3-frac-compare) ─────────────────────────
  if (
    skillId === 'G3_NF_COMPARE_FRACTIONS' ||
    skillId === 'g3-frac-compare'
  ) {
    return {
      mode: 'fraction',
      specificItemIds: skillId === 'g3-frac-compare'
        ? [...fractionComparisonIds('mixed'), ...fractionStrategyChoiceItemIds().filter(id => id.includes('benchmark_half'))]
        : fracCmpItemIds(),
      fractionMode: 'compare',
      sessionLength,
    };
  }

  // ── G3_OA_WORD_EQUAL_GROUPS / g3-mul-meaning — equal-groups multiplication ──
  if (
    skillId === 'G3_OA_WORD_EQUAL_GROUPS' ||
    skillId === 'g3-mul-meaning'
  ) {
    return {
      mode: 'word_problem',
      specificItemIds: equalGroupsWordItemIds(),
      grade: 3,
      sessionLength,
    };
  }

  // ── g3-div-meaning — division word problems ───────────────────────────────
  if (skillId === 'g3-div-meaning') {
    return {
      mode: 'word_problem',
      specificItemIds: divisionWordItemIds(),
      grade: 3,
      sessionLength,
    };
  }

  // ── g3-frac-unit — unit fraction equivalents (1/2, 1/3, 1/4 …) ──────────
  if (skillId === 'g3-frac-unit') {
    return {
      mode: 'fraction',
      specificItemIds: [...unitFractionModelItemIds(), ...fracUnitItemIds()],
      fractionMode: 'equivalent',
      sessionLength,
    };
  }

  // ── g3-frac-number-line — fraction number line items ─────────────────────
  if (skillId === 'g3-frac-number-line') {
    return {
      mode: 'fraction',
      specificItemIds: fracNumberLineItemIds(),
      sessionLength,
    };
  }

  // ── G3_MD_AREA_ARRAYS / g3-area-concept — count unit squares ─────────────────
  if (skillId === 'G3_MD_AREA_ARRAYS' || skillId === 'g3-area-concept') {
    return {
      mode: 'area',
      specificItemIds: areaSquaresItemIds(),
      sessionLength,
    };
  }

  // ── g3-area-formula — area by multiplication ──────────────────────────────────
  if (skillId === 'g3-area-formula') {
    return {
      mode: 'area',
      specificItemIds: areaRectangleItemIds(),
      sessionLength,
    };
  }

  // ── G3_MD_PERIMETER / g3-perimeter — trace/sum boundaries then rectangle structure ──
  if (skillId === 'G3_MD_PERIMETER' || skillId === 'g3-perimeter') {
    return {
      mode: 'area',
      specificItemIds: [
        ...perimeterRectangleItemIds(),
        ...perimeterPolygonItemIds(),
      ],
      sessionLength,
    };
  }


  if (skillId === 'g3-area-perimeter-choice') {
    return { mode: 'area', specificItemIds: areaPerimeterChoiceItemIds(), sessionLength };
  }

  if (skillId === 'g3-perimeter-missing-side') {
    return {
      mode: 'area',
      specificItemIds: [...perimeterReasoningItemIds(), ...perimeterUnknownSideItemIds()],
      sessionLength,
    };
  }

  // ── g3-area-perimeter-compare — same area/diff perim, same perim/diff area ──
  if (skillId === 'g3-area-perimeter-compare') {
    return {
      mode: 'area',
      specificItemIds: areaPerimCompareItemIds(),
      sessionLength,
    };
  }

  // ── G3_G_SHAPES_ATTRIBUTES / g3-geo-categories — shape attributes ─────────────
  if (skillId === 'G3_G_SHAPES_ATTRIBUTES' || skillId === 'g3-geo-categories') {
    return {
      mode: 'geometry',
      specificItemIds: geoItemIds(),
      sessionLength,
    };
  }

  // ── g3-geo-rectilinear-area — decompose composite figures ────────────────────
  if (skillId === 'g3-geo-rectilinear-area') {
    return {
      mode: 'area',
      specificItemIds: rectilinearAreaItemIds(),
      sessionLength,
    };
  }

  // ── g3-mul-properties — commutative, identity, zero properties ───────────────
  if (skillId === 'g3-mul-properties') {
    return {
      mode: 'multiplication',
      specificItemIds: mulPropertyItemIds(),
      sessionLength,
    };
  }

  // ── g3-add-2digit-regrouping — 2-digit addition with carrying ────────────────
  if (skillId === 'g3-add-2digit-regrouping') {
    return {
      mode: 'addition',
      specificItemIds: add2DigitRegroupingItemIds(),
      sessionLength,
    };
  }

  // ── g3-add-3digit-regrouping — 3-digit addition with carrying ────────────────
  if (skillId === 'g3-add-3digit-regrouping') {
    return {
      mode: 'addition',
      specificItemIds: add3DigitRegroupingItemIds(),
      sessionLength,
    };
  }

  // ── g3-sub-2digit-regrouping — 2-digit subtraction with borrowing ─────────────
  if (skillId === 'g3-sub-2digit-regrouping') {
    return {
      mode: 'subtraction',
      specificItemIds: sub2DigitBorrowingItemIds(),
      sessionLength,
    };
  }

  // ── g3-sub-3digit-regrouping — 3-digit subtraction with borrowing ─────────────
  if (skillId === 'g3-sub-3digit-regrouping') {
    return {
      mode: 'subtraction',
      specificItemIds: sub3DigitBorrowingItemIds(),
      sessionLength,
    };
  }

  // ── g3-word-two-step — two-step word problems ─────────────────────────────────
  if (skillId === 'g3-word-two-step') {
    return {
      mode: 'word_problem',
      specificItemIds: twoStepItemIds(),
      sessionLength,
    };
  }

  // ── g3-patterns-arithmetic — arithmetic sequence patterns ────────────────────
  if (skillId === 'g3-patterns-arithmetic') {
    return {
      mode: 'multiplication',
      specificItemIds: arithmeticPatternItemIds(),
      sessionLength,
    };
  }

  // ── g3-round-nearest-10-100 — round to nearest 10 or 100 ─────────────────────
  if (skillId === 'g3-round-nearest-10-100') {
    return {
      mode: 'rounding',
      specificItemIds: roundNearest10or100ItemIds(),
      sessionLength,
    };
  }

  // ── g3-mul-multiple-of-10 — multiply by multiples of 10 ──────────────────────
  if (skillId === 'g3-mul-multiple-of-10') {
    return {
      mode: 'multiplication',
      specificItemIds: mulMultipleOf10ItemIds(),
      sessionLength,
    };
  }

  // ── g3-time-to-minute — tell time to the minute ───────────────────────────────
  if (skillId === 'g3-time-to-minute') {
    return {
      mode: 'measurement',
      specificItemIds: timeToMinuteItemIds(),
      sessionLength,
    };
  }

  // ── g3-elapsed-time — elapsed time in minutes ─────────────────────────────────
  if (skillId === 'g3-elapsed-time') {
    return {
      mode: 'measurement',
      specificItemIds: elapsedTimeItemIds(),
      sessionLength,
    };
  }

  // ── g3-volume-mass-word-problems — mass and liquid volume word problems ────────
  if (skillId === 'g3-volume-mass-word-problems') {
    return {
      mode: 'word_problem',
      specificItemIds: measurementWordItemIds(),
      sessionLength,
    };
  }

  // ── g3-scaled-bar-graphs — read scaled bar graphs ─────────────────────────────
  if (skillId === 'g3-scaled-bar-graphs') {
    return {
      mode: 'measurement',
      specificItemIds: scaledBarGraphItemIds(),
      sessionLength,
    };
  }

  // ── g3-line-plots — read line plots ──────────────────────────────────────────
  if (skillId === 'g3-line-plots') {
    return {
      mode: 'measurement',
      specificItemIds: linePlotItemIds(),
      sessionLength,
    };
  }

  // ── Fallback: daily review mode ───────────────────────────────────────────────
  return {
    mode: 'daily_review',
    sessionLength,
  };
}
