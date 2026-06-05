import type { SessionConfig } from '../../types/math';
import {
  mulId, divId, unkId,
  TABLE_MIN, TABLE_MAX,
} from '../curriculum/multiplicationItems';
import { fracEqId, fracCmpId } from '../curriculum/fractionItems';
import { wordId } from '../curriculum/wordProblemItems';
import { areaSquaresItemIds, areaRectangleItemIds, perimeterRectangleItemIds } from '../curriculum/areaItems';
import { geoItemIds } from '../curriculum/geometryItems';

export interface PlanOptions {
  sessionLength?: number;
  rounds?: number;
}

// ── Skill ID constants matching the roadmap spec ─────────────────────────────
// These are the skill IDs used in the Phase 9 spec (G3_OA_…, G3_NF_…).
// Note: grade3MasteryMap.ts uses a different id scheme (g3-mul-…).
// We support both formats here.

const BASIC_TABLES = [0, 1, 2, 5, 10];   // G3_OA_MUL_FACTS_0_2_5_10
const INTERMEDIATE_TABLES = [3, 4];       // G3_OA_MUL_FACTS_3_4
const ADVANCED_TABLES = [6, 7, 8, 9];    // G3_OA_MUL_FACTS_6_9

function mulItemIds(tables: number[]): string[] {
  const ids: string[] = [];
  for (const a of tables) {
    for (let b = TABLE_MIN; b <= TABLE_MAX; b++) {
      ids.push(mulId(a, b));
    }
  }
  return ids;
}

function divItemIds(tables: number[]): string[] {
  const ids: string[] = [];
  for (const divisor of tables) {
    for (let b = TABLE_MIN; b <= TABLE_MAX; b++) {
      const product = divisor * b;
      ids.push(divId(product, divisor));
    }
  }
  return ids;
}

function unknownFactorItemIds(tables: number[]): string[] {
  const ids: string[] = [];
  for (const a of tables) {
    for (let b = TABLE_MIN; b <= TABLE_MAX; b++) {
      const product = a * b;
      ids.push(unkId(product, a));
    }
  }
  return ids;
}

function fracEquivItemIds(): string[] {
  // Representative set: 1/2, 1/3, 1/4, 2/3, 3/4 with multipliers 2–4
  const fracs = [[1, 2], [1, 3], [1, 4], [2, 3], [3, 4]];
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
      specificItemIds: mulItemIds(BASIC_TABLES),
      sessionLength,
    };
  }

  // ── G3_OA_MUL_FACTS_3_4 ──────────────────────────────────────────────────────
  if (skillId === 'G3_OA_MUL_FACTS_3_4') {
    return {
      mode: 'multiplication',
      specificItemIds: mulItemIds(INTERMEDIATE_TABLES),
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
      specificItemIds: mulItemIds(ADVANCED_TABLES),
      sessionLength,
    };
  }

  // ── G3_OA_DIV_UNKNOWN_FACTOR (also: g3-div-within-100, g3-div-mul-relationship) ─
  if (
    skillId === 'G3_OA_DIV_UNKNOWN_FACTOR' ||
    skillId === 'g3-div-within-100' ||
    skillId === 'g3-div-mul-relationship'
  ) {
    return {
      mode: 'division',
      specificItemIds: [
        ...divItemIds([...BASIC_TABLES, ...INTERMEDIATE_TABLES]),
        ...unknownFactorItemIds([...BASIC_TABLES, ...INTERMEDIATE_TABLES]),
      ],
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

  // ── g3-frac-number-line — compare fractions (position on number line) ────
  if (skillId === 'g3-frac-number-line') {
    return {
      mode: 'fraction',
      specificItemIds: fracCmpItemIds(),
      fractionMode: 'compare',
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
  // Prereqs: g3-area-formula + g3-geo-categories; fall back to area rectangle items.
  if (skillId === 'g3-geo-rectilinear-area') {
    return {
      mode: 'area',
      specificItemIds: areaRectangleItemIds(),
      sessionLength,
    };
  }

  // ── Fallback: daily review mode ───────────────────────────────────────────────
  return {
    mode: 'daily_review',
    sessionLength,
  };
}
