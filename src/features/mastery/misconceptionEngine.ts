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
  const m = item.id.match(/^FCMP_(\d+)_(\d+)_(\d+)_(\d+)$/);
  if (!m) return [];

  const n1 = parseInt(m[1], 10);
  const d1 = parseInt(m[2], 10);
  const n2 = parseInt(m[3], 10);
  const d2 = parseInt(m[4], 10);

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
    }
  }

  // Numerator-only comparison: student compared numerators and ignored denominators
  // Only fires when the numerator comparison gives a different answer from the truth
  if (n1 !== n2) {
    const numeratorAnswer = n1 > n2 ? '>' : '<';
    if (sa === numeratorAnswer && numeratorAnswer !== trueAnswer) {
      patterns.push('frac_compare:numerator_only');
    }
  }

  return patterns;
}

// ── Equivalent fractions ───────────────────────────────────────────────────────
// fraction_equivalent: ID = FEQ_n_d_targetDen, answer = n * (targetDen / d)

function detectFractionEquivalent(item: PracticeItem, raw: string | number): string[] {
  const m = item.id.match(/^FEQ_(\d+)_(\d+)_(\d+)$/);
  if (!m) return [];

  const n = parseInt(m[1], 10);
  const d = parseInt(m[2], 10);
  const targetDen = parseInt(m[3], 10);

  if (d === 0 || targetDen % d !== 0) return [];

  const mult = targetDen / d;
  const sa = Number(raw);
  if (!Number.isFinite(sa) || !Number.isInteger(sa)) return [];

  const correct = n * mult;
  if (sa === correct) return [];

  // Use fraction.js to catch student answers that are equivalent via reduction
  if (sa >= 0 && new Fraction(n, d).equals(new Fraction(sa, targetDen))) return [];

  const patterns: string[] = [];

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
    }
  }

  return patterns;
}
