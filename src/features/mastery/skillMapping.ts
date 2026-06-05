import type { PracticeItem } from '../../types/math';

/**
 * Maps a PracticeItem to a Grade 3 mastery skill ID from GRADE3_MASTERY_MAP.
 *
 * Returns null for item types not covered by the Grade 3 mastery map
 * (e.g. addition, subtraction, rounding, decimals, primes).
 */
export function inferGrade3SkillId(item: PracticeItem): string | null {
  const { id, itemType, tags, factA, factB } = item;

  // ── Multiplication ────────────────────────────────────────────────────────
  if (itemType === 'multiplication_fact' || itemType === 'unknown_factor') {
    const a = factA ?? 0;
    const b = factB ?? 0;
    const bigTable = Math.max(a, b);
    // Grade 3 skill map: tables 0–5 = basic (3.OA.C.7 within 25), 6–10+ = advanced
    return bigTable <= 5 ? 'g3-mul-tables-basic' : 'g3-mul-tables-advanced';
  }

  // ── Division ──────────────────────────────────────────────────────────────
  if (itemType === 'division_fact') {
    // For DIV_{product}d{divisor} items, factB holds the divisor
    const divisor = factB ?? 0;
    // Divisors 1–5 target the basic-tables skill; 6+ require the mul-div relationship skill
    return divisor <= 5 ? 'g3-div-within-100' : 'g3-div-mul-relationship';
  }

  // ── Word problems ─────────────────────────────────────────────────────────
  if (itemType === 'word_problem') {
    // Tags always include the schema: 'eg' | 'ar' | 'cmp' | 'dv'
    if (tags.includes('dv')) return 'g3-div-meaning';
    // Fallback: parse schema from WORD_{schema}_{a}_{b} ID
    const m = id.match(/^WORD_([a-z]+)_/);
    if (m?.[1] === 'dv') return 'g3-div-meaning';
    // Schemas eg (equal groups), ar (array), cmp (comparison) → multiplication meaning
    return 'g3-mul-meaning';
  }

  // ── Fractions ─────────────────────────────────────────────────────────────
  if (itemType === 'fraction_equivalent') {
    // Unit fractions (numerator = 1) map to the unit-fraction skill.
    // FEQ ID format: FEQ_${n}_${d}_${targetDen}; parse n from the ID.
    const m = id.match(/^FEQ_(\d+)_/);
    return m && m[1] === '1' ? 'g3-frac-unit' : 'g3-frac-equivalent';
  }
  if (itemType === 'fraction_compare') return 'g3-frac-compare';
  if (itemType === 'fraction_number_line') return 'g3-frac-number-line';

  // ── Area and perimeter ────────────────────────────────────────────────────
  if (itemType === 'area_unit_squares') return 'g3-area-concept';
  if (itemType === 'area_rectangle') return 'g3-area-formula';
  if (itemType === 'perimeter_rectangle') return 'g3-perimeter';

  // ── Geometry ──────────────────────────────────────────────────────────────
  if (itemType === 'geometry_vocabulary') return 'g3-geo-categories';

  return null;
}
