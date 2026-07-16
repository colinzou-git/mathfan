import { describe, it, expect } from 'vitest';
import {
  applyMisconceptionConfirmation,
  applyMisconceptionDetection,
  detectMistakes,
  hasUnresolvedMisconceptionForSkill,
} from '../features/mastery/misconceptionEngine';
import {
  makeMultiplicationItem,
  generateDivisionItems,
  generateUnknownFactorItems,
} from '../features/curriculum/multiplicationItems';
import { makeFractionCompareItem, makeFractionEquivalentItem } from '../features/curriculum/fractionItems';

// ── Helpers ───────────────────────────────────────────────────────────────────

const divItems = generateDivisionItems(2, 10);
function divItem(dividend: number, divisor: number) {
  return divItems.find(i => i.factA === dividend && i.factB === divisor)!;
}

const unkItems = generateUnknownFactorItems(2, 10);
function unkItem(known: number, unknown: number) {
  return unkItems.find(i => i.factA === known && i.factB === unknown)!;
}

describe('misconception evidence lifecycle', () => {
  const compare = makeFractionCompareItem(1, 4, 1, 2);
  const equivalent = makeFractionEquivalentItem(1, 2, 4);
  const detected = applyMisconceptionDetection(undefined, ['fraction:compare_larger_denominator_means_larger'], {
    eventId: 'wrong-1', sessionId: 'session-1', itemId: compare.id, createdAt: '2026-01-01T10:00:00.000Z',
  });

  it('keeps one immediate correct confirmation unresolved', () => {
    const confirmation = applyMisconceptionConfirmation(detected, compare, {
      eventId: 'correct-1', sessionId: 'session-1', itemId: compare.id, createdAt: '2026-01-01T10:01:00.000Z',
    });
    expect(confirmation.evidence[0].status).toBe('resolving');
    expect(hasUnresolvedMisconceptionForSkill(confirmation.evidence, 'g3-frac-compare')).toBe(true);
  });

  it('resolves after two targeted independent confirmations across sessions', () => {
    const first = applyMisconceptionConfirmation(detected, compare, {
      eventId: 'correct-1', sessionId: 'session-1', itemId: compare.id, createdAt: '2026-01-01T10:01:00.000Z',
    }).evidence;
    const second = applyMisconceptionConfirmation(first, compare, {
      eventId: 'correct-2', sessionId: 'session-2', itemId: compare.id, createdAt: '2026-01-01T11:00:00.000Z',
    }).evidence;
    expect(second[0].status).toBe('resolved');
    expect(hasUnresolvedMisconceptionForSkill(second, 'g3-frac-compare')).toBe(false);
  });

  it('does not use unrelated fraction representations as confirmation', () => {
    const result = applyMisconceptionConfirmation(detected, equivalent, {
      eventId: 'unrelated', sessionId: 'session-2', itemId: equivalent.id, createdAt: '2026-01-02T10:00:00.000Z',
    });
    expect(result.confirmedCodes).toEqual([]);
    expect(result.evidence[0].status).toBe('active');
  });

  it('reactivates resolved evidence when the misconception recurs', () => {
    const resolved = [{
      ...detected[0], status: 'resolved' as const, resolvedAt: '2026-01-02T10:00:00.000Z',
      confirmingEventIds: ['correct-1', 'correct-2'],
    }];
    const recurrent = applyMisconceptionDetection(resolved, [resolved[0].code], {
      eventId: 'wrong-2', sessionId: 'session-3', itemId: compare.id, createdAt: '2026-01-03T10:00:00.000Z',
    });
    expect(recurrent[0]).toMatchObject({ status: 'active', occurrenceCount: 2 });
    expect(recurrent[0].resolvedAt).toBeUndefined();
    expect(recurrent[0].confirmingEventIds).toEqual([]);
  });

  it('converts legacy string evidence and allows it to resolve', () => {
    const first = applyMisconceptionConfirmation(undefined, compare, {
      eventId: 'correct-1', sessionId: 'session-1', itemId: compare.id, createdAt: '2026-01-01T10:00:00.000Z',
    }, ['fraction:compare_larger_denominator_means_larger']).evidence;
    const second = applyMisconceptionConfirmation(first, compare, {
      eventId: 'correct-2', sessionId: 'session-2', itemId: compare.id, createdAt: '2026-01-02T10:00:00.000Z',
    }).evidence;
    expect(second[0].status).toBe('resolved');
  });
});

// ── Multiplication: addition instead of multiplication ────────────────────────

describe('mul:addition_confusion', () => {
  it('flags when student adds the two factors', () => {
    const item = makeMultiplicationItem(3, 4); // 3×4=12; 3+4=7
    expect(detectMistakes(item, 7)).toContain('mul:addition_confusion');
  });

  it('flags 5×6 when student answers 11 (5+6)', () => {
    const item = makeMultiplicationItem(5, 6); // 5×6=30; 5+6=11
    expect(detectMistakes(item, 11)).toContain('mul:addition_confusion');
  });

  it('does not flag when answer is correct', () => {
    const item = makeMultiplicationItem(3, 4);
    expect(detectMistakes(item, 12)).toEqual([]);
  });

  it('does not flag when wrong answer is not the sum', () => {
    const item = makeMultiplicationItem(4, 6); // 4×6=24; 4+6=10
    expect(detectMistakes(item, 20)).not.toContain('mul:addition_confusion');
  });
});

// ── Multiplication: neighbor fact confusion ────────────────────────────────────

describe('mul:neighbor_fact', () => {
  it('flags when student gives 7×8 instead of 7×9 (one factor off by 1)', () => {
    const item = makeMultiplicationItem(7, 9); // 7×9=63
    expect(detectMistakes(item, 56)).toContain('mul:neighbor_fact'); // 7×8=56
  });

  it('flags when student gives 6×6 instead of 7×6 (first factor off by 1)', () => {
    const item = makeMultiplicationItem(7, 6); // 7×6=42
    expect(detectMistakes(item, 36)).toContain('mul:neighbor_fact'); // 6×6=36
  });

  it('flags when student gives 8×6 instead of 7×6 (first factor off by +1)', () => {
    const item = makeMultiplicationItem(7, 6); // 7×6=42
    expect(detectMistakes(item, 48)).toContain('mul:neighbor_fact'); // 8×6=48
  });

  it('does not flag a random wrong answer', () => {
    const item = makeMultiplicationItem(7, 9);
    expect(detectMistakes(item, 50)).not.toContain('mul:neighbor_fact');
  });
});

// ── Multiplication: skip-count off by one ─────────────────────────────────────

describe('mul:skip_count_error', () => {
  it('flags when student is off by exactly one factor (one skip missing)', () => {
    const item = makeMultiplicationItem(6, 8); // 6×8=48; off by 6 → 42 or 54
    expect(detectMistakes(item, 42)).toContain('mul:skip_count_error');
    expect(detectMistakes(item, 54)).toContain('mul:skip_count_error');
  });

  it('flags when off by the other factor value', () => {
    const item = makeMultiplicationItem(4, 9); // 4×9=36; off by 9 → 27 or 45
    expect(detectMistakes(item, 27)).toContain('mul:skip_count_error');
  });

  it('does not flag when off by a different amount', () => {
    const item = makeMultiplicationItem(3, 7); // 3×7=21
    expect(detectMistakes(item, 17)).not.toContain('mul:skip_count_error');
  });
});

// ── Division: quotient/divisor/dividend confusion ─────────────────────────────

describe('div:gave_dividend', () => {
  it('flags when student gives the dividend (numerator) as the answer', () => {
    // 24 ÷ 4 = 6; student says 24
    const item = divItem(24, 4);
    expect(detectMistakes(item, 24)).toContain('div:gave_dividend');
  });

  it('flags 18 ÷ 3 = 6; student says 18 (the dividend)', () => {
    const item = divItem(18, 3);
    expect(detectMistakes(item, 18)).toContain('div:gave_dividend');
  });
});

describe('div:gave_divisor', () => {
  it('flags when student gives the divisor instead of the quotient', () => {
    // 24 ÷ 4 = 6; student says 4
    const item = divItem(24, 4);
    expect(detectMistakes(item, 4)).toContain('div:gave_divisor');
  });

  it('flags 36 ÷ 9 = 4; student says 9 (the divisor)', () => {
    const item = divItem(36, 9);
    expect(detectMistakes(item, 9)).toContain('div:gave_divisor');
  });

  it('does not flag a random wrong answer', () => {
    const item = divItem(24, 4);
    expect(detectMistakes(item, 5)).not.toContain('div:gave_divisor');
    expect(detectMistakes(item, 5)).not.toContain('div:gave_dividend');
  });
});

// ── Unknown factor: neighbor fact and skip-count ───────────────────────────────

describe('unknown_factor misconceptions', () => {
  it('flags neighbor_fact when student gives the adjacent factor', () => {
    // 3 × ? = 21, correct=7; student says 6 (off by 1)
    const item = unkItem(3, 7);
    expect(detectMistakes(item, 6)).toContain('mul:neighbor_fact');
    expect(detectMistakes(item, 8)).toContain('mul:neighbor_fact');
  });

  it('flags skip_count_error when student is off by 1', () => {
    const item = unkItem(5, 6); // 5 × ? = 30, correct=6
    expect(detectMistakes(item, 5)).toContain('mul:skip_count_error');
    expect(detectMistakes(item, 7)).toContain('mul:skip_count_error');
  });

  it('does not flag addition_confusion for unknown_factor', () => {
    const item = unkItem(3, 7); // 3 × ? = 21; 3+7=10
    expect(detectMistakes(item, 10)).not.toContain('mul:addition_confusion');
  });
});

// ── Fraction compare: larger denominator misconception ────────────────────────

describe('frac_compare:larger_denominator', () => {
  it('flags when student says 1/4 > 1/2 (thinks larger denominator = larger fraction)', () => {
    // FCMP_1_4_1_2: 1/4 < 1/2, correct='<'
    // Student says '>' thinking d=4 > d=2 means 1/4 is bigger
    const item = makeFractionCompareItem(1, 4, 1, 2);
    expect(detectMistakes(item, '>')).toContain('frac_compare:larger_denominator');
  });

  it('flags when student says 2/5 > 3/4 (larger denominator confusion)', () => {
    // 2/5=0.4, 3/4=0.75 → correct '<'
    // Student says '>' because d=5 > d=4
    const item = makeFractionCompareItem(2, 5, 3, 4);
    expect(detectMistakes(item, '>')).toContain('frac_compare:larger_denominator');
  });

  it('does not flag when denominators are equal', () => {
    // 3/5 vs 2/5: same denominator, no larger-denominator misconception possible
    const item = makeFractionCompareItem(3, 5, 2, 5);
    expect(detectMistakes(item, '<')).not.toContain('frac_compare:larger_denominator');
  });

  it('does not flag when the correct answer happens to align with denominator comparison', () => {
    // 3/4 vs 1/2: d1=4 > d2=2, but 3/4=0.75 > 1/2=0.5, so correct='>'
    // denominatorAnswer='>' matches correct, so no misconception to detect
    const item = makeFractionCompareItem(3, 4, 1, 2);
    // Student says '<' (wrong), but not the larger-denominator prediction
    expect(detectMistakes(item, '<')).not.toContain('frac_compare:larger_denominator');
  });
});

// ── Fraction compare: numerator-only comparison ───────────────────────────────

describe('frac_compare:numerator_only', () => {
  it('flags when student compares numerators only (2/3 vs 3/5: 2<3 → says <)', () => {
    // 2/3=0.667 > 3/5=0.6 → correct '>'
    // Student compares 2 vs 3 and says '<'
    const item = makeFractionCompareItem(2, 3, 3, 5);
    expect(detectMistakes(item, '<')).toContain('frac_compare:numerator_only');
  });

  it('flags when student says 1/3 > 3/4 based on numerator 1 vs 3', () => {
    // 1/3 < 3/4, correct '<'; student compares 1 vs 3 and says... no, 1 < 3 so '<' is also correct here
    // Let's use 3/5 vs 1/4: 3/5=0.6 > 1/4=0.25, correct '>'; n1=3 > n2=1 → numerator predicts '>'
    // This would be correct, so no flag. Try: 1/2 vs 2/3: 0.5 < 0.667, correct '<'; n1=1 < n2=2 → numerator predicts '<'
    // Also correct — no flag. Need a case where numerators mislead.
    // 3/4 vs 2/3: 0.75 > 0.667, correct '>'; n1=3 > n2=2 → numerator predicts '>' ✓ also correct
    // 2/5 vs 3/4: 0.4 < 0.75, correct '<'; n1=2 < n2=3 → numerator predicts '<' ✓ also correct
    // 3/5 vs 2/3: 0.6 < 0.667, correct '<'; n1=3 > n2=2 → numerator predicts '>' — MISMATCH!
    const item = makeFractionCompareItem(3, 5, 2, 3);
    expect(detectMistakes(item, '>')).toContain('frac_compare:numerator_only');
  });

  it('does not flag when numerator comparison matches the correct answer', () => {
    // 1/4 vs 2/3: 0.25 < 0.667, correct '<'; n1=1 < n2=2 → numerator predicts '<'
    // correct '<' and numerator predicts '<' — would be correct, no flag needed
    const item = makeFractionCompareItem(1, 4, 2, 3);
    // Student says '=' (wrong, but not numerator-only pattern)
    expect(detectMistakes(item, '=')).not.toContain('frac_compare:numerator_only');
  });
});

// ── Equivalent fractions: additive error ──────────────────────────────────────

describe('frac_equiv:additive_error', () => {
  it('flags when student adds the scale difference to the numerator', () => {
    // 2/3 = ?/6: mult=2, correct=4; additive: 2 + (6−3) = 5
    const item = makeFractionEquivalentItem(2, 3, 2); // FEQ_2_3_6
    expect(detectMistakes(item, 5)).toContain('frac_equiv:additive_error');
  });

  it('flags for 1/2 = ?/8: correct=4; additive: 1 + (8−2) = 7', () => {
    const item = makeFractionEquivalentItem(1, 2, 4); // FEQ_1_2_8
    expect(detectMistakes(item, 7)).toContain('frac_equiv:additive_error');
  });

  it('does not flag the correct answer', () => {
    const item = makeFractionEquivalentItem(2, 3, 2); // FEQ_2_3_6, correct=4
    expect(detectMistakes(item, 4)).toEqual([]);
  });
});

// ── Equivalent fractions: wrong multiplier ────────────────────────────────────

describe('frac_equiv:wrong_multiplier', () => {
  it('flags when student multiplies by the wrong integer', () => {
    // 1/3 = ?/9: mult=3, correct=3; student gives 1*2=2 (wrong multiplier)
    const item = makeFractionEquivalentItem(1, 3, 3); // FEQ_1_3_9
    expect(detectMistakes(item, 2)).toContain('frac_equiv:wrong_multiplier');
  });

  it('flags when student multiplies numerator by denominator instead of scale', () => {
    // 2/3 = ?/6: mult=2, correct=4; student gives 2*3=6 (multiplied by denominator, not scale)
    const item = makeFractionEquivalentItem(2, 3, 2); // FEQ_2_3_6
    expect(detectMistakes(item, 6)).toContain('frac_equiv:wrong_multiplier');
  });

  it('does not flag for the correct answer', () => {
    const item = makeFractionEquivalentItem(1, 3, 3); // FEQ_1_3_9, correct=3
    expect(detectMistakes(item, 3)).toEqual([]);
  });

  it('does not flag for non-multiple answers', () => {
    // 2/3 = ?/6, correct=4; student says 5 (not a multiple of 2)
    const item = makeFractionEquivalentItem(2, 3, 2); // FEQ_2_3_6
    // 5 is not divisible by 2, so wrong_multiplier should not fire
    expect(detectMistakes(item, 5)).not.toContain('frac_equiv:wrong_multiplier');
  });
});

// ── Fraction.js exact comparison edge cases ───────────────────────────────────

describe('fraction.js exact comparison', () => {
  it('handles fractions that are equal (= comparison, student says <)', () => {
    // 2/4 ▢ 1/2: true answer '='
    const item = makeFractionCompareItem(2, 4, 1, 2);
    expect(detectMistakes(item, '<')).not.toContain('frac_compare:larger_denominator');
  });

  it('detects equivalent student answer for fraction_equivalent (no pattern)', () => {
    // 2/4 = ?/2: this isn't a valid generated item (gcd != 1), but test equivalence check
    // Use 1/2 = ?/4 (mult=2), correct=2; student gives 2 (correct) — already handled
    const item = makeFractionEquivalentItem(1, 2, 2); // FEQ_1_2_4, correct=2
    expect(detectMistakes(item, 2)).toEqual([]);
  });

  it('returns empty for unsupported item types', () => {
    const item = makeMultiplicationItem(3, 4);
    const additionItem = { ...item, itemType: 'addition_fact' as never };
    expect(detectMistakes(additionItem, 5)).toEqual([]);
  });
});
