import { describe, it, expect } from 'vitest';
import { planToday } from '../features/mastery/todayPlanEngine';
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
    const summaries = [
      makeSummary('g3-mul-tables-basic', 'needs_practice'),
      makeSummary('g3-mul-tables-advanced', 'review_due'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focusSkillId).toBe('g3-mul-tables-advanced');
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
    const summaries = [
      makeSummary('g3-mul-tables-basic', 'strong'),
      makeSummary('g3-frac-equivalent', 'needs_practice'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focusSkillId).toBe('g3-frac-equivalent');
  });
});

// ── Priority: strong ──────────────────────────────────────────────────────────

describe('planToday — priority: strong', () => {
  it('picks strong when no review_due or needs_practice exists', () => {
    const summaries = [
      makeSummary('g3-mul-tables-basic', 'strong'),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focusSkillId).toBe('g3-mul-tables-basic');
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
    const summaries = [
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

  it('returns review config when there are due items even with no skill summaries', () => {
    const states = [makeItemState('MUL_3x4', PAST)];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: [], itemStates: states });
    expect(plan.review).not.toBeNull();
    expect(plan.review!.specificItemIds).toContain('MUL_3x4');
  });
});

// ── Review: due items ─────────────────────────────────────────────────────────

describe('planToday — review config', () => {
  it('includes review config when items are due', () => {
    const states = [
      makeItemState('MUL_3x4', PAST),
      makeItemState('MUL_4x5', PAST),
    ];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: [], itemStates: states });
    expect(plan.review).not.toBeNull();
    expect(plan.review!.mode).toBe('daily_review');
    expect(plan.review!.specificItemIds?.length).toBe(2);
  });

  it('does not include review when all items are future-due', () => {
    const states = [makeItemState('MUL_3x4', FUTURE)];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: [], itemStates: states });
    expect(plan.review).toBeNull();
  });

  it('does not include review when no nextDueAt is set', () => {
    const states = [makeItemState('MUL_3x4', undefined)];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: [], itemStates: states });
    expect(plan.review).toBeNull();
  });

  it('caps review length at 10 items', () => {
    const states = Array.from({ length: 20 }, (_, i) => makeItemState(`MUL_${i}x${i}`, PAST));
    const plan = planToday({ ...BASE_ARGS, skillSummaries: [], itemStates: states });
    expect(plan.review!.sessionLength).toBe(10);
  });
});

// ── Focus config ──────────────────────────────────────────────────────────────

describe('planToday — focus config', () => {
  it('focus config has positive sessionLength', () => {
    const summaries = [makeSummary('g3-mul-tables-basic', 'needs_practice')];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focus).not.toBeNull();
    expect(plan.focus!.sessionLength).toBeGreaterThan(0);
  });

  it('focus config mode matches expected skill mode', () => {
    const summaries = [makeSummary('g3-frac-equivalent', 'needs_practice')];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.focus!.mode).toBe('fraction');
  });
});

// ── Estimated minutes ─────────────────────────────────────────────────────────

describe('planToday — estimatedMinutes', () => {
  it('returns a positive estimatedMinutes when focus is set', () => {
    const summaries = [makeSummary('g3-mul-tables-basic', 'needs_practice')];
    const plan = planToday({ ...BASE_ARGS, skillSummaries: summaries });
    expect(plan.estimatedMinutes).toBeGreaterThan(0);
  });

  it('returns 0 minutes when everything is empty', () => {
    const plan = planToday({ ...BASE_ARGS, skillSummaries: [] });
    expect(plan.estimatedMinutes).toBe(0);
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
