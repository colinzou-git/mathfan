import { describe, expect, it } from 'vitest';
import { planDailyNewForGoals } from '../features/goals/dailyNewGoalPlanner';
import { calculateGoalProgress } from '../features/goals/goalEngine';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { inferGrade3SkillId } from '../features/mastery/skillMapping';
import type { GoalBaseline, GoalSkillTarget, LearningGoal } from '../features/goals/types';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { StudentSkillSummary } from '../features/mastery/skillMasteryEngine';

const STUDENT_ID = 'student-1';
const SKILL_ID = 'g3-mul-meaning';
const NOW = '2026-06-17T16:00:00.000Z';
const TIMEZONE = 'America/Los_Angeles';

function baseline(): GoalBaseline {
  return {
    capturedAt: '2026-06-01T00:00:00.000Z',
    status: 'new',
    attemptCount: 0,
    distinctItemCount: 0,
    recentAccuracy: 0,
    dueItemCount: 0,
    mistakePatterns: [],
    hintRate: 0,
  };
}

function target(): GoalSkillTarget {
  return {
    id: 'target-1',
    skillId: SKILL_ID,
    reason: 'needs_evaluation',
    baseline: baseline(),
    targetAccuracy: 0.8,
    minFirstAttempts: 10,
    minDistinctItems: 5,
    minActiveDays: 2,
    maxHintRate: 0,
    misconceptionTargets: [],
    weight: 1,
  };
}

function goal(overrides: Partial<LearningGoal> = {}): LearningGoal {
  return {
    id: 'goal-1',
    studentId: STUDENT_ID,
    title: 'Meaning Goal',
    source: 'manual',
    status: 'active',
    durationDays: 7,
    startDate: '2026-06-17',
    targetDate: '2026-06-23',
    targets: [target()],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function summary(): StudentSkillSummary {
  return {
    studentId: STUDENT_ID,
    skillId: SKILL_ID,
    status: 'new',
    attemptCount: 0,
    correctCount: 0,
    accuracy: 0,
    dueItemCount: 0,
    itemCount: 0,
    mistakePatterns: [],
  };
}

function extraEvent(itemId: string, index: number): MathAnswerEvent {
  return {
    id: `extra-event-${index}`,
    studentId: STUDENT_ID,
    sessionId: 'extra-session-1',
    itemId,
    mode: 'practice',
    promptShown: itemId,
    correctAnswer: 1,
    studentAnswer: 1,
    isCorrect: true,
    isRetry: false,
    hintUsed: false,
    latencyMs: 1000,
    reviewGrade: 'good',
    origin: 'daily_new_for_goals',
    goalLearningKind: 'extra',
    createdAt: `2026-06-17T17:${String(index).padStart(2, '0')}:00.000Z`,
  };
}

function ordered(ids: string[]): string[] {
  const schemaKey = (id: string) => id.replace(/[-_]\d+.*$/, '').replace(/\d+x\d+.*$/, '');
  return [...ids].sort((a, b) => {
    const aSchema = schemaKey(a);
    const bSchema = schemaKey(b);
    return aSchema === bSchema ? a.localeCompare(b) : aSchema.localeCompare(bSchema);
  });
}

function dailyPlan(events: MathAnswerEvent[] = []) {
  return planDailyNewForGoals({
    studentId: STUDENT_ID,
    goals: [goal()],
    events,
    itemStates: [],
    skillSummaries: [summary()],
    now: NOW,
    timezone: TIMEZONE,
  });
}

describe('reviewed main branch goal fixes', () => {
  it('continues Learn Extra with the first untouched unseen item', () => {
    const first = dailyPlan();
    const plannedIds = new Set(first.tiles.flatMap(tile => tile.itemIds));
    const completedExtraIds = first.extraChoices[0].itemIds;
    const remaining = (planPracticeForSkill(SKILL_ID).specificItemIds ?? [])
      .filter(id => {
        const item = makeItemFromId(id);
        return item != null && inferGrade3SkillId(item) === SKILL_ID;
      })
      .filter(id => !plannedIds.has(id) && !completedExtraIds.includes(id));
    const expectedNextId = ordered(remaining)[0];
    expect(expectedNextId).toBeDefined();

    const second = dailyPlan(completedExtraIds.map(extraEvent));
    expect(second.extraChoices[0]?.itemIds[0]).toBe(expectedNextId);
  });

  it('counts calendar days across the fall DST transition', () => {
    const progress = calculateGoalProgress(goal({
      startDate: '2026-11-01',
      targetDate: '2026-11-02',
    }), {
      studentId: STUDENT_ID,
      events: [],
      itemStates: [],
      skillSummaries: [],
      now: '2026-11-01T20:00:00.000Z',
      timezone: TIMEZONE,
      resolveSkillId: () => SKILL_ID,
    });

    expect(progress.daysRemaining).toBe(1);
  });
});
