import { describe, it, expect } from 'vitest';
import {
  buildDiagnosticPlan,
  diagnosticItemSkillId,
} from '../features/diagnosis/diagnosticPlanner';

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

  it('includes unknown_factor items (division as unknown factor)', () => {
    const plan = buildDiagnosticPlan('test-session-1');
    const unkItems = plan.items.filter(i => i.itemType === 'unknown_factor');
    expect(unkItems.length).toBeGreaterThan(0);
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

  it('maps unknown_factor to g3-div-mul-relationship', () => {
    const plan = buildDiagnosticPlan('sid');
    const unkItem = plan.items.find(i => i.itemType === 'unknown_factor');
    if (unkItem) {
      expect(diagnosticItemSkillId(unkItem)).toBe('g3-div-mul-relationship');
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
