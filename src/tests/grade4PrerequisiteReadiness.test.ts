import { describe, expect, it } from 'vitest';
import { getCurriculumSkill } from '../features/curriculum/curriculumRegistry';
import type { StudentSkillSummary } from '../features/mastery/skillMasteryEngine';
import { planToday } from '../features/mastery/todayPlanEngine';

function summary(
  skillId: string,
  status: StudentSkillSummary['status'],
  overrides: Partial<StudentSkillSummary> = {},
): StudentSkillSummary {
  return {
    studentId: 'grade4-student',
    skillId,
    status,
    attemptCount: status === 'new' ? 0 : 8,
    correctCount: status === 'new' ? 0 : 7,
    accuracy: status === 'new' ? 0 : 0.875,
    dueItemCount: status === 'review_due' ? 1 : 0,
    itemCount: 4,
    mistakePatterns: [],
    ...overrides,
  };
}

const BASE_ARGS = {
  studentId: 'grade4-student',
  itemStates: [],
  now: new Date('2026-10-18T12:00:00Z'),
};

describe('Grade 4 today-plan prerequisite evidence', () => {
  it('treats a mastered Grade 3 prerequisite as satisfied even when its review is due', () => {
    const plan = planToday({
      ...BASE_ARGS,
      skillSummaries: [
        summary('g4-oa-factor-meaning', 'mastered', { learningState: 'mastered' }),
        summary('g4-oa-factor-pairs', 'new'),
      ],
      prerequisiteSummaries: [
        summary('g3-mul-tables-advanced', 'review_due', {
          learningState: 'mastered',
          reviewState: 'due',
        }),
      ],
    });

    expect(plan.focusSkillId).toBe('g4-oa-factor-pairs');
    expect(plan.focusPrereqAdvisory ?? []).toHaveLength(0);
  });

  it('uses earlier-grade summaries only as evidence, never as Grade 4 focus candidates', () => {
    const grade3Prerequisite = summary('g3-mul-tables-advanced', 'review_due', {
      learningState: 'needs_practice',
      reviewState: 'due',
    });

    const plan = planToday({
      ...BASE_ARGS,
      skillSummaries: [
        summary('g4-oa-factor-meaning', 'mastered', { learningState: 'mastered' }),
        summary('g4-oa-factor-pairs', 'new'),
      ],
      prerequisiteSummaries: [grade3Prerequisite],
    });

    expect(plan.focusSkillId).toBe('g4-oa-factor-pairs');
    expect(plan.focusSkillId).not.toBe(grade3Prerequisite.skillId);
    expect(plan.focusPrereqAdvisory).toContain(
      getCurriculumSkill('g3-mul-tables-advanced')?.title,
    );
  });
});
