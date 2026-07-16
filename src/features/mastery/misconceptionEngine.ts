import Fraction from 'fraction.js';
import type { MisconceptionEvidence, PracticeItem } from '../../types/math';
import { simulateArithmeticMisconception, type ArithmeticMisconceptionCode } from '../curriculum/regrouping';
import { simulateDivisionMisconception, type DivisionMisconceptionCode } from '../curriculum/divisionItems';

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
  if (item.measurementSpec) return detectMeasurement(item, studentAnswer);
  switch (item.itemType) {
    case 'multiplication_fact':
    case 'unknown_factor':
      return detectMultiplication(item, studentAnswer);
    case 'division_fact':
      return detectDivision(item, studentAnswer);
    case 'addition_fact':
    case 'subtraction_fact':
      return detectArithmetic(item, studentAnswer);
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

export interface MisconceptionEventContext {
  eventId: string;
  sessionId: string;
  itemId: string;
  createdAt: string;
}

function normalizeEvidence(
  evidence: MisconceptionEvidence[] | undefined,
  legacyPatterns: string[] = [],
): MisconceptionEvidence[] {
  const byCode = new Map((evidence ?? []).map(entry => [entry.code, { ...entry }]));
  for (const code of legacyPatterns) {
    if (!byCode.has(code)) {
      byCode.set(code, {
        code,
        firstSeenAt: '',
        lastSeenAt: '',
        occurrenceCount: 1,
        sourceItemIds: [],
        status: 'active',
      });
    }
  }
  return [...byCode.values()];
}

export function applyMisconceptionDetection(
  evidence: MisconceptionEvidence[] | undefined,
  codes: string[],
  context: MisconceptionEventContext,
  legacyPatterns: string[] = [],
): MisconceptionEvidence[] {
  const byCode = new Map(normalizeEvidence(evidence, legacyPatterns).map(entry => [entry.code, entry]));
  for (const code of codes) {
    const prior = byCode.get(code);
    byCode.set(code, {
      code,
      firstSeenAt: prior?.firstSeenAt || context.createdAt,
      lastSeenAt: context.createdAt,
      occurrenceCount: (prior?.occurrenceCount ?? 0) + 1,
      sourceItemIds: [...new Set([...(prior?.sourceItemIds ?? []), context.itemId])],
      status: 'active',
      confirmingEventIds: [],
      confirmingSessionIds: [],
      confirmingDates: [],
    });
  }
  return [...byCode.values()];
}

function misconceptionFamily(code: string): string {
  if (code.startsWith('frac_compare:') || code.startsWith('fraction:compare_')) return 'fraction_compare';
  if (code.startsWith('frac_equiv:') || code.startsWith('fraction:equiv')) return 'fraction_equivalent';
  if (code.startsWith('fraction:number_line')) return 'fraction_number_line';
  return code.split(':', 1)[0];
}

export function itemTargetsMisconception(item: PracticeItem, code: string): boolean {
  const family = misconceptionFamily(code);
  if (family === 'fraction_compare') return item.itemType === 'fraction_compare';
  if (family === 'fraction_equivalent') return item.itemType === 'fraction_equivalent';
  if (family === 'fraction_number_line') return item.itemType === 'fraction_number_line';
  if (family === 'fraction') return item.itemType.startsWith('fraction_');
  if (family === 'arithmetic') return item.itemType === 'addition_fact' || item.itemType === 'subtraction_fact';
  if (family === 'measurement') return Boolean(item.measurementSpec);
  if (family === 'mul') return item.itemType === 'multiplication_fact' || item.itemType === 'unknown_factor';
  if (family === 'div') return item.itemType === 'division_fact';
  return false;
}

export function applyMisconceptionConfirmation(
  evidence: MisconceptionEvidence[] | undefined,
  item: PracticeItem,
  context: MisconceptionEventContext,
  legacyPatterns: string[] = [],
): { evidence: MisconceptionEvidence[]; confirmedCodes: string[] } {
  const confirmedCodes: string[] = [];
  const next = normalizeEvidence(evidence, legacyPatterns).map(entry => {
    if (entry.status === 'resolved' || !itemTargetsMisconception(item, entry.code)) return entry;
    const eventIds = [...new Set([...(entry.confirmingEventIds ?? []), context.eventId])];
    const sessionIds = [...new Set([...(entry.confirmingSessionIds ?? []), context.sessionId])];
    const dates = [...new Set([...(entry.confirmingDates ?? []), context.createdAt.slice(0, 10)])];
    const resolved = eventIds.length >= 2 && (sessionIds.length >= 2 || dates.length >= 2);
    confirmedCodes.push(entry.code);
    return {
      ...entry,
      status: resolved ? 'resolved' as const : 'resolving' as const,
      resolvedAt: resolved ? context.createdAt : undefined,
      confirmingEventIds: eventIds,
      confirmingSessionIds: sessionIds,
      confirmingDates: dates,
    };
  });
  return { evidence: next, confirmedCodes };
}

export function hasUnresolvedMisconceptionForSkill(
  evidence: MisconceptionEvidence[],
  skillId: string,
): boolean {
  if (!skillId.startsWith('g3-frac-')) return false;
  return evidence.some(entry => entry.status !== 'resolved'
    && (entry.code.startsWith('fraction:') || entry.code.startsWith('frac_')));
}

function detectMeasurement(item: PracticeItem, raw: string | number): string[] {
  const spec = item.measurementSpec!, answer = Number(raw), correct = Number(item.answer);
  if (!Number.isFinite(answer) || answer === correct) return [];
  const patterns: string[] = [];
  if (spec.kind === 'elapsed_time') {
    if (answer === Math.abs(spec.end.minute - spec.start.minute)) patterns.push('measurement:elapsed_subtracted_clock_digits');
    if (answer === spec.end.minute) patterns.push('measurement:elapsed_copied_end_minutes');
    if (spec.crossesHour && answer === spec.end.minute - spec.start.minute) patterns.push('measurement:elapsed_ignored_hour_crossing');
    if (answer === spec.durationMinutes + 1) patterns.push('measurement:elapsed_counted_endpoints');
  }
  if (spec.kind === 'bar_graph' && spec.requestedIndex !== undefined) {
    const value = spec.values[spec.requestedIndex];
    if (answer === value / spec.scale) patterns.push('measurement:bar_height_read_without_scale');
    if (spec.scale !== 1 && answer * spec.scale === value) patterns.push('measurement:graph_scale_ignored');
  }
  if (spec.kind === 'line_plot' && spec.denominator > 1 && answer === correct * spec.denominator) patterns.push('measurement:line_plot_ticks_vs_intervals');
  return [...new Set(patterns)];
}

const ARITHMETIC_MISCONCEPTIONS: ArithmeticMisconceptionCode[] = [
  'sub_failed_to_regroup_ones', 'sub_failed_to_regroup_tens', 'sub_across_zero_error',
  'sub_borrowed_without_reducing_source', 'sub_place_value_shift_10', 'sub_place_value_shift_100',
  'add_failed_to_carry_ones', 'add_failed_to_carry_tens', 'add_double_carried',
  'copied_operand_or_partial_result',
];

function detectArithmetic(item: PracticeItem, raw: string | number): string[] {
  if (!item.arithmeticSpec || item.arithmeticSpec.mode === 'error_analysis') return [];
  const answer = Number(raw);
  if (!Number.isFinite(answer) || answer === Number(item.answer)) return [];
  return ARITHMETIC_MISCONCEPTIONS.filter(code => simulateArithmeticMisconception(item.arithmeticSpec!, code) === answer)
    .map(code => `arithmetic:${code}`);
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

  if (item.divisionSpec) {
    const spec = item.divisionSpec;
    const codes: DivisionMisconceptionCode[] = [
      'div_swapped_dividend_divisor', 'div_used_multiplication_result',
      'div_shared_vs_grouped_confusion', 'div_partial_quotient_missing',
      'div_decomposition_sum_error', 'div_quotient_off_by_one',
      'div_used_related_fact_incorrectly', 'div_copied_dividend_or_divisor',
    ];
    const matched = new Set<number>();
    for (const code of codes) {
      const simulation = simulateDivisionMisconception(spec, code);
      if (!simulation.applicable || !Number.isInteger(simulation.answer) || matched.has(simulation.answer)) continue;
      matched.add(simulation.answer);
      if (sa === simulation.answer) patterns.push(`div:${code}`);
    }
  }

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
