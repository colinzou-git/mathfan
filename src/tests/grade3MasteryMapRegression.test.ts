/**
 * Grade 3 mastery map regression suite.
 *
 * Requirements from Phase 22:
 * 1. Every GRADE3_MASTERY_MAP skill has targeted specificItemIds.
 * 2. Every targeted specificItemId reconstructs via makeItemFromId().
 * 3. Every targeted item has a finite answer.
 * 4. For each clean skill, inferGrade3SkillId(item) returns the correct skill ID.
 * 5. planToday() for a brand-new student returns a useful first focus skill.
 * 6. Diagnostic answers use shared answer checking.
 * 7. Diagnostic division items credit to division skills.
 * 8. Completing practice launched from mastery map returns to mastery map
 *    (App-level logic test via practiceReturn semantics).
 */

import { describe, it, expect } from 'vitest';
import { GRADE3_MASTERY_MAP } from '../features/mastery/grade3MasteryMap';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import { planToday } from '../features/mastery/todayPlanEngine';
import { buildDiagnosticPlan, diagnosticItemSkillId } from '../features/diagnosis/diagnosticPlanner';
import { checkAnswer } from '../features/practice/answerChecker';
import { resolvePracticeDoneDestination } from '../features/practice/practiceNavigation';
import type { StudentSkillSummary } from '../features/mastery/skillMasteryEngine';

// ── Test helpers ─────────────────────────────────────────────────────────────

function allNewSummaries(studentId = 'test'): StudentSkillSummary[] {
  return GRADE3_MASTERY_MAP.map(node => ({
    skillId: node.id,
    studentId,
    status: 'new' as const,
    attemptCount: 0,
    correctCount: 0,
    accuracy: 0,
    dueItemCount: 0,
    itemCount: 0,
    mistakePatterns: [],
  }));
}

// ── 1. Every skill has specificItemIds ────────────────────────────────────────

describe('regression: every GRADE3_MASTERY_MAP skill has specificItemIds', () => {
  for (const node of GRADE3_MASTERY_MAP) {
    it(`${node.id} → specificItemIds is non-empty`, () => {
      const cfg = planPracticeForSkill(node.id);
      expect(
        cfg.specificItemIds && cfg.specificItemIds.length > 0,
        `${node.id} should have specificItemIds, got mode="${cfg.mode}"`,
      ).toBe(true);
    });
  }
});

// ── 2. Every specificItemId reconstructs ─────────────────────────────────────

describe('regression: every specificItemId reconstructs via makeItemFromId()', () => {
  it('all skills: all specificItemIds reconstruct to non-null items', () => {
    for (const node of GRADE3_MASTERY_MAP) {
      const cfg = planPracticeForSkill(node.id);
      const ids = cfg.specificItemIds;
      expect(ids?.length, `${node.id} should have focused item ids`).toBeGreaterThan(0);
      for (const id of ids ?? []) {
        const item = makeItemFromId(id);
        expect(item, `${node.id} → "${id}" should reconstruct`).not.toBeNull();
      }
    }
  });
});

// ── 3. Every item has a finite answer ─────────────────────────────────────────

describe('regression: every targeted item has a finite numeric answer', () => {
  it('no NaN or Infinity answers in any skill', () => {
    for (const node of GRADE3_MASTERY_MAP) {
      const cfg = planPracticeForSkill(node.id);
      const ids = cfg.specificItemIds;
      expect(ids?.length, `${node.id} should have focused item ids`).toBeGreaterThan(0);
      for (const id of ids ?? []) {
        const item = makeItemFromId(id);
        expect(item, `${node.id} should reconstruct "${id}"`).not.toBeNull();
        if (typeof item!.answer === 'number') {
          expect(
            Number.isFinite(item!.answer),
            `${node.id} -> "${id}" should have a finite answer`,
          ).toBe(true);
        }
      }
    }
  });
});

// ── 4. Clean-mapped skills infer back correctly ───────────────────────────────

describe('regression: focused mastery-map practice credits the selected skill', () => {
  it('every GRADE3_MASTERY_MAP item reconstructs and infers to its own skill', () => {
    for (const node of GRADE3_MASTERY_MAP) {
      const cfg = planPracticeForSkill(node.id);
      expect(cfg.specificItemIds?.length, `${node.id} should have focused item ids`).toBeGreaterThan(0);
      for (const id of cfg.specificItemIds ?? []) {
        const item = makeItemFromId(id);
        expect(item, `${node.id} -> "${id}" should reconstruct`).not.toBeNull();
        expect(
          inferGrade3SkillId(item!),
          `"${id}" should credit to ${node.id}`,
        ).toBe(node.id);
      }
    }
  });

  it('g3-mul-tables-basic has no item that infers to g3-mul-tables-advanced', () => {
    const cfg = planPracticeForSkill('g3-mul-tables-basic');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item, `"${id}" should reconstruct`).not.toBeNull();
      expect(inferGrade3SkillId(item!)).toBe('g3-mul-tables-basic');
    }
  });

  it('division focused practice contains no UNK_ items', () => {
    for (const skillId of ['g3-div-within-100', 'g3-div-mul-relationship']) {
      const cfg = planPracticeForSkill(skillId);
      expect(cfg.specificItemIds?.some(id => id.startsWith('UNK_'))).toBe(false);
    }
  });

  it('Grade 3 multiplication focused items do not include 11, 12, or 13 facts', () => {
    for (const skillId of ['g3-mul-tables-basic', 'g3-mul-tables-advanced']) {
      const cfg = planPracticeForSkill(skillId);
      for (const id of cfg.specificItemIds ?? []) {
        const match = id.match(/^MUL_(\d+)x(\d+)$/);
        expect(match, `${skillId} -> "${id}" should be a multiplication fact`).not.toBeNull();
        const factors = [Number(match![1]), Number(match![2])];
        expect(factors).not.toContain(11);
        expect(factors).not.toContain(12);
        expect(factors).not.toContain(13);
      }
    }
  });
});

// ── 5. planToday() for brand-new student returns a useful focus skill ─────────

describe('regression: planToday() for brand-new student', () => {
  it('returns a non-null focusSkillId', () => {
    const plan = planToday({
      studentId: 'new',
      skillSummaries: allNewSummaries('new'),
      itemStates: [],
      now: new Date(),
    });
    expect(plan.focusSkillId).not.toBeNull();
    expect(plan.focus).not.toBeNull();
  });

  it('focus skill has no prerequisites (ranked first by the soft tiebreaker for new students)', () => {
    const plan = planToday({
      studentId: 'new',
      skillSummaries: allNewSummaries('new'),
      itemStates: [],
      now: new Date(),
    });
    const node = GRADE3_MASTERY_MAP.find(n => n.id === plan.focusSkillId);
    expect(node).toBeDefined();
    expect(node!.prerequisites.length).toBe(0);
  });

  it('focus config has specificItemIds', () => {
    const plan = planToday({
      studentId: 'new',
      skillSummaries: allNewSummaries('new'),
      itemStates: [],
      now: new Date(),
    });
    expect(plan.focus?.specificItemIds?.length).toBeGreaterThan(0);
  });
});

// ── 7. Diagnostic division items credit to division skills ────────────────────

describe('regression: diagnostic answer checking and division credit', () => {
  it('diagnostic uses checkAnswer() — handles leading zero "08" == 8', () => {
    const plan = buildDiagnosticPlan('reg-test');
    const item = plan.items.find(i => i.answer === 8);
    expect(item).toBeDefined();
    const r = checkAnswer(item!, '08', 500);
    expect(r.isCorrect).toBe(true);
  });

  it('diagnostic uses checkAnswer() — rejects wrong numeric answer', () => {
    const plan = buildDiagnosticPlan('reg-test');
    const numericItem = plan.items.find(i => typeof i.answer === 'number');
    expect(numericItem).toBeDefined();
    const r = checkAnswer(numericItem!, '999', 500);
    expect(r.isCorrect).toBe(false);
  });

  it('division_fact diagnostic items credit to division skills (not multiplication)', () => {
    const plan = buildDiagnosticPlan('reg-test');
    for (const item of plan.items) {
      if (item.itemType === 'division_fact') {
        const skillId = diagnosticItemSkillId(item);
        expect(skillId, `item "${item.id}" should credit to a division skill`).toMatch(/^g3-div-/);
      }
    }
  });

  it('no unknown_factor items in diagnostic plan', () => {
    const plan = buildDiagnosticPlan('reg-test');
    const unkItems = plan.items.filter(i => i.itemType === 'unknown_factor');
    expect(unkItems).toHaveLength(0);
  });
});

// ── 8. practiceReturn semantics: mastery-map launched practice returns to map ──

describe('regression: practice launched from mastery map returns to mastery map', () => {
  it('practiceReturn mastery-map resolves to mastery-map', () => {
    expect(resolvePracticeDoneDestination('mastery-map')).toBe('mastery-map');
  });

  it('practiceReturn dashboard falls back to dashboard', () => {
    expect(resolvePracticeDoneDestination('dashboard')).toBe('dashboard');
  });

  it('practiceReturn stats returns to stats', () => {
    expect(resolvePracticeDoneDestination('stats')).toBe('stats');
  });

  it('practiceReturn quiz falls back to dashboard', () => {
    expect(resolvePracticeDoneDestination('quiz')).toBe('dashboard');
  });
});
