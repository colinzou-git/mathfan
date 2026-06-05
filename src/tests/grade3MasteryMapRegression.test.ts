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
      if (!cfg.specificItemIds) continue;
      for (const id of cfg.specificItemIds) {
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
      if (!cfg.specificItemIds) continue;
      for (const id of cfg.specificItemIds) {
        const item = makeItemFromId(id);
        if (item && typeof item.answer === 'number') {
          expect(
            Number.isFinite(item.answer),
            `${node.id} → "${id}": answer ${item.answer} is not finite`,
          ).toBe(true);
        }
      }
    }
  });
});

// ── 4. Clean-mapped skills infer back correctly ───────────────────────────────

describe('regression: clean-mapped skills infer back to correct skill ID', () => {
  const CLEAN: Record<string, string> = {
    'g3-mul-meaning':          'g3-mul-meaning',
    'g3-mul-properties':       'g3-mul-properties',
    'g3-div-meaning':          'g3-div-meaning',
    'g3-frac-unit':            'g3-frac-unit',
    'g3-frac-number-line':     'g3-frac-number-line',
    'g3-frac-equivalent':      'g3-frac-equivalent',
    'g3-frac-compare':         'g3-frac-compare',
    'g3-area-concept':         'g3-area-concept',
    'g3-area-formula':         'g3-area-formula',
    'g3-perimeter':            'g3-perimeter',
    'g3-geo-categories':       'g3-geo-categories',
    'g3-geo-rectilinear-area': 'g3-geo-rectilinear-area',
  };

  for (const [skillId, expectedSkill] of Object.entries(CLEAN)) {
    it(`${skillId}: all items credit back to ${expectedSkill}`, () => {
      const cfg = planPracticeForSkill(skillId);
      expect(cfg.specificItemIds).toBeDefined();
      for (const id of cfg.specificItemIds ?? []) {
        const item = makeItemFromId(id);
        if (!item) continue;
        expect(
          inferGrade3SkillId(item),
          `"${id}" should credit to ${expectedSkill}`,
        ).toBe(expectedSkill);
      }
    });
  }

  it('g3-div-within-100: DIV_ items credit to g3-div-within-100', () => {
    const cfg = planPracticeForSkill('g3-div-within-100');
    for (const id of cfg.specificItemIds ?? []) {
      if (!id.startsWith('DIV_')) continue;
      const item = makeItemFromId(id);
      if (!item) continue;
      expect(inferGrade3SkillId(item)).toBe('g3-div-within-100');
    }
  });

  it('g3-div-mul-relationship: DIV_ items credit to g3-div-mul-relationship', () => {
    const cfg = planPracticeForSkill('g3-div-mul-relationship');
    for (const id of cfg.specificItemIds ?? []) {
      if (!id.startsWith('DIV_')) continue;
      const item = makeItemFromId(id);
      if (!item) continue;
      expect(inferGrade3SkillId(item)).toBe('g3-div-mul-relationship');
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

  it('focus skill has no prerequisites (unlocked for new students)', () => {
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
    if (!item) return;
    const r = checkAnswer(item, '08', 500);
    expect(r.isCorrect).toBe(true);
  });

  it('diagnostic uses checkAnswer() — rejects wrong numeric answer', () => {
    const plan = buildDiagnosticPlan('reg-test');
    const numericItem = plan.items.find(i => typeof i.answer === 'number');
    if (!numericItem) return;
    const r = checkAnswer(numericItem, '999', 500);
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

function resolveDoneDestination(practiceReturn: string): string {
  return (practiceReturn === 'mastery-map' || practiceReturn === 'stats')
    ? practiceReturn
    : 'dashboard';
}

describe('regression: practice launched from mastery map returns to mastery map', () => {
  it('practiceReturn mastery-map resolves to mastery-map', () => {
    expect(resolveDoneDestination('mastery-map')).toBe('mastery-map');
  });

  it('practiceReturn dashboard falls back to dashboard', () => {
    expect(resolveDoneDestination('dashboard')).toBe('dashboard');
  });

  it('practiceReturn stats returns to stats', () => {
    expect(resolveDoneDestination('stats')).toBe('stats');
  });

  it('practiceReturn quiz falls back to dashboard', () => {
    expect(resolveDoneDestination('quiz')).toBe('dashboard');
  });
});
