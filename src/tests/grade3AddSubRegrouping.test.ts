/**
 * Tests for the four Grade 3 addition/subtraction regrouping skills:
 *   g3-add-2digit-regrouping, g3-add-3digit-regrouping,
 *   g3-sub-2digit-regrouping, g3-sub-3digit-regrouping
 */

import { describe, it, expect } from 'vitest';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import { planToday } from '../features/mastery/todayPlanEngine';
import { GRADE3_MASTERY_MAP } from '../features/mastery/grade3MasteryMap';
import type { StudentSkillSummary } from '../features/mastery/skillMasteryEngine';

const ADD_SUB_SKILLS = [
  'g3-add-2digit-regrouping',
  'g3-add-3digit-regrouping',
  'g3-sub-2digit-regrouping',
  'g3-sub-3digit-regrouping',
] as const;

// ── 1. Non-empty specificItemIds ──────────────────────────────────────────────

describe('add/sub regrouping skills: non-empty specificItemIds', () => {
  for (const skillId of ADD_SUB_SKILLS) {
    it(`${skillId} has non-empty specificItemIds`, () => {
      const cfg = planPracticeForSkill(skillId);
      expect(cfg.specificItemIds).toBeDefined();
      expect(cfg.specificItemIds!.length).toBeGreaterThan(0);
    });
  }
});

// ── 2. All item IDs reconstruct ───────────────────────────────────────────────

describe('add/sub regrouping skills: every item ID reconstructs', () => {
  for (const skillId of ADD_SUB_SKILLS) {
    it(`${skillId}: all specificItemIds reconstruct to non-null items`, () => {
      const cfg = planPracticeForSkill(skillId);
      for (const id of cfg.specificItemIds ?? []) {
        expect(makeItemFromId(id), `"${id}" should reconstruct`).not.toBeNull();
      }
    });
  }
});

// ── 3. All items have finite answers ─────────────────────────────────────────

describe('add/sub regrouping skills: every item has a finite answer', () => {
  for (const skillId of ADD_SUB_SKILLS) {
    it(`${skillId}: no NaN or Infinity answers`, () => {
      const cfg = planPracticeForSkill(skillId);
      for (const id of cfg.specificItemIds ?? []) {
        const item = makeItemFromId(id);
        expect(item).not.toBeNull();
        if (typeof item!.answer === 'number') {
          expect(Number.isFinite(item!.answer), `"${id}" answer should be finite`).toBe(true);
        }
      }
    });
  }
});

// ── 4. Every item infers back to the correct skill ───────────────────────────

describe('add/sub regrouping skills: every item infers back to its own skill', () => {
  for (const skillId of ADD_SUB_SKILLS) {
    it(`${skillId}: all items infer to ${skillId}`, () => {
      const cfg = planPracticeForSkill(skillId);
      for (const id of cfg.specificItemIds ?? []) {
        const item = makeItemFromId(id);
        expect(item, `"${id}" should reconstruct`).not.toBeNull();
        expect(
          inferGrade3SkillId(item!),
          `"${id}" should infer to ${skillId}`,
        ).toBe(skillId);
      }
    });
  }
});

// ── 5. 2-digit addition: all items require carrying ──────────────────────────

describe('g3-add-2digit-regrouping: all items require carrying', () => {
  it('all ADD items have ones digits summing to >= 10', () => {
    const cfg = planPracticeForSkill('g3-add-2digit-regrouping');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      const a = item!.factA ?? 0;
      const b = item!.factB ?? 0;
      expect(
        (a % 10) + (b % 10) >= 10,
        `"${id}": ${a}%10=${a%10} + ${b}%10=${b%10} should be >= 10`,
      ).toBe(true);
    }
  });
});

// ── 6. 3-digit addition: all items require at least one carry ─────────────────

describe('g3-add-3digit-regrouping: all items require at least one carry', () => {
  it('all ADD items have at least one column carry', () => {
    const cfg = planPracticeForSkill('g3-add-3digit-regrouping');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      const a = item!.factA ?? 0;
      const b = item!.factB ?? 0;
      const onesCarry = (a % 10) + (b % 10) >= 10;
      const tensCarry = Math.floor(a / 10) % 10 + Math.floor(b / 10) % 10 >= 10;
      expect(
        onesCarry || tensCarry,
        `"${id}" (${a}+${b}) should require at least one carry`,
      ).toBe(true);
    }
  });
});

// ── 7. 2-digit subtraction: all items require borrowing, answers >= 0 ────────

describe('g3-sub-2digit-regrouping: all items require borrowing and have non-negative answers', () => {
  it('all SUB items have ones of minuend < ones of subtrahend', () => {
    const cfg = planPracticeForSkill('g3-sub-2digit-regrouping');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      const hi = item!.factA ?? 0; // minuend
      const lo = item!.factB ?? 0; // subtrahend
      expect(
        (hi % 10) < (lo % 10),
        `"${id}": ones of ${hi} (${hi%10}) should be < ones of ${lo} (${lo%10})`,
      ).toBe(true);
    }
  });

  it('all SUB item answers are non-negative', () => {
    const cfg = planPracticeForSkill('g3-sub-2digit-regrouping');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      expect(typeof item!.answer === 'number' && item!.answer >= 0, `"${id}" answer should be >= 0`).toBe(true);
    }
  });
});

// ── 8. 3-digit subtraction: all items require borrowing, answers >= 0 ────────

describe('g3-sub-3digit-regrouping: all items require borrowing and have non-negative answers', () => {
  it('all SUB items have at least one column borrow', () => {
    const cfg = planPracticeForSkill('g3-sub-3digit-regrouping');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      const hi = item!.factA ?? 0;
      const lo = item!.factB ?? 0;
      const onesBorrow = (hi % 10) < (lo % 10);
      const tensBorrow = Math.floor(hi / 10) % 10 < Math.floor(lo / 10) % 10;
      expect(
        onesBorrow || tensBorrow,
        `"${id}" (${hi}-${lo}) should require at least one borrow`,
      ).toBe(true);
    }
  });

  it('all SUB item answers are non-negative', () => {
    const cfg = planPracticeForSkill('g3-sub-3digit-regrouping');
    for (const id of cfg.specificItemIds ?? []) {
      const item = makeItemFromId(id);
      expect(item).not.toBeNull();
      expect(typeof item!.answer === 'number' && item!.answer >= 0, `"${id}" answer should be >= 0`).toBe(true);
    }
  });
});

// ── 9. planToday() can suggest these skills ───────────────────────────────────

describe('planToday: can suggest add/sub regrouping skills when available', () => {
  it('planToday with g3-add-2digit-regrouping needs_practice returns it as focus', () => {
    const summaries: StudentSkillSummary[] = GRADE3_MASTERY_MAP.map(node => ({
      skillId: node.id,
      studentId: 'test',
      status: node.id === 'g3-add-2digit-regrouping' ? 'needs_practice' as const : 'mastered' as const,
      attemptCount: node.id === 'g3-add-2digit-regrouping' ? 5 : 10,
      correctCount: node.id === 'g3-add-2digit-regrouping' ? 2 : 10,
      accuracy: node.id === 'g3-add-2digit-regrouping' ? 0.4 : 1.0,
      dueItemCount: 0,
      itemCount: 5,
      mistakePatterns: [],
    }));

    const plan = planToday({
      studentId: 'test',
      skillSummaries: summaries,
      itemStates: [],
      now: new Date('2026-01-01T10:00:00Z'),
    });

    expect(plan.focusSkillId).toBe('g3-add-2digit-regrouping');
    expect(plan.focus).not.toBeNull();
    expect(plan.focus?.specificItemIds?.length).toBeGreaterThan(0);
    expect(plan.focus?.specificItemIds?.every(id => id.startsWith('ADD_'))).toBe(true);
  });

  it('planToday with g3-sub-3digit-regrouping needs_practice returns it as focus', () => {
    const summaries: StudentSkillSummary[] = GRADE3_MASTERY_MAP.map(node => ({
      skillId: node.id,
      studentId: 'test',
      status: node.id === 'g3-sub-3digit-regrouping' ? 'needs_practice' as const : 'mastered' as const,
      attemptCount: node.id === 'g3-sub-3digit-regrouping' ? 5 : 10,
      correctCount: node.id === 'g3-sub-3digit-regrouping' ? 2 : 10,
      accuracy: node.id === 'g3-sub-3digit-regrouping' ? 0.4 : 1.0,
      dueItemCount: 0,
      itemCount: 5,
      mistakePatterns: [],
    }));

    const plan = planToday({
      studentId: 'test',
      skillSummaries: summaries,
      itemStates: [],
      now: new Date('2026-01-01T10:00:00Z'),
    });

    expect(plan.focusSkillId).toBe('g3-sub-3digit-regrouping');
    expect(plan.focus?.specificItemIds?.every(id => id.startsWith('SUB_'))).toBe(true);
  });
});

// ── 10. Existing "null" tests for small add/sub items stay null ───────────────

describe('inferGrade3SkillId: small add/sub items (no regrouping) still return null', () => {
  it('ADD_3p4 (single digit, no regrouping) → null', () => {
    const item = makeItemFromId('ADD_3p4');
    expect(item).not.toBeNull();
    expect(inferGrade3SkillId(item!)).toBeNull();
  });

  it('SUB_9m4 (single digit) → null', () => {
    const item = makeItemFromId('SUB_9m4');
    expect(item).not.toBeNull();
    expect(inferGrade3SkillId(item!)).toBeNull();
  });

  it('ADD_12p13 (2-digit, no carry: 2+3=5) → null', () => {
    const item = makeItemFromId('ADD_12p13');
    expect(item).not.toBeNull();
    expect(inferGrade3SkillId(item!)).toBeNull();
  });

  it('SUB_25m12 (2-digit, no borrow: 5>=2) → null', () => {
    const item = makeItemFromId('SUB_25m12');
    expect(item).not.toBeNull();
    expect(inferGrade3SkillId(item!)).toBeNull();
  });
});
