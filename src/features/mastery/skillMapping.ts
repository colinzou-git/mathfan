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
    // 3.NBT.A.3: one factor is a non-trivial multiple of 10 (20–90), other is single-digit
    const isMultOf10 = (n: number) => n >= 20 && n <= 90 && n % 10 === 0;
    const isSingleDigit = (n: number) => n >= 2 && n <= 9;
    if ((isMultOf10(a) && isSingleDigit(b)) || (isMultOf10(b) && isSingleDigit(a))) {
      return 'g3-mul-multiple-of-10';
    }
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
    // Two-step word problems (WRD2_ prefix) — check before single-step
    if (id.startsWith('WRD2_')) return 'g3-word-two-step';
    // Tags always include the schema: 'eg' | 'ar' | 'cmp' | 'dv'
    if (tags.includes('dv')) return 'g3-div-meaning';
    // Fallback: parse schema from WORD_{schema}_{a}_{b} ID
    const m = id.match(/^WORD_([a-z]+)_/);
    if (m?.[1] === 'dv') return 'g3-div-meaning';
    // Schemas eg (equal groups), ar (array), cmp (comparison) → multiplication meaning
    return 'g3-mul-meaning';
  }

  // ── Addition regrouping ───────────────────────────────────────────────────
  if (itemType === 'addition_fact') {
    const a = factA ?? 0;
    const b = factB ?? 0;
    if (a >= 10 && a <= 99 && b >= 10 && b <= 99 && (a % 10) + (b % 10) >= 10) {
      return 'g3-add-2digit-regrouping';
    }
    if (a >= 100 && a <= 999 && b >= 100 && b <= 999) {
      const onesCarry = (a % 10) + (b % 10) >= 10;
      const tensCarry = Math.floor(a / 10) % 10 + Math.floor(b / 10) % 10 >= 10;
      if (onesCarry || tensCarry) return 'g3-add-3digit-regrouping';
    }
    return null;
  }

  // ── Subtraction regrouping ────────────────────────────────────────────────
  if (itemType === 'subtraction_fact') {
    // makeSubtractionItem always sets factA = minuend (larger), factB = subtrahend (smaller)
    const a = factA ?? 0;
    const b = factB ?? 0;
    if (a >= 10 && a <= 99 && b >= 10 && b <= 99 && (a % 10) < (b % 10)) {
      return 'g3-sub-2digit-regrouping';
    }
    if (a >= 100 && a <= 999 && b >= 100 && b <= 999) {
      const onesBorrow = (a % 10) < (b % 10);
      const tensBorrow = Math.floor(a / 10) % 10 < Math.floor(b / 10) % 10;
      if (onesBorrow || tensBorrow) return 'g3-sub-3digit-regrouping';
    }
    return null;
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
  if (itemType === 'perimeter_polygon') return 'g3-perimeter';
  if (itemType === 'perimeter_unknown_side') return 'g3-perimeter-missing-side';
  if (itemType === 'area_perimeter_choice') return 'g3-area-perimeter-choice';
  if (itemType === 'area_perimeter_compare') return 'g3-area-perimeter-compare';
  if (itemType === 'rectilinear_area') return 'g3-geo-rectilinear-area';

  // ── Geometry ──────────────────────────────────────────────────────────────
  if (itemType === 'geometry_vocabulary') return 'g3-geo-categories';

  // ── Multiplication properties ─────────────────────────────────────────────
  if (itemType === 'multiplication_properties') return 'g3-mul-properties';

  // ── Arithmetic patterns ───────────────────────────────────────────────────
  if (itemType === 'arithmetic_pattern') return 'g3-patterns-arithmetic';

  // ── Rounding ──────────────────────────────────────────────────────────────
  if (itemType === 'rounding') return 'g3-round-nearest-10-100';

  // ── Measurement & Data ────────────────────────────────────────────────────
  if (itemType === 'time_to_minute') return 'g3-time-to-minute';
  if (itemType === 'elapsed_time') return 'g3-elapsed-time';
  if (itemType === 'measurement_word') return 'g3-volume-mass-word-problems';
  if (itemType === 'bar_graph_read') return 'g3-scaled-bar-graphs';
  if (itemType === 'line_plot_read') return 'g3-line-plots';

  return null;
}
