import Fraction from 'fraction.js';
import type { PracticeItem } from '../../types/math';

/**
 * Detects common misconception patterns in a wrong student answer.
 * Returns an array of pattern code strings; empty when no pattern is recognized.
 *
 * Intended to be called only when the student's answer is already known to be
 * incorrect — this function does not re-check correctness.
 *
 * Pattern codes are namespaced by domain:
 *   mul:*          multiplication / unknown-factor items
 *   div:*          division items
 *   frac_compare:* fraction comparison items
 *   frac_equiv:*   fraction equivalence items
 */
export function detectMistakes(
  item: PracticeItem,
  studentAnswer: string | number,
): string[] {
  switch (item.itemType) {
    case 'multiplication_fact':
    case 'unknown_factor':
      return detectMultiplication(item, studentAnswer);
    case 'division_fact':
      return detectDivision(item, studentAnswer);
    case 'fraction_compare':
      return detectFractionCompare(item, String(studentAnswer));
    case 'fraction_equivalent':
      return detectFractionEquivalent(item, studentAnswer);
    case 'fraction_number_line':
      return detectFractionNumberLine(item, studentAnswer);
    case 'perimeter_rectangle':
      return detectPerimeterRectangle(item, studentAnswer);
    case 'area_rectangle':
    case 'area_unit_squares':
      return detectAreaRectangle(item, studentAnswer);
    case 'perimeter_unknown_side':
      return detectPerimeterUnknownSide(item, studentAnswer);
    case 'area_perimeter_choice':
      return detectAreaPerimeterChoice(item, studentAnswer);
    default:
      return [];
  }
}

// ── Multiplication / unknown-factor ───────────────────────────────────────────
// multiplication_fact: factA=a, factB=b, answer=a*b
// unknown_factor:      factA=known, factB=unknown, answer=unknown

function detectMultiplication(item: PracticeItem, raw: string | number): string[] {
  const a = item.factA ?? 0;
  const b = item.factB ?? 0;
  if (a === 0 || b === 0) return [];

  const sa = Number(raw);
  if (!Number.isFinite(sa)) return [];

  const correct = item.itemType === 'multiplication_fact' ? a * b : b;
  if (sa === correct) return [];

  const patterns: string[] = [];

  if (item.itemType === 'multiplication_fact') {
    // Addition instead of multiplication: student added the two factors
    if (sa === a + b) patterns.push('mul:addition_confusion');

    // Neighbor fact confusion: student recalled an adjacent multiplication fact
    if (
      sa === a * (b - 1) || sa === a * (b + 1) ||
      sa === (a - 1) * b || sa === (a + 1) * b
    ) {
      patterns.push('mul:neighbor_fact');
    }

    // Skip-count off by one: miscounted by exactly one instance of a factor
    if (Math.abs(sa - correct) === a || Math.abs(sa - correct) === b) {
      patterns.push('mul:skip_count_error');
    }
  } else {
    // unknown_factor: factA=known, factB=correct-unknown, answer=b
    // Neighbor-factor confusion: off by one in the missing factor
    if (sa === b - 1 || sa === b + 1) patterns.push('mul:neighbor_fact');

    // Skip-count off by one: one extra/fewer skip of the known factor
    if (Math.abs(sa - b) === 1) patterns.push('mul:skip_count_error');
  }

  return patterns;
}

// ── Division ──────────────────────────────────────────────────────────────────
// division_fact: factA=dividend, factB=divisor, answer=quotient

function detectDivision(item: PracticeItem, raw: string | number): string[] {
  const dividend = item.factA ?? 0;
  const divisor = item.factB ?? 0;
  if (dividend === 0 || divisor === 0) return [];

  const sa = Number(raw);
  if (!Number.isFinite(sa)) return [];

  const correct = Number(item.answer);
  if (sa === correct) return [];

  const patterns: string[] = [];

  // Student gave the dividend instead of the quotient
  if (sa === dividend) patterns.push('div:gave_dividend');

  // Student gave the divisor instead of the quotient
  if (sa === divisor) patterns.push('div:gave_divisor');

  return patterns;
}

// ── Fraction compare ───────────────────────────────────────────────────────────
// fraction_compare: ID = FCMP_n1_d1_n2_d2, answer = '<' | '=' | '>'

function detectFractionCompare(item: PracticeItem, sa: string): string[] {
  const structured = item.fractionSpec?.kind === 'compare' ? item.fractionSpec : null;
  const m = item.id.match(/^FCMP_(\d+)_(\d+)_(\d+)_(\d+)$/);
  if (!structured && !m) return [];

  const n1 = structured?.left.numerator ?? parseInt(m![1], 10);
  const d1 = structured?.left.denominator ?? parseInt(m![2], 10);
  const n2 = structured?.right.numerator ?? parseInt(m![3], 10);
  const d2 = structured?.right.denominator ?? parseInt(m![4], 10);
  if (sa.includes('different-sized wholes')) return ['fraction:fraction_not_same_whole'];

  // Use fraction.js for exact comparison (avoids floating-point errors)
  const f1 = new Fraction(n1, d1);
  const f2 = new Fraction(n2, d2);
  const cmpSign = f1.compare(f2); // -1 | 0 | 1
  const trueAnswer = cmpSign < 0 ? '<' : cmpSign > 0 ? '>' : '=';

  if (sa === trueAnswer) return [];

  const patterns: string[] = [];

  // Larger-denominator misconception: student treats a bigger denominator as a bigger fraction
  // e.g., 1/4 ▢ 1/2 → student says '>' because 4 > 2
  if (d1 !== d2) {
    const denominatorAnswer = d1 > d2 ? '>' : '<';
    if (sa === denominatorAnswer) {
      patterns.push('frac_compare:larger_denominator');
      patterns.push('fraction:compare_larger_denominator_means_larger');
    }
  }

  // Numerator-only comparison: student compared numerators and ignored denominators
  // Only fires when the numerator comparison gives a different answer from the truth
  if (n1 !== n2) {
    const numeratorAnswer = n1 > n2 ? '>' : '<';
    if (sa === numeratorAnswer && numeratorAnswer !== trueAnswer) {
      patterns.push('frac_compare:numerator_only');
      patterns.push('fraction:compare_numerator_only');
    }
  }

  if ((trueAnswer === '<' && sa === '>') || (trueAnswer === '>' && sa === '<')) {
    patterns.push('fraction:compare_reversed_symbol');
  }

  return patterns;
}

function detectFractionNumberLine(item: PracticeItem, raw: string | number): string[] {
  const spec = item.fractionSpec?.kind === 'locate_number_line' ? item.fractionSpec : null;
  const expected = spec?.value.numerator ?? item.factA;
  const answer = Number(raw);
  return expected != null && answer === expected + 1
    ? ['fraction:number_line_counted_tick_marks_not_intervals']
    : [];
}

// ── Equivalent fractions ───────────────────────────────────────────────────────
// fraction_equivalent: ID = FEQ_n_d_targetDen, answer = n * (targetDen / d)

function detectFractionEquivalent(item: PracticeItem, raw: string | number): string[] {
  const structured = item.fractionSpec?.kind === 'equivalent_visual' ? item.fractionSpec : null;
  const m = item.id.match(/^FEQ_(\d+)_(\d+)_(\d+)$/);
  if (!structured && !m) return [];

  const n = structured?.left.numerator ?? parseInt(m![1], 10);
  const d = structured?.left.denominator ?? parseInt(m![2], 10);
  const targetDen = structured?.right.denominator ?? parseInt(m![3], 10);

  if (d === 0 || targetDen % d !== 0) return [];

  const mult = targetDen / d;
  const sa = Number(raw);
  if (!Number.isFinite(sa) || !Number.isInteger(sa)) return [];

  const correct = n * mult;
  if (sa === correct) return [];

  // Use fraction.js to catch student answers that are equivalent via reduction
  if (sa >= 0 && new Fraction(n, d).equals(new Fraction(sa, targetDen))) return [];

  const patterns: string[] = [];
  if (sa === n) patterns.push('fraction:equivalent_changed_denominator_only');
  if (sa === targetDen) patterns.push('fraction:equivalent_changed_numerator_only');

  // Additive error: student added the scale difference to the numerator instead of multiplying
  // e.g., 2/3 = ?/6 (mult=2): student computes 2 + (6−3) = 5 instead of 2×2 = 4
  const additiveGuess = n + (targetDen - d);
  if (sa === additiveGuess) {
    patterns.push('frac_equiv:additive_error');
  }

  // Wrong multiplier: student multiplied by a different integer
  // Detect when sa is a non-zero integer multiple of n and the multiplier is wrong
  if (n > 0 && sa > 0 && sa % n === 0) {
    const usedMult = sa / n;
    if (usedMult !== mult) {
      patterns.push('frac_equiv:wrong_multiplier');
      patterns.push('fraction:equivalent_wrong_multiplier');
    }
  }

  return patterns;
}

// ── Area & perimeter (issue #30) ───────────────────────────────────────────
// Pattern codes namespaced `area_perim:*`.

function detectPerimeterRectangle(item: PracticeItem, raw: string | number): string[] {
  const l = item.factA ?? 0;
  const w = item.factB ?? 0;
  if (l === 0 || w === 0) return [];
  const sa = Number(raw);
  if (!Number.isFinite(sa)) return [];
  const correct = 2 * (l + w);
  if (sa === correct) return [];

  const patterns: string[] = [];
  if (sa === l * w) patterns.push('area_perim:used_area_for_perimeter');
  if (sa === l + w) patterns.push('area_perim:used_half_perimeter');
  if (sa === 2 * l + w || sa === l + 2 * w) patterns.push('area_perim:forgot_one_pair_of_sides');
  return patterns;
}

function detectAreaRectangle(item: PracticeItem, raw: string | number): string[] {
  const l = item.factA ?? 0;
  const w = item.factB ?? 0;
  if (l === 0 || w === 0) return [];
  const sa = Number(raw);
  if (!Number.isFinite(sa)) return [];
  const correct = l * w;
  if (sa === correct) return [];

  if (sa === 2 * (l + w)) return ['area_perim:used_perimeter_for_area'];
  return [];
}

function detectPerimeterUnknownSide(item: PracticeItem, raw: string | number): string[] {
  const spec = item.reasoningSpec;
  if (!spec) return [];
  const sa = Number(raw);
  if (!Number.isFinite(sa)) return [];
  const sumKnown = spec.knownSides.reduce((s, n) => s + n, 0);
  const correct = spec.totalPerimeter - sumKnown;
  if (sa === correct) return [];

  const patterns: string[] = [];
  if (sa === spec.totalPerimeter) patterns.push('area_perim:copied_given_perimeter');
  if (sa === spec.totalPerimeter + sumKnown) patterns.push('area_perim:summed_non_boundary_values');
  if (sa === sumKnown - spec.totalPerimeter && sa !== correct) patterns.push('area_perim:missing_side_subtraction_error');
  return patterns;
}

function detectAreaPerimeterChoice(item: PracticeItem, raw: string | number): string[] {
  const sa = String(raw).trim();
  if (sa === String(item.answer)) return [];

  const l = item.factA;
  const w = item.factB;
  if (l == null || w == null) return [];

  // Operation-selection ("would you use area or perimeter?")
  if (sa === 'area' && item.answer === 'perimeter') return ['area_perim:used_area_for_perimeter'];
  if (sa === 'perimeter' && item.answer === 'area') return ['area_perim:used_perimeter_for_area'];

  // Expression-selection ("which expression represents the boundary?")
  if (sa === `${l}×${w}`) return ['area_perim:used_area_for_perimeter'];
  if (sa === `${l} + ${w}`) return ['area_perim:used_half_perimeter'];
  if (sa === `2×${l} + ${w}` || sa === `${l} + 2×${w}`) return ['area_perim:forgot_one_pair_of_sides'];

  return [];
}
