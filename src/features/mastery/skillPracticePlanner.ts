import type { SessionConfig } from '../../types/math';
import {
  mulId, divId,
} from '../curriculum/multiplicationItems';
import { fracEqId, fracCmpId } from '../curriculum/fractionItems';
import { wordId } from '../curriculum/wordProblemItems';
import { areaSquaresItemIds, areaRectangleItemIds, perimeterRectangleItemIds, rectilinearAreaItemIds } from '../curriculum/areaItems';
import { geoItemIds } from '../curriculum/geometryItems';
import { mulPropertyItemIds } from '../curriculum/mulPropertiesItems';
import { fracNlId } from '../curriculum/fractionItems';
import { addId, subId } from '../curriculum/arithmeticItems';

export interface PlanOptions {
  sessionLength?: number;
  rounds?: number;
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
      specificItemIds: fracCmpItemIds(),
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
      specificItemIds: fracUnitItemIds(),
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

  // ── G3_MD_PERIMETER / g3-perimeter — perimeter of rectangles ─────────────────
  if (skillId === 'G3_MD_PERIMETER' || skillId === 'g3-perimeter') {
    return {
      mode: 'area',
      specificItemIds: perimeterRectangleItemIds(),
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

  // ── Fallback: daily review mode ───────────────────────────────────────────────
  return {
    mode: 'daily_review',
    sessionLength,
  };
}
