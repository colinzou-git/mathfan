/**
 * Tests for the deterministic hint engine.
 *
 * Key invariants:
 *  1. No hint returned for 0 wrong attempts.
 *  2. Hints on attempt 1 and 2 must NOT contain the numeric answer.
 *  3. Hint text is non-empty for all covered item types.
 *  4. Show-explanation button is only offered at attempt >= 4 when item has an explanation.
 */

import { describe, it, expect } from 'vitest';
import { getHint } from '../features/practice/hintEngine';
import { makeMultiplicationItem, ITEM_MAP } from '../features/curriculum/multiplicationItems';
import { makeDivisionItem } from '../features/curriculum/arithmeticItems';
import { makeAdditionItem, makeSubtractionItem } from '../features/curriculum/arithmeticItems';
import { makeWordProblem } from '../features/curriculum/wordProblemItems';
import { makeFractionEquivalentItem, makeFractionCompareItem, makeFractionNumberLineItem } from '../features/curriculum/fractionItems';
import { makeAreaUnitSquaresItem, makeAreaRectangleItem, makePerimeterRectangleItem } from '../features/curriculum/areaItems';

// ── Helper ────────────────────────────────────────────────────────────────────

function answerStr(answer: string | number): string {
  return String(answer);
}

// ── getHint(item, 0) — no hint before any wrong answer ───────────────────────

describe('getHint — attempt 0', () => {
  it('returns null before any wrong answer', () => {
    const item = makeMultiplicationItem(3, 4);
    expect(getHint(item, 0)).toBeNull();
  });
});

// ── multiplication_fact ───────────────────────────────────────────────────────

describe('getHint — multiplication_fact', () => {
  it('attempt 1: non-null, does not contain the answer', () => {
    const item = makeMultiplicationItem(3, 4); // answer 12
    const h = getHint(item, 1)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain(answerStr(item.answer));
    expect(h.showExplanationButton).toBe(false);
  });

  it('attempt 2: non-null, does not contain the answer', () => {
    const item = makeMultiplicationItem(3, 4); // answer 12
    const h = getHint(item, 2)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain(answerStr(item.answer));
  });

  it('attempt 3: non-null, does not contain the answer', () => {
    const item = makeMultiplicationItem(6, 7); // answer 42
    const h = getHint(item, 3)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain(answerStr(item.answer));
  });

  it('attempt 4+: offers explanation button only when item has explanation', () => {
    const item = makeMultiplicationItem(3, 4);
    const h4 = getHint(item, 4)!;
    expect(h4).not.toBeNull();
    expect(h4.showExplanationButton).toBe(!!item.explanation);
  });

  it('no answer leakage for 5×6=30 at attempt 1', () => {
    const item = makeMultiplicationItem(5, 6);
    expect(getHint(item, 1)!.text).not.toContain('30');
  });

  it('no answer leakage for 9×8=72 at attempt 2', () => {
    const item = makeMultiplicationItem(9, 8);
    expect(getHint(item, 2)!.text).not.toContain('72');
  });
});

// ── division_fact ─────────────────────────────────────────────────────────────

describe('getHint — division_fact', () => {
  it('attempt 1: non-null, does not contain the answer', () => {
    const item = makeDivisionItem(12, 4); // answer 3
    const h = getHint(item, 1)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain(answerStr(item.answer));
  });

  it('attempt 2: non-null, does not contain the answer', () => {
    const item = makeDivisionItem(20, 5); // answer 4
    const h = getHint(item, 2)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain(answerStr(item.answer));
  });
});

// ── addition_fact ─────────────────────────────────────────────────────────────

describe('getHint — addition_fact', () => {
  it('attempt 1: non-null, no answer', () => {
    const item = makeAdditionItem(47, 28); // answer 75
    const h = getHint(item, 1)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain('75');
  });

  it('attempt 2: non-null, no answer', () => {
    const item = makeAdditionItem(47, 28); // answer 75
    expect(getHint(item, 2)!.text).not.toContain('75');
  });
});

// ── subtraction_fact ──────────────────────────────────────────────────────────

describe('getHint — subtraction_fact', () => {
  it('attempt 1: non-null, no answer', () => {
    const item = makeSubtractionItem(52, 28); // answer 24
    const h = getHint(item, 1)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain('24');
  });

  it('attempt 2: non-null, no answer', () => {
    const item = makeSubtractionItem(71, 46); // answer 25
    expect(getHint(item, 2)!.text).not.toContain('25');
  });
});

// ── word_problem ──────────────────────────────────────────────────────────────

describe('getHint — word_problem', () => {
  it('attempt 1 and 2: non-null, non-empty text', () => {
    const item = makeWordProblem('eg', 3, 4); // answer 12
    expect(getHint(item, 1)!.text.length).toBeGreaterThan(0);
    expect(getHint(item, 2)!.text.length).toBeGreaterThan(0);
  });

  it('attempt 1: does not contain the answer', () => {
    const item = makeWordProblem('eg', 3, 4); // answer 12
    expect(getHint(item, 1)!.text).not.toContain('12');
  });
});

// ── fraction_equivalent ───────────────────────────────────────────────────────

describe('getHint — fraction_equivalent', () => {
  it('attempt 1 and 2: non-null, non-empty text', () => {
    const item = makeFractionEquivalentItem(1, 2, 2); // 1/2 = 2/4, answer 2
    expect(getHint(item, 1)!.text.length).toBeGreaterThan(0);
    expect(getHint(item, 2)!.text.length).toBeGreaterThan(0);
  });

  it('attempt 1: does not contain the answer', () => {
    const item = makeFractionEquivalentItem(1, 3, 2); // answer 2
    expect(getHint(item, 1)!.text).not.toContain(answerStr(item.answer));
  });
});

// ── fraction_compare ──────────────────────────────────────────────────────────

describe('getHint — fraction_compare', () => {
  it('attempt 1 and 2: non-null, non-empty text', () => {
    const item = makeFractionCompareItem(1, 4, 3, 4);
    expect(getHint(item, 1)!.text.length).toBeGreaterThan(0);
    expect(getHint(item, 2)!.text.length).toBeGreaterThan(0);
  });
});

// ── fraction_number_line ──────────────────────────────────────────────────────

describe('getHint — fraction_number_line', () => {
  it('attempt 1: mentions the denominator', () => {
    const item = makeFractionNumberLineItem(3, 4);
    const text = getHint(item, 1)!.text;
    expect(text).toContain('4');
  });

  it('attempt 1: does not contain the answer fraction', () => {
    const item = makeFractionNumberLineItem(3, 4); // answer position 3 out of 4
    const text = getHint(item, 1)!.text;
    // The answer (3/4 position) should not be revealed by showing "3"
    // — hint only mentions denominator (4) and general guidance
    expect(text).not.toMatch(/\b3\b/);
  });
});

// ── area_unit_squares ─────────────────────────────────────────────────────────

describe('getHint — area_unit_squares', () => {
  it('attempt 1: non-null, no answer', () => {
    const item = makeAreaUnitSquaresItem(3, 4); // answer 12
    const h = getHint(item, 1)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain('12');
  });

  it('attempt 2: non-null, no answer', () => {
    const item = makeAreaUnitSquaresItem(3, 4);
    expect(getHint(item, 2)!.text).not.toContain('12');
  });
});

// ── area_rectangle ────────────────────────────────────────────────────────────

describe('getHint — area_rectangle', () => {
  it('attempt 1: non-null, no answer', () => {
    const item = makeAreaRectangleItem(5, 6); // answer 30
    const h = getHint(item, 1)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain('30');
  });

  it('attempt 2: non-null, no answer', () => {
    const item = makeAreaRectangleItem(5, 6);
    expect(getHint(item, 2)!.text).not.toContain('30');
  });
});

// ── perimeter_rectangle ───────────────────────────────────────────────────────

describe('getHint — perimeter_rectangle', () => {
  it('attempt 1: non-null, no final answer', () => {
    const item = makePerimeterRectangleItem(3, 5); // answer 16
    const h = getHint(item, 1)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain('16');
  });

  it('attempt 2: non-null, no final answer', () => {
    const item = makePerimeterRectangleItem(3, 5);
    expect(getHint(item, 2)!.text).not.toContain('16');
  });

  it('attempt 3: shows setup sums but not final answer', () => {
    const item = makePerimeterRectangleItem(3, 5); // sums: 3+3=6, 5+5=10, answer=16
    const text = getHint(item, 3)!.text;
    // Shows intermediate sums (6 and 10) but NOT the answer 16
    expect(text).not.toContain('16');
  });
});

// ── Show explanation button ────────────────────────────────────────────────────

describe('getHint — showExplanationButton', () => {
  it('is false on attempts 1–3', () => {
    const item = makeMultiplicationItem(3, 4);
    for (let i = 1; i <= 3; i++) {
      expect(getHint(item, i)!.showExplanationButton).toBe(false);
    }
  });

  it('is true at attempt 4 when item has explanation', () => {
    const item = makeAreaRectangleItem(3, 4);
    // area_rectangle items may not have explanation — check dynamically
    const h4 = getHint(item, 4)!;
    expect(h4.showExplanationButton).toBe(!!item.explanation);
  });
});

// ── unknown_factor — no answer leakage ───────────────────────────────────────

describe('getHint — unknown_factor answer leakage', () => {
  // UNK_72k8: 8 × ? = 72, answer = 9 (non-perfect-square)
  const unkItem = ITEM_MAP.get('UNK_72k8')!;

  it('attempt 1: non-null and does not contain the answer', () => {
    const h = getHint(unkItem, 1)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain(String(unkItem.answer));
  });

  it('attempt 2: non-null and does not contain the answer', () => {
    const h = getHint(unkItem, 2)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain(String(unkItem.answer));
  });

  it('attempt 3: non-null and does not contain the answer', () => {
    const h = getHint(unkItem, 3)!;
    expect(h).not.toBeNull();
    expect(h.text).not.toContain(String(unkItem.answer));
  });

  // UNK_9k3: 3×?=9, answer=3 — perfect-square where product "9" doesn't contain "3"
  it('perfect-square UNK_9k3 (answer=3): attempt 1 does not contain answer', () => {
    const sq = ITEM_MAP.get('UNK_9k3')!;
    expect(sq).toBeDefined();
    expect(getHint(sq, 1)!.text).not.toContain(String(sq.answer));
  });

  it('perfect-square UNK_9k3 (answer=3): attempt 3 does not contain answer', () => {
    const sq = ITEM_MAP.get('UNK_9k3')!;
    expect(getHint(sq, 3)!.text).not.toContain(String(sq.answer));
  });
});

// ── multiplication_fact ×1 attempt 3 — no answer leakage ─────────────────────

describe('getHint — multiplication_fact x1 attempt 3', () => {
  it('7×1: attempt 3 does not contain "7"', () => {
    const item = makeMultiplicationItem(7, 1); // answer = 7
    expect(getHint(item, 3)!.text).not.toContain('7');
  });

  it('1×8: attempt 3 does not contain "8"', () => {
    const item = makeMultiplicationItem(1, 8); // answer = 8
    expect(getHint(item, 3)!.text).not.toContain('8');
  });

  it('1×1: attempt 3 hint uses word "one" not digit "1"', () => {
    const item = makeMultiplicationItem(1, 1); // answer = 1
    expect(getHint(item, 3)!.text).not.toContain('1');
  });
});

// ── Escalation smoke test — all rungs return non-null for covered types ────────

describe('getHint — all 4 rungs non-null for every covered item type', () => {
  const samples = [
    makeMultiplicationItem(3, 4),
    makeDivisionItem(12, 3),
    makeAdditionItem(15, 8),
    makeSubtractionItem(22, 7),
    makeWordProblem('eg', 2, 5),
    makeFractionEquivalentItem(1, 2, 2),
    makeFractionCompareItem(1, 4, 3, 4),
    makeFractionNumberLineItem(2, 3),
    makeAreaUnitSquaresItem(3, 4),
    makeAreaRectangleItem(4, 5),
    makePerimeterRectangleItem(3, 5),
  ];

  for (let attempt = 1; attempt <= 4; attempt++) {
    it(`attempt ${attempt}: returns non-null for all sample items`, () => {
      for (const item of samples) {
        expect(
          getHint(item, attempt),
          `${item.itemType} attempt ${attempt} should return a hint`,
        ).not.toBeNull();
      }
    });
  }
});
