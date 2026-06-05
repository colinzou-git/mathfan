import { describe, it, expect } from 'vitest';
import {
  buildDiagnosticPlan,
  diagnosticItemSkillId,
} from '../features/diagnosis/diagnosticPlanner';
import { checkAnswer } from '../features/practice/answerChecker';

describe('buildDiagnosticPlan', () => {
  it('returns between 10 and 12 items', () => {
    const plan = buildDiagnosticPlan('test-session-1');
    expect(plan.items.length).toBeGreaterThanOrEqual(10);
    expect(plan.items.length).toBeLessThanOrEqual(12);
  });

  it('includes multiplication_fact items', () => {
    const plan = buildDiagnosticPlan('test-session-1');
    const mulItems = plan.items.filter(i => i.itemType === 'multiplication_fact');
    expect(mulItems.length).toBeGreaterThan(0);
  });

  it('includes division_fact items for division diagnosis', () => {
    const plan = buildDiagnosticPlan('test-session-1');
    const divItems = plan.items.filter(i => i.itemType === 'division_fact');
    expect(divItems.length).toBeGreaterThan(0);
  });

  it('includes word_problem items', () => {
    const plan = buildDiagnosticPlan('test-session-1');
    const wordItems = plan.items.filter(i => i.itemType === 'word_problem');
    expect(wordItems.length).toBeGreaterThan(0);
  });

  it('includes equal-groups word problems (WORD_eg_ prefix)', () => {
    const plan = buildDiagnosticPlan('test-session-1');
    const egItems = plan.items.filter(i => i.id.startsWith('WORD_eg_'));
    expect(egItems.length).toBeGreaterThan(0);
  });

  it('includes array word problems (WORD_ar_ prefix)', () => {
    const plan = buildDiagnosticPlan('test-session-1');
    const arItems = plan.items.filter(i => i.id.startsWith('WORD_ar_'));
    expect(arItems.length).toBeGreaterThan(0);
  });

  it('all items have valid prompts and answers', () => {
    const plan = buildDiagnosticPlan('test-session-1');
    for (const item of plan.items) {
      expect(item.prompt.length).toBeGreaterThan(0);
      expect(item.answer).toBeDefined();
    }
  });

  it('returns the same items for the same sessionId', () => {
    const plan1 = buildDiagnosticPlan('deterministic-session');
    const plan2 = buildDiagnosticPlan('deterministic-session');
    expect(plan1.items.map(i => i.id)).toEqual(plan2.items.map(i => i.id));
  });

  it('has a non-empty description', () => {
    const plan = buildDiagnosticPlan('test-session-1');
    expect(plan.description.length).toBeGreaterThan(0);
  });

  it('description matches real division facts and does not mention unknown factors', () => {
    const plan = buildDiagnosticPlan('test-session-1');
    expect(plan.items.some(item => item.itemType === 'division_fact')).toBe(true);
    expect(plan.items.some(item => item.itemType === 'unknown_factor')).toBe(false);
    expect(plan.description).toMatch(/division facts/i);
    expect(plan.description).not.toMatch(/unknown factors?/i);
  });

  it('sessionId is stored in the plan', () => {
    const plan = buildDiagnosticPlan('my-session-id');
    expect(plan.sessionId).toBe('my-session-id');
  });
});

describe('diagnosticItemSkillId', () => {
  it('maps easy multiplication_fact to g3-mul-tables-basic', () => {
    const plan = buildDiagnosticPlan('sid');
    const easyMul = plan.items.find(
      i => i.itemType === 'multiplication_fact' &&
      Math.max(i.factA ?? 0, i.factB ?? 0) <= 5
    );
    if (easyMul) {
      expect(diagnosticItemSkillId(easyMul)).toBe('g3-mul-tables-basic');
    }
  });

  it('maps harder multiplication_fact to g3-mul-tables-advanced', () => {
    const plan = buildDiagnosticPlan('sid');
    const hardMul = plan.items.find(
      i => i.itemType === 'multiplication_fact' &&
      Math.max(i.factA ?? 0, i.factB ?? 0) > 5
    );
    if (hardMul) {
      expect(diagnosticItemSkillId(hardMul)).toBe('g3-mul-tables-advanced');
    }
  });

  it('maps division_fact with divisor ≤ 5 to g3-div-within-100', () => {
    const plan = buildDiagnosticPlan('sid');
    const divItem = plan.items.find(i => i.itemType === 'division_fact' && (i.factB ?? 0) <= 5);
    if (divItem) {
      expect(diagnosticItemSkillId(divItem)).toBe('g3-div-within-100');
    }
  });

  it('maps division_fact with divisor > 5 to g3-div-mul-relationship', () => {
    const plan = buildDiagnosticPlan('sid');
    const divItem = plan.items.find(i => i.itemType === 'division_fact' && (i.factB ?? 0) > 5);
    if (divItem) {
      expect(diagnosticItemSkillId(divItem)).toBe('g3-div-mul-relationship');
    }
  });

  it('maps equal-groups word problem to g3-mul-meaning', () => {
    const plan = buildDiagnosticPlan('sid');
    const egItem = plan.items.find(i => i.id.startsWith('WORD_eg_'));
    if (egItem) {
      expect(diagnosticItemSkillId(egItem)).toBe('g3-mul-meaning');
    }
  });

  it('maps array word problem to g3-mul-meaning', () => {
    const plan = buildDiagnosticPlan('sid');
    const arItem = plan.items.find(i => i.id.startsWith('WORD_ar_'));
    if (arItem) {
      expect(diagnosticItemSkillId(arItem)).toBe('g3-mul-meaning');
    }
  });
});

describe('diagnostic answer normalization — uses checkAnswer() not raw string equality', () => {
  it('checkAnswer accepts "8" when answer is 8', () => {
    const plan = buildDiagnosticPlan('norm-test');
    const numericItem = plan.items.find(i => i.answerInput !== 'choice' && typeof i.answer === 'number');
    if (!numericItem) return;
    const r = checkAnswer(numericItem, String(numericItem.answer), 1000);
    expect(r.isCorrect).toBe(true);
  });

  it('checkAnswer accepts "08" when answer is 8 (leading zero)', () => {
    const plan = buildDiagnosticPlan('norm-test');
    const item = plan.items.find(i => i.answer === 8);
    if (!item) return;
    const r = checkAnswer(item, '08', 1000);
    expect(r.isCorrect).toBe(true);
  });

  it('checkAnswer rejects wrong answer', () => {
    const plan = buildDiagnosticPlan('norm-test');
    const numericItem = plan.items.find(i => typeof i.answer === 'number');
    if (!numericItem) return;
    const r = checkAnswer(numericItem, '999', 1000);
    expect(r.isCorrect).toBe(false);
  });

  it('division diagnostic items credit to division skills, not multiplication', () => {
    const plan = buildDiagnosticPlan('credit-test');
    for (const item of plan.items) {
      if (item.itemType === 'division_fact') {
        const skillId = diagnosticItemSkillId(item);
        expect(skillId).toMatch(/^g3-div-/);
      }
    }
  });
});
