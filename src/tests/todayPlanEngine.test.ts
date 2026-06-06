import { describe, it, expect } from 'vitest';
import { planToday } from '../features/mastery/todayPlanEngine';
import { GRADE3_MASTERY_MAP } from '../features/mastery/grade3MasteryMap';
import type { StudentSkillSummary } from '../features/mastery/skillMasteryEngine';
import type { StudentItemState } from '../types/math';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSummary(
  skillId: string,
  status: StudentSkillSummary['status'],
  overrides: Partial<StudentSkillSummary> = {},
): StudentSkillSummary {
  return {
    skillId,
    studentId: 's1',
    status,
    attemptCount: status === 'new' ? 0 : 5,
    correctCount: status === 'needs_practice' ? 2 : 5,
    accuracy: status === 'needs_practice' ? 0.4 : status === 'new' ? 0 : 0.85,
    dueItemCount: status === 'review_due' ? 2 : 0,
    itemCount: 3,
    mistakePatterns: [],
    ...overrides,
  };
}

function makeItemState(itemId: string, nextDueAt: string | undefined): StudentItemState {
  return {
    studentId: 's1',
    itemId,
    skillId: 'g3-mul-tables-basic',
    attemptCount: 5,
    correctCount: 5,
    lastCorrect: true,
    lastLatencyMs: 1200,
    medianLatencyMs: 1000,
    ease: 2.5,
    stabilityDays: 7,
    difficulty: 0.3,
    masteryLevel: 'strong',
    mistakePatterns: [],
    nextDueAt,
  };
}

const NOW = new Date('2026-01-10T12:00:00Z');
const PAST = '2026-01-09T12:00:00Z'; // overdue
const FUTURE = '2026-01-20T12:00:00Z'; // not yet due

const BASE_ARGS = {
  studentId: 's1',
  itemStates: [],
  now: NOW,
};

// ── Priority: review_due first ─────────────────────────────────────────────────

describe('planToday — priority: review_due', () => {
  it('picks review_due skill over needs_practice', () => {
    // Use prerequisite-free skills so locking doesn't interfere with priority ordering
    const summaries = [
      makeSummary('g3-mul-meaning', 'needs_practice'),
      makeSummary('g3-frac-unit', 'review_due'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focusSkillId).toBe('g3-frac-unit');
  });

  it('picks review_due over strong and new', () => {
    const summaries = [
      makeSummary('g3-mul-tables-basic', 'strong'),
      makeSummary('g3-mul-tables-advanced', 'review_due'),
      makeSummary('g3-frac-unit', 'new'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focusSkillId).toBe('g3-mul-tables-advanced');
  });
});

// ── Priority: needs_practice ──────────────────────────────────────────────────

describe('planToday — priority: needs_practice', () => {
  it('picks needs_practice over strong when no review_due exists', () => {
    // Use prerequisite-free skills so locking doesn't interfere with priority ordering
    const summaries = [
      makeSummary('g3-area-concept', 'strong'),
      makeSummary('g3-mul-meaning', 'needs_practice'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focusSkillId).toBe('g3-mul-meaning');
  });
});

// ── Priority: strong ──────────────────────────────────────────────────────────

describe('planToday — priority: strong', () => {
  it('picks strong when no review_due or needs_practice exists', () => {
    // g3-mul-meaning has no prerequisites, so it is always unlocked
    const summaries = [
      makeSummary('g3-mul-meaning', 'strong'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focusSkillId).toBe('g3-mul-meaning');
  });
});

// ── Priority: new (prerequisites satisfied) ───────────────────────────────────

describe('planToday — priority: new with prerequisites', () => {
  it('picks new skill when no non-new skills available and prerequisites are met', () => {
    // g3-mul-tables-basic needs g3-mul-meaning (prerequisite), which is mastered
    const summaries = [
      makeSummary('g3-mul-meaning', 'mastered', { accuracy: 1, attemptCount: 10 }),
      makeSummary('g3-mul-tables-basic', 'new'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focusSkillId).toBe('g3-mul-tables-basic');
  });

  it('does not pick new skill whose prerequisites are not satisfied', () => {
    // g3-mul-tables-advanced requires g3-mul-tables-basic (strong), but basic is only needs_practice
    // g3-mul-meaning must be mastered so that g3-mul-tables-basic is unlocked
    const summaries = [
      makeSummary('g3-mul-meaning', 'mastered'),
      makeSummary('g3-mul-tables-basic', 'needs_practice'),
      makeSummary('g3-mul-tables-advanced', 'new'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    // Should focus on needs_practice basic, not the blocked new advanced skill
    expect(plan.focusSkillId).toBe('g3-mul-tables-basic');
  });

  it('skips all-mastered new skill (prerequisites not in summaries = not satisfied)', () => {
    // Only a new skill with prerequisites not in summaries at all
    const summaries = [
      makeSummary('g3-mul-tables-advanced', 'new'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    // Prerequisites not in summaries → not satisfied → no focus
    expect(plan.focusSkillId).toBeNull();
  });
});

// ── No-skill fallback ─────────────────────────────────────────────────────────

describe('planToday — empty summaries', () => {
  it('returns null focusSkillId when summaries is empty', () => {
    const plan = planToday({ ...BASE_ARGS, skillSummaries: [] });
    expect(plan.focusSkillId).toBeNull();
    expect(plan.focus).toBeNull();
    expect(plan.warmup).toBeNull();
  });

  it('returns review config when there are due items for unlocked skills', () => {
    // AREA_SQ_3x4 → g3-area-concept (no prerequisites, always unlocked)
    const states = [makeItemState('AREA_SQ_3x4', PAST)];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: [], itemStates: states });
    expect(plan.review).not.toBeNull();
    expect(plan.review!.specificItemIds).toContain('AREA_SQ_3x4');
  });
});

// ── Review: due items ─────────────────────────────────────────────────────────

describe('planToday — review config', () => {
  it('includes review config when items are due', () => {
    // Use items from unlocked skills (g3-mul-tables-basic requires g3-mul-meaning to be strong)
    const summaries = [makeSummary('g3-mul-meaning', 'mastered')];
    const states = [
      makeItemState('MUL_3x4', PAST),
      makeItemState('MUL_4x5', PAST),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries, itemStates: states });
    expect(plan.review).not.toBeNull();
    expect(plan.review!.mode).toBe('daily_review');
    expect(plan.review!.specificItemIds?.length).toBe(2);
  });

  it('does not include review when all items are future-due', () => {
    // AREA_SQ items map to g3-area-concept which has no prerequisites
    const states = [makeItemState('AREA_SQ_3x4', FUTURE)];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: [], itemStates: states });
    expect(plan.review).toBeNull();
  });

  it('does not include review when no nextDueAt is set', () => {
    const states = [makeItemState('AREA_SQ_3x4', undefined)];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: [], itemStates: states });
    expect(plan.review).toBeNull();
  });

  it('caps review length at 10 items', () => {
    // AREA_SQ items → g3-area-concept (no prerequisites, always unlocked)
    const states = Array.from({ length: 20 }, (_, i) =>
      makeItemState(`AREA_SQ_${Math.floor(i / 5) + 1}x${(i % 5) + 1}`, PAST),
    );
    const plan = planToday({ ...BASE_ARGS, skillSummaries: [], itemStates: states });
    expect(plan.review!.sessionLength).toBe(10);
  });
});

// ── Focus config ──────────────────────────────────────────────────────────────

describe('planToday — focus config', () => {
  it('focus config has positive sessionLength', () => {
    // g3-mul-meaning has no prerequisites
    const summaries = [makeSummary('g3-mul-meaning', 'needs_practice')];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focus).not.toBeNull();
    expect(plan.focus!.sessionLength).toBeGreaterThan(0);
  });

  it('focus config mode matches expected skill mode', () => {
    // g3-frac-equivalent requires g3-frac-unit (strong) to be unlocked
    const summaries = [
      makeSummary('g3-frac-unit', 'strong'),
      makeSummary('g3-frac-equivalent', 'needs_practice'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focus!.mode).toBe('fraction');
  });
});

// ── Estimated minutes ─────────────────────────────────────────────────────────

describe('planToday — estimatedMinutes', () => {
  it('returns a positive estimatedMinutes when focus is set', () => {
    // g3-mul-meaning has no prerequisites
    const summaries = [makeSummary('g3-mul-meaning', 'needs_practice')];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.estimatedMinutes).toBeGreaterThan(0);
  });

  it('returns 0 minutes when everything is empty', () => {
    const plan = planToday({ ...BASE_ARGS, skillSummaries: [] });
    expect(plan.estimatedMinutes).toBe(0);
  });
});

// ── Prerequisite lock applies to ALL statuses ─────────────────────────────────

describe('planToday — prerequisite lock for non-new statuses', () => {
  it('does not focus g3-frac-equivalent (needs_practice) when g3-frac-unit is not strong/mastered', () => {
    // g3-frac-equivalent requires g3-frac-unit; here it is 'new' (not satisfied → locked)
    // g3-frac-unit itself has no prerequisites and is unlocked, so it becomes the focus instead
    const summaries = [
      makeSummary('g3-frac-unit', 'new'),
      makeSummary('g3-frac-equivalent', 'needs_practice'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focusSkillId).not.toBe('g3-frac-equivalent');
    expect(plan.focusSkillId).toBe('g3-frac-unit');
  });

  it('does not focus g3-area-formula (review_due) when prerequisites are not strong/mastered', () => {
    // g3-area-formula requires g3-area-concept AND g3-mul-tables-basic
    const summaries = [
      makeSummary('g3-area-concept', 'needs_practice'),
      makeSummary('g3-mul-tables-basic', 'needs_practice'),
      makeSummary('g3-area-formula', 'review_due'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focusSkillId).not.toBe('g3-area-formula');
  });

  it('selects g3-frac-equivalent (needs_practice) when g3-frac-unit is strong', () => {
    const summaries = [
      makeSummary('g3-frac-unit', 'strong'),
      makeSummary('g3-frac-equivalent', 'needs_practice'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focusSkillId).toBe('g3-frac-equivalent');
  });
});

// ── Warmup respects locks ─────────────────────────────────────────────────────

describe('planToday — warmup does not select locked skill', () => {
  it('skips a high-accuracy skill whose prerequisites are not satisfied', () => {
    // g3-div-within-100 requires g3-div-meaning and g3-mul-tables-basic
    // If those are 'new', div-within-100 is locked and must not appear in warmup
    const summaries = [
      makeSummary('g3-div-meaning', 'new'),
      makeSummary('g3-mul-tables-basic', 'new'),
      makeSummary('g3-div-within-100', 'strong', { accuracy: 0.99 }),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    // warmup picks highest-accuracy non-new unlocked skill; none qualifies here
    expect(plan.warmup).toBeNull();
  });
});

// ── Review filters: only unlocked Grade 3 items ───────────────────────────────

describe('planToday — review filtering', () => {
  it('excludes due items with unrecognized item IDs', () => {
    // 'UNKNOWN_ITEM_99' cannot be reconstructed by makeItemFromId
    const states = [
      { ...makeItemState('UNKNOWN_ITEM_99', PAST), skillId: 'g3-mul-tables-basic' },
    ];
    const summaries = [makeSummary('g3-mul-tables-basic', 'strong')];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries, itemStates: states });
    expect(plan.review).toBeNull();
  });

  it('excludes due items for locked skills', () => {
    // MUL_6x7 → g3-mul-tables-advanced which requires g3-mul-tables-basic
    // g3-mul-tables-basic is 'new', so advanced is locked
    const states = [makeItemState('MUL_6x7', PAST)];
    const summaries = [
      makeSummary('g3-mul-tables-basic', 'new'),
      makeSummary('g3-mul-tables-advanced', 'review_due'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries, itemStates: states });
    expect(plan.review?.specificItemIds ?? []).not.toContain('MUL_6x7');
  });

  it('includes due items for unlocked Grade 3 skills', () => {
    // MUL_3x4 → g3-mul-tables-basic (requires g3-mul-meaning to be strong/mastered)
    const states = [makeItemState('MUL_3x4', PAST)];
    const summaries = [
      makeSummary('g3-mul-meaning', 'mastered'),
      makeSummary('g3-mul-tables-basic', 'strong'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries, itemStates: states });
    expect(plan.review?.specificItemIds).toContain('MUL_3x4');
  });

  it('excludes due items that map to non-Grade3 skills (e.g. addition)', () => {
    // ADD_5p3 → no Grade 3 skill via inferGrade3SkillId
    const states = [{ ...makeItemState('ADD_5p3', PAST), skillId: 'arithmetic' }];
    const summaries = [makeSummary('g3-mul-tables-basic', 'strong')];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries, itemStates: states });
    expect(plan.review?.specificItemIds ?? []).not.toContain('ADD_5p3');
  });
});

// ── Mastered skills are skipped ───────────────────────────────────────────────

describe('planToday — skips mastered skills', () => {
  it('does not focus on a mastered skill', () => {
    const summaries = [
      makeSummary('g3-mul-tables-basic', 'mastered', { accuracy: 1, attemptCount: 20 }),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focusSkillId).toBeNull();
  });
});

// ── Brand-new student ─────────────────────────────────────────────────────────

describe('planToday — brand-new student sees a suggested first skill', () => {
  function buildCompleteSummaries(studentId: string): StudentSkillSummary[] {
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

  it('returns a non-null focusSkillId for a brand-new student', () => {
    const allNewSummaries = buildCompleteSummaries('new-student');
    const plan = planToday({
      studentId: 'new-student',
      skillSummaries: allNewSummaries,
      itemStates: [],
      now: new Date(),
    });
    expect(plan.focusSkillId).not.toBeNull();
    expect(plan.focus).not.toBeNull();
  });

  it('the suggested first skill has no prerequisites (is unlocked)', () => {
    const allNewSummaries = buildCompleteSummaries('new-student');
    const plan = planToday({
      studentId: 'new-student',
      skillSummaries: allNewSummaries,
      itemStates: [],
      now: new Date(),
    });
    if (plan.focusSkillId) {
      const node = GRADE3_MASTERY_MAP.find(n => n.id === plan.focusSkillId);
      expect(node).toBeDefined();
      expect(node!.prerequisites.length).toBe(0);
    }
  });

  it('the focus config has specificItemIds', () => {
    const allNewSummaries = buildCompleteSummaries('new-student');
    const plan = planToday({
      studentId: 'new-student',
      skillSummaries: allNewSummaries,
      itemStates: [],
      now: new Date(),
    });
    expect(plan.focus?.specificItemIds?.length).toBeGreaterThan(0);
  });
});
