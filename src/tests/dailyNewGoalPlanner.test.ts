import { describe, expect, it } from 'vitest';
import { planDailyNewForGoals } from '../features/goals/dailyNewGoalPlanner';
import type { GoalBaseline, GoalSkillTarget, LearningGoal } from '../features/goals/types';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { StudentItemState } from '../types/math';
import type { StudentSkillSummary } from '../features/mastery/skillMasteryEngine';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { calculateGoalProgress } from '../features/goals/goalEngine';
import { DEFAULT_DAILY_NEW_GOAL_LIMITS, normalizeDailyNewGoalLimits, validateDailyNewGoalLimits } from '../features/goals/dailyNewGoalLimits';
import { deriveCardKeyFromItemId } from '../features/scheduler/cardModel';

const STUDENT_ID = 'student-1';
const NOW = '2026-06-17T16:00:00.000Z';
const TZ = 'America/Los_Angeles';
const DAY_START = '2026-06-17T07:00:00.000Z';

function pool(skillId = 'g3-mul-meaning'): string[] {
  return planPracticeForSkill(skillId).specificItemIds ?? [];
}

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

function target(overrides: Partial<GoalSkillTarget> = {}): GoalSkillTarget {
  return {
    id: 'target-1',
    skillId: 'g3-mul-meaning',
    reason: 'needs_evaluation',
    baseline: baseline(),
    targetAccuracy: 0.8,
    minFirstAttempts: 10,
    minDistinctItems: 5,
    minActiveDays: 2,
    maxHintRate: 0,
    misconceptionTargets: [],
    weight: 1,
    ...overrides,
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

function summary(skillId = 'g3-mul-meaning', status: StudentSkillSummary['status'] = 'new'): StudentSkillSummary {
  return {
    studentId: STUDENT_ID,
    skillId,
    status,
    attemptCount: status === 'new' ? 0 : 5,
    correctCount: status === 'needs_practice' ? 2 : 5,
    accuracy: status === 'new' ? 0 : status === 'needs_practice' ? 0.4 : 0.9,
    dueItemCount: status === 'review_due' ? 1 : 0,
    itemCount: status === 'new' ? 0 : 5,
    mistakePatterns: [],
  };
}

function event(itemId: string, overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return {
    id: `event-${itemId}`,
    studentId: STUDENT_ID,
    sessionId: 'session-1',
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
    createdAt: '2026-06-16T12:00:00.000Z',
    ...overrides,
  };
}

function state(itemId: string, overrides: Partial<StudentItemState> = {}): StudentItemState {
  return {
    studentId: STUDENT_ID,
    cardKey: deriveCardKeyFromItemId(itemId),
    lastItemId: itemId,
    skillId: 'g3-mul-meaning',
    attemptCount: 1,
    correctCount: 1,
    lastCorrect: true,
    lastLatencyMs: 1000,
    medianLatencyMs: 1000,
    ease: 2.5,
    stabilityDays: 1,
    difficulty: 0.2,
    masteryLevel: 'learning',
    mistakePatterns: [],
    ...overrides,
  };
}

function plan(overrides: Partial<Parameters<typeof planDailyNewForGoals>[0]> = {}) {
  return planDailyNewForGoals({
    studentId: STUDENT_ID,
    goals: [goal()],
    events: [],
    itemStates: [],
    skillSummaries: [summary()],
    now: NOW,
    timezone: TZ,
    ...overrides,
  });
}

describe('planDailyNewForGoals separation', () => {
  it('never selects previously directly attempted items for Daily New', () => {
    const seen = pool()[0];
    const result = plan({ events: [event(seen)] });
    expect(result.tiles.flatMap(tile => tile.itemIds)).not.toContain(seen);
  });

  it('does not count retries or indirect related evidence as direct attempts', () => {
    const [retryOnly, relatedOnly] = pool();
    const result = plan({
      events: [
        event(retryOnly, { isRetry: true }),
        event(relatedOnly, { relatedEvidence: true }),
      ],
    });
    const ids = result.tiles.flatMap(tile => tile.itemIds);
    expect(ids).toContain(retryOnly);
    expect(ids).toContain(relatedOnly);
  });

  it('excludes FSRS-due items even when due came from state only', () => {
    const due = pool()[0];
    const result = plan({
      itemStates: [state(due, { nextDueAt: '2026-06-16T00:00:00.000Z' })],
    });
    expect(result.tiles.flatMap(tile => tile.itemIds)).not.toContain(due);
  });

  it('lets partially learned skills receive unseen items while seen due items stay excluded', () => {
    const [seenDue] = pool();
    const result = plan({
      events: [event(seenDue)],
      itemStates: [state(seenDue, { nextDueAt: '2026-06-16T00:00:00.000Z' })],
      skillSummaries: [summary('g3-mul-meaning', 'review_due')],
    });
    const ids = result.tiles.flatMap(tile => tile.itemIds);
    expect(ids).not.toContain(seenDue);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('never produces a review_for_goal tile', () => {
    const result = plan();
    expect(result.tiles.every(tile => tile.kind === 'new_skill' || tile.kind === 'continue_new_learning')).toBe(true);
  });
});

describe('planDailyNewForGoals allocation', () => {
  it('returns Set a Goal state when there are no active goals', () => {
    expect(plan({ goals: [] }).emptyReason).toBe('no_active_goals');
  });

  it('returns review guidance when active goals have no unseen material', () => {
    const events = pool().map(id => event(id));
    expect(plan({ events }).emptyReason).toBe('no_unseen_items');
  });

  it('uses at most three tiles and keeps per-tile limits', () => {
    const result = plan({
      goals: [
        goal({ id: 'goal-1', title: 'Goal 1', targets: [target({ id: 't1', skillId: 'g3-mul-meaning' })] }),
        goal({ id: 'goal-2', title: 'Goal 2', targets: [target({ id: 't2', skillId: 'g3-area-concept' })] }),
        goal({ id: 'goal-3', title: 'Goal 3', targets: [target({ id: 't3', skillId: 'g3-frac-unit' })] }),
        goal({ id: 'goal-4', title: 'Goal 4', targets: [target({ id: 't4', skillId: 'g3-time-to-minute' })] }),
      ],
      skillSummaries: [summary(), summary('g3-area-concept'), summary('g3-frac-unit'), summary('g3-time-to-minute')],
    });
    expect(result.tiles.length).toBeLessThanOrEqual(3);
    expect(result.tiles.every(tile => tile.questionCount >= 5 && tile.questionCount <= 12)).toBe(true);
    expect(result.tiles.reduce((sum, tile) => sum + tile.questionCount, 0)).toBeLessThanOrEqual(80);
  });

  it('respects custom global tile limits and planned total cap', () => {
    const result = plan({
      goals: [
        goal({ id: 'g1', targets: [target({ id: 't1', skillId: 'g3-mul-meaning' })] }),
        goal({ id: 'g2', targets: [target({ id: 't2', skillId: 'g3-area-concept' })] }),
      ],
      skillSummaries: [summary(), summary('g3-area-concept')],
      dailyNewGoalQuestionLimits: { minQuestionsPerSkillTile: 3, maxQuestionsPerSkillTile: 8, maxPlannedQuestionsPerDay: 10 },
    });
    expect(result.tiles.every(tile => tile.questionCount >= 3 && tile.questionCount <= 8)).toBe(true);
    expect(result.tiles.reduce((sum, tile) => sum + tile.questionCount, 0)).toBeLessThanOrEqual(10);
  });

  it('uses per-goal overrides and warns when same-skill limits conflict', () => {
    const result = plan({ goals: [
      goal({ id: 'g1', dailyNewQuestionLimitsOverride: { minQuestionsPerSkillTile: 10, maxQuestionsPerSkillTile: 12 } }),
      goal({ id: 'g2', dailyNewQuestionLimitsOverride: { minQuestionsPerSkillTile: 3, maxQuestionsPerSkillTile: 5 } }),
    ] });
    expect(result.tiles[0].questionCount).toBeLessThanOrEqual(5);
    expect(result.warnings.some(warning => warning.code === 'conflicting_goal_tile_limits')).toBe(true);
  });

  it('warns when a short goal needs more days at its current limits', () => {
    const result = plan({
      goals: [goal({ targetDate: '2026-06-17', durationDays: 1, dailyNewQuestionLimitsOverride: { minQuestionsPerSkillTile: 1, maxQuestionsPerSkillTile: 1 } })],
    });
    expect(result.warnings.find(warning => warning.code === 'goal_needs_more_days')?.extraDaysNeeded).toBeGreaterThan(0);
  });

  it('ensures the most urgent eligible goal receives a tile', () => {
    const result = plan({
      goals: [
        goal({ id: 'later', title: 'Later', targetDate: '2026-07-01', targets: [target({ id: 'later-target', skillId: 'g3-mul-meaning' })] }),
        goal({ id: 'urgent', title: 'Urgent', targetDate: '2026-06-17', targets: [target({ id: 'urgent-target', skillId: 'g3-area-concept' })] }),
      ],
      skillSummaries: [summary(), summary('g3-area-concept')],
    });
    expect(result.tiles.some(tile => tile.goalIds.includes('urgent'))).toBe(true);
  });

  it('merges duplicate skill targets across goals', () => {
    const result = plan({
      goals: [
        goal({ id: 'goal-a', title: 'A', targets: [target({ id: 'target-a' })] }),
        goal({ id: 'goal-b', title: 'B', targets: [target({ id: 'target-b' })] }),
      ],
    });
    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0].goalIds).toEqual(expect.arrayContaining(['goal-a', 'goal-b']));
    expect(result.tiles[0].targetIds).toEqual(expect.arrayContaining(['target-a', 'target-b']));
  });

  it('excludes inactive goals and mastered targets', () => {
    const result = plan({
      goals: [
        goal({ id: 'paused', status: 'paused' }),
        goal({ id: 'completed', status: 'completed' }),
        goal({ id: 'active', targets: [target({ id: 'mastered', skillId: 'g3-mul-meaning' })] }),
      ],
      skillSummaries: [summary('g3-mul-meaning', 'mastered')],
    });
    expect(result.tiles).toHaveLength(0);
  });

  it('does not duplicate item IDs and remains stable for the same local day inputs', () => {
    const first = plan();
    const second = plan();
    const ids = first.tiles.flatMap(tile => tile.itemIds);
    expect(new Set(ids).size).toBe(ids.length);
    expect(second.tiles.map(tile => tile.itemIds)).toEqual(first.tiles.map(tile => tile.itemIds));
  });

  it('marks completed planned tiles complete without refilling them', () => {
    const first = plan();
    const completedEvents = first.tiles[0].itemIds.map(id => event(id, {
      origin: 'daily_new_for_goals',
      goalLearningKind: 'planned',
      createdAt: DAY_START,
    }));
    const second = plan({ events: completedEvents });
    expect(second.tiles[0].itemIds).toEqual(first.tiles[0].itemIds);
    expect(second.tiles[0].isComplete).toBe(true);
  });

  it('moves a learned Daily New item out of Daily New when it becomes FSRS-due for Daily Review', () => {
    const first = plan();
    const learned = first.tiles[0].itemIds[0];
    const learnedEvent = event(learned, {
      origin: 'daily_new_for_goals',
      goalLearningKind: 'planned',
      createdAt: '2026-06-17T16:05:00.000Z',
    });
    const dueState = state(learned, { nextDueAt: '2026-06-17T15:00:00.000Z' });
    const second = plan({
      events: [learnedEvent],
      itemStates: [dueState],
      skillSummaries: [summary('g3-mul-meaning', 'review_due')],
    });

    expect(second.tiles.flatMap(tile => tile.itemIds)).not.toContain(learned);
    expect(second.extraChoices.flatMap(tile => tile.itemIds)).not.toContain(learned);
    expect(dueState.nextDueAt! <= NOW).toBe(true);
  });

  it('records planned Daily New canonical events as goal progress without mutating manual counters', () => {
    const g = goal();
    const first = plan({ goals: [g] });
    const completedEvents = first.tiles[0].itemIds.slice(0, 1).map((id, index) => event(id, {
      id: `planned-${index}`,
      origin: 'daily_new_for_goals',
      goalLearningKind: 'planned',
      createdAt: `2026-06-17T16:${String(index).padStart(2, '0')}:00.000Z`,
    }));

    const progress = calculateGoalProgress(g, {
      studentId: STUDENT_ID,
      events: completedEvents,
      itemStates: [],
      skillSummaries: [summary('g3-mul-meaning', 'needs_practice')],
      now: NOW,
      timezone: TZ,
    });

    expect(progress.targets[0].firstAttemptCount).toBe(1);
    expect(progress.targets[0].distinctItemCount).toBe(1);
    expect(progress.targets[0].questionsCompletedToday).toBe(1);
    expect(g.targets[0].baseline.attemptCount).toBe(0);
  });

  it('starts a fresh local-day Daily New plan after yesterday completed work', () => {
    const first = plan({ now: '2026-06-17T16:00:00.000Z' });
    const yesterdayCompleted = first.tiles[0].itemIds.map(id => event(id, {
      origin: 'daily_new_for_goals',
      goalLearningKind: 'planned',
      createdAt: '2026-06-17T16:10:00.000Z',
    }));
    const nextDay = plan({
      events: yesterdayCompleted,
      now: '2026-06-18T16:00:00.000Z',
    });

    expect(nextDay.tiles[0].isComplete).toBe(false);
    expect(nextDay.tiles.flatMap(tile => tile.itemIds).some(id => !first.tiles[0].itemIds.includes(id))).toBe(true);
  });
});

describe('Daily New goal limit validation', () => {
  it('uses the backward-compatible defaults and normalizes invalid saved data', () => {
    expect(normalizeDailyNewGoalLimits()).toEqual(DEFAULT_DAILY_NEW_GOAL_LIMITS);
    expect(normalizeDailyNewGoalLimits({ minQuestionsPerSkillTile: 20, maxQuestionsPerSkillTile: 2, maxPlannedQuestionsPerDay: 3 }))
      .toEqual({ minQuestionsPerSkillTile: 20, maxQuestionsPerSkillTile: 20, maxPlannedQuestionsPerDay: 20 });
  });

  it('rejects impossible user-entered limits', () => {
    const result = validateDailyNewGoalLimits({ minQuestionsPerSkillTile: 6, maxQuestionsPerSkillTile: 5, maxPlannedQuestionsPerDay: 4 });
    expect(result.errors).toHaveLength(2);
  });
});

describe('planDailyNewForGoals Learn Extra', () => {
  it('offers extra unseen active-goal material and writes extra attribution', () => {
    const result = plan();
    expect(result.extraChoices.length).toBeGreaterThan(0);
    expect(result.extraChoices[0].config.origin).toBe('daily_new_for_goals');
    expect(result.extraChoices[0].config.goalLearningKind).toBe('extra');
  });

  it('excludes planned and today-completed items from extra choices', () => {
    const first = plan();
    const planned = new Set(first.tiles.flatMap(tile => tile.itemIds));
    const extraIds = first.extraChoices.flatMap(tile => tile.itemIds);
    expect(extraIds.every(id => !planned.has(id))).toBe(true);

    const completed = first.extraChoices[0].itemIds[0];
    const second = plan({
      events: [event(completed, {
        origin: 'daily_new_for_goals',
        goalLearningKind: 'extra',
        sessionId: 'extra-1',
        createdAt: DAY_START,
      })],
    });
    expect(second.extraChoices.flatMap(tile => tile.itemIds)).not.toContain(completed);
  });

  it('advances repeated Learn Extra sessions without reusing planned or already-used daily IDs', () => {
    const first = plan();
    const planned = new Set(first.tiles.flatMap(tile => tile.itemIds));
    const firstExtra = first.extraChoices[0].itemIds;
    const second = plan({
      events: firstExtra.map((id, index) => event(id, {
        id: `extra-${index}`,
        origin: 'daily_new_for_goals',
        goalLearningKind: 'extra',
        sessionId: 'extra-session-1',
        createdAt: `2026-06-17T17:${String(index).padStart(2, '0')}:00.000Z`,
      })),
    });
    const secondExtra = second.extraChoices.flatMap(tile => tile.itemIds);

    expect(secondExtra.every(id => !planned.has(id))).toBe(true);
    expect(secondExtra.every(id => !firstExtra.includes(id))).toBe(true);
  });

  it('treats legacy daily_recommended_learning events as readable same-day Daily New completion data', () => {
    const first = plan();
    const completedEvents = first.tiles[0].itemIds.map((id, index) => event(id, {
      id: `legacy-${index}`,
      origin: 'daily_recommended_learning',
      createdAt: `2026-06-17T16:${String(index + 10).padStart(2, '0')}:00.000Z`,
    }));
    const second = plan({ events: completedEvents });

    expect(second.tiles[0].itemIds).toEqual(first.tiles[0].itemIds);
    expect(second.tiles[0].isComplete).toBe(true);
  });

  it('disables extra when exhausted', () => {
    const events = pool().map(id => event(id));
    const result = plan({ events });
    expect(result.extraChoices).toHaveLength(0);
    expect(result.exhaustedExtra).toBe(true);
  });
});
