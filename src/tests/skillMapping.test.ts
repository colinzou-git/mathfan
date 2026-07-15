import { describe, it, expect } from 'vitest';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import { isGrade3SkillId } from '../features/mastery/grade3MasteryMap';
import { makeMultiplicationItem } from '../features/curriculum/multiplicationItems';
import { makeWordProblem } from '../features/curriculum/wordProblemItems';
import { makeFractionEquivalentItem, makeFractionCompareItem } from '../features/curriculum/fractionItems';
import type { PracticeItem } from '../types/math';

// Minimal division item — factB is the divisor, matching multiplicationItems generator convention
function makeDivFact(product: number, divisor: number): PracticeItem {
  return {
    id: `DIV_${product}d${divisor}`,
    skillId: 'SKILL_DIV_FACTS',
    itemType: 'division_fact',
    prompt: `${product} ÷ ${divisor}`,
    answer: product / divisor,
    tags: ['division', `table_${divisor}`],
    difficulty: 0.4,
    factA: product,
    factB: divisor,
  };
}

// ── Multiplication facts ──────────────────────────────────────────────────────

describe('inferGrade3SkillId — multiplication facts', () => {
  describe('easy tables (0, 1, 2, 5) → g3-mul-tables-basic', () => {
    it('0 × 3', () => expect(inferGrade3SkillId(makeMultiplicationItem(0, 3))).toBe('g3-mul-tables-basic'));
    it('1 × 4', () => expect(inferGrade3SkillId(makeMultiplicationItem(1, 4))).toBe('g3-mul-tables-basic'));
    it('2 × 3', () => expect(inferGrade3SkillId(makeMultiplicationItem(2, 3))).toBe('g3-mul-tables-basic'));
    it('5 × 4', () => expect(inferGrade3SkillId(makeMultiplicationItem(5, 4))).toBe('g3-mul-tables-basic'));
    it('3 × 5 (both operands ≤ 5)', () => expect(inferGrade3SkillId(makeMultiplicationItem(3, 5))).toBe('g3-mul-tables-basic'));
  });

  // 10 is pedagogically easy but falls in the Grade 3 "times tables 6-10" skill
  describe('table 10 → g3-mul-tables-advanced (10 is in the 6–10 advanced skill)', () => {
    it('10 × 3', () => expect(inferGrade3SkillId(makeMultiplicationItem(10, 3))).toBe('g3-mul-tables-advanced'));
    it('2 × 10', () => expect(inferGrade3SkillId(makeMultiplicationItem(2, 10))).toBe('g3-mul-tables-advanced'));
  });

  describe('hard tables (6, 7, 8, 9) → g3-mul-tables-advanced', () => {
    it('6 × 7', () => expect(inferGrade3SkillId(makeMultiplicationItem(6, 7))).toBe('g3-mul-tables-advanced'));
    it('7 × 8', () => expect(inferGrade3SkillId(makeMultiplicationItem(7, 8))).toBe('g3-mul-tables-advanced'));
    it('8 × 9', () => expect(inferGrade3SkillId(makeMultiplicationItem(8, 9))).toBe('g3-mul-tables-advanced'));
    it('9 × 3', () => expect(inferGrade3SkillId(makeMultiplicationItem(9, 3))).toBe('g3-mul-tables-advanced'));
  });

  describe('unknown_factor items follow the same table logic', () => {
    it('3 × ? = 15 (table 5) → g3-mul-tables-basic', () => {
      const item: PracticeItem = {
        id: 'UNK_15k3',
        skillId: 'SKILL_MUL',
        itemType: 'unknown_factor',
        prompt: '3 × ? = 15',
        answer: 5,
        tags: ['unknown_factor', 'table_3'],
        difficulty: 0.3,
        factA: 3,
        factB: 5,
      };
      expect(inferGrade3SkillId(item)).toBe('g3-mul-tables-basic');
    });

    it('6 × ? = 48 (table 8) → g3-mul-tables-advanced', () => {
      const item: PracticeItem = {
        id: 'UNK_48k6',
        skillId: 'SKILL_MUL',
        itemType: 'unknown_factor',
        prompt: '6 × ? = 48',
        answer: 8,
        tags: ['unknown_factor', 'table_6'],
        difficulty: 0.6,
        factA: 6,
        factB: 8,
      };
      expect(inferGrade3SkillId(item)).toBe('g3-mul-tables-advanced');
    });
  });
});

// ── Division facts ────────────────────────────────────────────────────────────

describe('inferGrade3SkillId — division facts', () => {
  it('divisor 2 → g3-div-within-100', () => expect(inferGrade3SkillId(makeDivFact(12, 2))).toBe('g3-div-within-100'));
  it('divisor 3 → g3-div-within-100', () => expect(inferGrade3SkillId(makeDivFact(15, 3))).toBe('g3-div-within-100'));
  it('divisor 5 → g3-div-within-100', () => expect(inferGrade3SkillId(makeDivFact(20, 5))).toBe('g3-div-within-100'));
  it('divisor 6 → g3-div-mul-relationship', () => expect(inferGrade3SkillId(makeDivFact(42, 6))).toBe('g3-div-mul-relationship'));
  it('divisor 7 → g3-div-mul-relationship', () => expect(inferGrade3SkillId(makeDivFact(56, 7))).toBe('g3-div-mul-relationship'));
  it('divisor 9 → g3-div-mul-relationship', () => expect(inferGrade3SkillId(makeDivFact(81, 9))).toBe('g3-div-mul-relationship'));
  it('divisor 10 → g3-div-mul-relationship', () => expect(inferGrade3SkillId(makeDivFact(80, 10))).toBe('g3-div-mul-relationship'));
});

// ── Word problem schemas ──────────────────────────────────────────────────────

describe('inferGrade3SkillId — word problems', () => {
  it('schema eg (equal groups) → g3-mul-meaning', () =>
    expect(inferGrade3SkillId(makeWordProblem('eg', 3, 4))).toBe('g3-mul-meaning'));

  it('schema ar (array) → g3-mul-meaning', () =>
    expect(inferGrade3SkillId(makeWordProblem('ar', 2, 5))).toBe('g3-mul-meaning'));

  it('schema cmp (comparison) → g3-mul-meaning', () =>
    expect(inferGrade3SkillId(makeWordProblem('cmp', 3, 4))).toBe('g3-mul-meaning'));

  it('schema dv (division) → g3-div-meaning', () =>
    expect(inferGrade3SkillId(makeWordProblem('dv', 4, 3))).toBe('g3-div-meaning'));

  it('dv schema detected via tags when itemType is word_problem', () => {
    // Construct a dv item manually to verify tag-based detection path
    const item: PracticeItem = {
      id: 'WORD_dv_4_3',
      skillId: 'SKILL_WORD',
      itemType: 'word_problem',
      prompt: '12 apples shared into 4 bags. How many per bag?',
      answer: 3,
      tags: ['word_problem', 'dv'],
      difficulty: 0.6,
      factA: 4,
      factB: 3,
    };
    expect(inferGrade3SkillId(item)).toBe('g3-div-meaning');
  });
});

// ── Fraction items ────────────────────────────────────────────────────────────

describe('inferGrade3SkillId — fraction items', () => {
  // Unit fractions (n=1): FEQ_1_… → g3-frac-unit
  it('fraction_equivalent with n=1 (unit fraction) → g3-frac-unit', () =>
    expect(inferGrade3SkillId(makeFractionEquivalentItem(1, 2, 2))).toBe('g3-frac-unit'));

  it('fraction_equivalent with n=1 different denominator → g3-frac-unit', () =>
    expect(inferGrade3SkillId(makeFractionEquivalentItem(1, 3, 3))).toBe('g3-frac-unit'));

  // Non-unit fractions (n>1): FEQ_n_… → g3-frac-equivalent
  it('fraction_equivalent with n=2 (non-unit) → g3-frac-equivalent', () =>
    expect(inferGrade3SkillId(makeFractionEquivalentItem(2, 3, 2))).toBe('g3-frac-equivalent'));

  it('fraction_equivalent with n=3 → g3-frac-equivalent', () =>
    expect(inferGrade3SkillId(makeFractionEquivalentItem(3, 4, 2))).toBe('g3-frac-equivalent'));

  it('same-numerator comparison → its distinct skill', () =>
    expect(inferGrade3SkillId(makeFractionCompareItem(1, 2, 1, 3))).toBe('g3-frac-compare-same-numerator'));

  it('fraction_compare equal fractions', () =>
    expect(inferGrade3SkillId(makeFractionCompareItem(2, 4, 1, 2))).toBe('g3-frac-compare'));

  it('fraction_number_line → g3-frac-number-line', () => {
    const item: PracticeItem = {
      id: 'FNL_1_4',
      skillId: 'SKILL_FRACTIONS',
      itemType: 'fraction_number_line',
      prompt: 'Place 1/4 on the number line',
      answer: 0.25,
      choices: [0.25],
      tags: ['fractions', 'number_line'],
      difficulty: 0.5,
    };
    expect(inferGrade3SkillId(item)).toBe('g3-frac-number-line');
  });
});

// ── Item types outside the Grade 3 map ───────────────────────────────────────

describe('inferGrade3SkillId — unsupported item types return null', () => {
  it('addition_fact → null', () => {
    const item: PracticeItem = {
      id: 'ADD_3_4',
      skillId: 'SKILL_ADD',
      itemType: 'addition_fact',
      prompt: '3 + 4',
      answer: 7,
      tags: ['addition'],
      difficulty: 0.3,
    };
    expect(inferGrade3SkillId(item)).toBeNull();
  });

  it('subtraction_fact → null', () => {
    const item: PracticeItem = {
      id: 'SUB_9_4',
      skillId: 'SKILL_SUB',
      itemType: 'subtraction_fact',
      prompt: '9 − 4',
      answer: 5,
      tags: ['subtraction'],
      difficulty: 0.3,
    };
    expect(inferGrade3SkillId(item)).toBeNull();
  });

  it('rounding → g3-round-nearest-10-100', () => {
    const item: PracticeItem = {
      id: 'ROUND_34_10',
      skillId: 'SKILL_ROUND',
      itemType: 'rounding',
      prompt: 'Round 34 to the nearest 10',
      answer: 30,
      tags: ['rounding'],
      difficulty: 0.3,
    };
    expect(inferGrade3SkillId(item)).toBe('g3-round-nearest-10-100');
  });

  it('decimal_add → null', () => {
    const item: PracticeItem = {
      id: 'DADD_1_2_0_5',
      skillId: 'SKILL_DEC',
      itemType: 'decimal_add',
      prompt: '1.2 + 0.5',
      answer: 1.7,
      tags: ['decimals'],
      difficulty: 0.4,
    };
    expect(inferGrade3SkillId(item)).toBeNull();
  });
});

// ── Cross-validation: all non-null results are valid Grade 3 skill IDs ────────

describe('inferGrade3SkillId — all results are valid Grade 3 skill IDs', () => {
  it('every non-null result exists in GRADE3_MASTERY_MAP', () => {
    const items: PracticeItem[] = [
      makeMultiplicationItem(2, 3),
      makeMultiplicationItem(5, 5),
      makeMultiplicationItem(7, 8),
      makeMultiplicationItem(10, 6),
      makeDivFact(12, 3),
      makeDivFact(42, 7),
      makeWordProblem('eg', 3, 4),
      makeWordProblem('ar', 2, 5),
      makeWordProblem('cmp', 3, 4),
      makeWordProblem('dv', 4, 3),
      makeFractionEquivalentItem(1, 2, 2),   // n=1 → g3-frac-unit
      makeFractionEquivalentItem(2, 3, 2),   // n=2 → g3-frac-equivalent
      makeFractionCompareItem(1, 2, 1, 3),
    ];
    for (const item of items) {
      const skillId = inferGrade3SkillId(item);
      if (skillId !== null) {
        expect(isGrade3SkillId(skillId), `"${skillId}" (from item "${item.id}") should be in GRADE3_MASTERY_MAP`).toBe(true);
      }
    }
  });
});
