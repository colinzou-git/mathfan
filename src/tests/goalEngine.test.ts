import { describe, expect, it } from 'vitest';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { StudentSkillSummary } from '../features/mastery/skillMasteryEngine';
import type { GoalBaseline, GoalEvent, GoalSkillTarget, LearningGoal } from '../features/goals/types';
import type { StudentItemState } from '../types/math';
import {
  applyGoalTargetEdits,
  calculateGoalProgress,
  calculateTargetProgress,
  captureGoalBaseline,
  evaluateGoalLifecycle,
  suggestedTargetDefaults,
  transitionGoal,
} from '../features/goals/goalEngine';

const STUDENT_ID = 'student-1';
const SKILL_ID = 'skill-fractions';
const OTHER_SKILL_ID = 'skill-other';
const BASELINE_AT = '2026-06-01T12:00:00.000Z';
const NOW = '2026-06-05T12:00:00.000Z';
const TZ = 'America/Los_Angeles';

const skillByItem: Record<string, string> = {
  a: SKILL_ID,
  b: SKILL_ID,
  c: SKILL_ID,
  d: SKILL_ID,
  other: OTHER_SKILL_ID,
};

function resolveSkillId(itemId: string): string | null {
  return skillByItem[itemId] ?? null;
}

function event(overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return {
    id: overrides.id ?? `event-${Math.random()}`,
    studentId: STUDENT_ID,
    sessionId: 'session-1',
    itemId: 'a',
    mode: 'practice',
    promptShown: 'Question?',
    correctAnswer: 1,
    studentAnswer: 1,
    isCorrect: true,
    isRetry: false,
    hintUsed: false,
    latencyMs: 1000,
    createdAt: '2026-06-02T12:00:00.000Z',
    ...overrides,
  };
}

function state(overrides: Partial<StudentItemState> = {}): StudentItemState {
  return {
    studentId: STUDENT_ID,
    cardKey: 'template:a',
    lastItemId: 'a',
    skillId: SKILL_ID,
    attemptCount: 1,
    correctCount: 1,
    lastCorrect: true,
    lastLatencyMs: 1000,
    medianLatencyMs: 1000,
    ease: 2.5,
    stabilityDays: 1,
    difficulty: 0.3,
    masteryLevel: 'strong',
    mistakePatterns: [],
    ...overrides,
  };
}

function summary(overrides: Partial<StudentSkillSummary> = {}): StudentSkillSummary {
  return {
    studentId: STUDENT_ID,
    skillId: SKILL_ID,
    status: 'strong',
    attemptCount: 10,
    correctCount: 9,
    accuracy: 0.9,
    dueItemCount: 0,
    itemCount: 4,
    mistakePatterns: [],
    ...overrides,
  };
}

function baseline(overrides: Partial<GoalBaseline> = {}): GoalBaseline {
  return {
    capturedAt: BASELINE_AT,
    status: 'needs_practice',
    attemptCount: 3,
    distinctItemCount: 2,
    recentAccuracy: 0.5,
    dueItemCount: 0,
    mistakePatterns: [],
    hintRate: 0,
    ...overrides,
  };
}

function target(overrides: Partial<GoalSkillTarget> = {}): GoalSkillTarget {
  return {
    id: 'target-1',
    skillId: SKILL_ID,
    reason: 'needs_practice',
    baseline: baseline(),
    targetAccuracy: 0.8,
    minFirstAttempts: 3,
    minDistinctItems: 2,
    minActiveDays: 2,
    maxHintRate: 0.25,
    misconceptionTargets: [],
    weight: 1,
    ...overrides,
  };
}

function goal(overrides: Partial<LearningGoal> = {}): LearningGoal {
  return {
    id: 'goal-1',
    studentId: STUDENT_ID,
    title: 'Fraction goal',
    source: 'manual',
    status: 'active',
    durationDays: 7,
    startDate: '2026-06-01',
    targetDate: '2026-06-10',
    targets: [target()],
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-01T12:00:00.000Z',
    ...overrides,
  };
}

function input(overrides: {
  events?: MathAnswerEvent[];
  itemStates?: StudentItemState[];
  skillSummaries?: StudentSkillSummary[];
  now?: string;
  timezone?: string;
} = {}) {
  return {
    studentId: STUDENT_ID,
    events: overrides.events ?? [],
    itemStates: overrides.itemStates ?? [],
    skillSummaries: overrides.skillSummaries ?? [summary()],
    now: overrides.now ?? NOW,
    timezone: overrides.timezone ?? TZ,
    resolveSkillId,
  };
}

describe('goal baseline capture', () => {
  it('captures direct first-attempt evidence, due count, mistakes, recent accuracy, and hint rate', () => {
    const result = captureGoalBaseline(input({
      events: [
        event({ id: 'pre-1', itemId: 'a', isCorrect: true, hintUsed: false, createdAt: '2026-05-30T12:00:00.000Z' }),
        event({ id: 'pre-2', itemId: 'b', isCorrect: false, hintUsed: true, createdAt: '2026-05-31T12:00:00.000Z' }),
        event({ id: 'retry', itemId: 'b', isRetry: true, isCorrect: true, createdAt: '2026-05-31T12:00:01.000Z' }),
        event({ id: 'related', itemId: 'b', relatedEvidence: true, isCorrect: true, createdAt: '2026-05-31T12:00:02.000Z' }),
        event({ id: 'other', itemId: 'other', isCorrect: true, createdAt: '2026-05-31T12:00:03.000Z' }),
      ],
      itemStates: [
        state({ cardKey: 'template:a', lastItemId: 'a', nextDueAt: '2026-06-01T00:00:00.000Z', mistakePatterns: ['fraction:unit'] }),
        state({ cardKey: 'template:b', lastItemId: 'b', nextDueAt: '2026-06-10T00:00:00.000Z', mistakePatterns: ['fraction:compare'] }),
      ],
      now: BASELINE_AT,
      skillSummaries: [summary({ status: 'needs_practice' })],
    }), SKILL_ID);

    expect(result.status).toBe('needs_practice');
    expect(result.attemptCount).toBe(2);
    expect(result.distinctItemCount).toBe(2);
    expect(result.recentAccuracy).toBe(0.5);
    expect(result.hintRate).toBe(0.5);
    expect(result.dueItemCount).toBe(1);
    expect(result.mistakePatterns).toEqual(['fraction:compare', 'fraction:unit']);
  });

  it('suggests target defaults by reason', () => {
    expect(suggestedTargetDefaults('needs_practice', baseline({ recentAccuracy: 0.7 })).targetAccuracy).toBeCloseTo(0.85);
    expect(suggestedTargetDefaults('review_due', baseline({ dueItemCount: 8 })).minFirstAttempts).toBe(8);
    expect(suggestedTargetDefaults('needs_evaluation', baseline()).minFirstAttempts).toBe(10);
    expect(suggestedTargetDefaults('continue_progress', baseline()).targetAccuracy).toBe(0.9);
  });
});

describe('goal target progress evidence rules', () => {
  it('ignores retries, related evidence, other skills, and pre-baseline events', () => {
    const progress = calculateTargetProgress(target(), input({
      events: [
        event({ id: 'pre', itemId: 'a', isCorrect: true, createdAt: '2026-05-31T12:00:00.000Z' }),
        event({ id: 'post-a', itemId: 'a', isCorrect: true, createdAt: '2026-06-02T12:00:00.000Z' }),
        event({ id: 'retry', itemId: 'a', isRetry: true, isCorrect: false, createdAt: '2026-06-02T12:00:01.000Z' }),
        event({ id: 'related', itemId: 'b', relatedEvidence: true, isCorrect: true, createdAt: '2026-06-03T12:00:00.000Z' }),
        event({ id: 'other', itemId: 'other', isCorrect: true, createdAt: '2026-06-03T12:00:00.000Z' }),
        event({ id: 'post-b', itemId: 'b', isCorrect: false, createdAt: '2026-06-03T12:00:00.000Z' }),
      ],
    }));

    expect(progress.firstAttemptCount).toBe(2);
    expect(progress.correctCount).toBe(1);
    expect(progress.accuracy).toBe(0.5);
    expect(progress.distinctItemCount).toBe(2);
  });

  it('does not allow baseline-only evidence to complete a target', () => {
    const progress = calculateTargetProgress(target({
      baseline: baseline({ recentAccuracy: 1, attemptCount: 99, distinctItemCount: 99 }),
      minFirstAttempts: 1,
      minDistinctItems: 1,
      minActiveDays: 1,
      targetAccuracy: 0.8,
    }), input({ events: [], skillSummaries: [summary({ status: 'mastered' })] }));

    expect(progress.gates.sufficientPostBaselineEvidence).toBe(false);
    expect(progress.isComplete).toBe(false);
  });

  it('evaluates accuracy, attempts, distinct items, active days, hint rate, and misconception gates', () => {
    const t = target({
      minFirstAttempts: 4,
      minDistinctItems: 4,
      minActiveDays: 2,
      maxHintRate: 0.25,
      misconceptionTargets: ['fraction:unit'],
    });
    const progress = calculateTargetProgress(t, input({
      events: [
        event({ id: 'a', itemId: 'a', createdAt: '2026-06-02T12:00:00.000Z', hintUsed: false }),
        event({ id: 'b', itemId: 'b', createdAt: '2026-06-02T13:00:00.000Z', hintUsed: false }),
        event({ id: 'c', itemId: 'c', createdAt: '2026-06-03T12:00:00.000Z', hintUsed: false }),
        event({ id: 'd', itemId: 'd', createdAt: '2026-06-03T13:00:00.000Z', hintUsed: true }),
      ],
      itemStates: [state({ cardKey: 'template:a', lastItemId: 'a', mistakePatterns: ['fraction:unit'] })],
      skillSummaries: [summary({ status: 'mastered' })],
    }));

    expect(progress.gates.accuracy).toBe(true);
    expect(progress.gates.firstAttempts).toBe(true);
    expect(progress.gates.distinctItems).toBe(true);
    expect(progress.gates.activeDays).toBe(true);
    expect(progress.gates.hintRate).toBe(true);
    expect(progress.gates.misconceptions).toBe(false);
    expect(progress.isComplete).toBe(false);

    const cleared = calculateTargetProgress(t, input({
      events: progress.firstAttemptCount > 0 ? [
        event({ id: 'a2', itemId: 'a', createdAt: '2026-06-02T12:00:00.000Z' }),
        event({ id: 'b2', itemId: 'b', createdAt: '2026-06-02T13:00:00.000Z' }),
        event({ id: 'c2', itemId: 'c', createdAt: '2026-06-03T12:00:00.000Z' }),
        event({ id: 'd2', itemId: 'd', createdAt: '2026-06-03T13:00:00.000Z' }),
      ] : [],
      itemStates: [state({ cardKey: 'template:a', lastItemId: 'a', mistakePatterns: [] })],
      skillSummaries: [summary({ status: 'mastered' })],
    }));
    expect(cleared.isComplete).toBe(true);
  });

  it('requires due review work to be cleared for review_due targets', () => {
    const reviewTarget = target({
      reason: 'review_due',
      minFirstAttempts: 1,
      minDistinctItems: 1,
      minActiveDays: 1,
    });
    const stillDue = calculateTargetProgress(reviewTarget, input({
      events: [event({ id: 'post', itemId: 'a' })],
      itemStates: [state({ cardKey: 'template:a', lastItemId: 'a', nextDueAt: '2026-06-01T00:00:00.000Z' })],
      skillSummaries: [summary({ status: 'review_due', dueItemCount: 1 })],
    }));
    expect(stillDue.gates.skillStatus).toBe(false);
    expect(stillDue.isComplete).toBe(false);

    const cleared = calculateTargetProgress(reviewTarget, input({
      events: [event({ id: 'post', itemId: 'a' })],
      itemStates: [state({ cardKey: 'template:a', lastItemId: 'a', nextDueAt: '2026-06-20T00:00:00.000Z' })],
      skillSummaries: [summary({ status: 'strong', dueItemCount: 0 })],
    }));
    expect(cleared.gates.skillStatus).toBe(true);
    expect(cleared.isComplete).toBe(true);
  });

  it('uses the student timezone for active days and today counts', () => {
    const progress = calculateTargetProgress(target({
      minFirstAttempts: 2,
      minDistinctItems: 1,
      minActiveDays: 2,
    }), input({
      now: '2026-06-02T08:00:00.000Z',
      timezone: 'America/Los_Angeles',
      events: [
        event({ id: 'late-june-1-la', itemId: 'a', createdAt: '2026-06-02T06:30:00.000Z' }),
        event({ id: 'early-june-2-la', itemId: 'a', createdAt: '2026-06-02T07:30:00.000Z' }),
      ],
      skillSummaries: [summary({ status: 'mastered' })],
    }));

    expect(progress.activeDayCount).toBe(2);
    expect(progress.questionsCompletedToday).toBe(1);
  });
});

describe('goal lifecycle evaluation', () => {
  function completeProgress(g: LearningGoal) {
    return calculateGoalProgress(g, input({
      events: [
        event({ id: 'a', itemId: 'a', createdAt: '2026-06-02T12:00:00.000Z' }),
        event({ id: 'b', itemId: 'b', createdAt: '2026-06-03T12:00:00.000Z' }),
        event({ id: 'c', itemId: 'a', createdAt: '2026-06-04T12:00:00.000Z' }),
      ],
      skillSummaries: [summary({ status: 'mastered' })],
    }));
  }

  it('automatically completes targets and a single-target goal', () => {
    let seq = 0;
    const g = goal({ targets: [target()] });
    const result = evaluateGoalLifecycle(g, completeProgress(g), [], NOW, () => `ge-${++seq}`);

    expect(result.goal.status).toBe('completed');
    expect(result.goal.completedAt).toBe(NOW);
    expect(result.events.map(e => e.type)).toEqual(['target_completed', 'completed']);
  });

  it('automatically completes a multi-target goal only when all targets complete', () => {
    const secondTarget = target({ id: 'target-2', skillId: OTHER_SKILL_ID, minDistinctItems: 1 });
    const g = goal({ targets: [target(), secondTarget] });
    const progress = calculateGoalProgress(g, input({
      events: [
        event({ id: 'a', itemId: 'a', createdAt: '2026-06-02T12:00:00.000Z' }),
        event({ id: 'b', itemId: 'b', createdAt: '2026-06-03T12:00:00.000Z' }),
        event({ id: 'c', itemId: 'a', createdAt: '2026-06-04T12:00:00.000Z' }),
        event({ id: 'o1', itemId: 'other', createdAt: '2026-06-02T12:00:00.000Z' }),
        event({ id: 'o2', itemId: 'other', createdAt: '2026-06-03T12:00:00.000Z' }),
        event({ id: 'o3', itemId: 'other', createdAt: '2026-06-04T12:00:00.000Z' }),
      ],
      skillSummaries: [
        summary({ status: 'mastered' }),
        summary({ skillId: OTHER_SKILL_ID, status: 'mastered' }),
      ],
    }));
    const result = evaluateGoalLifecycle(g, progress, [], NOW, () => `ge-${Math.random()}`);

    expect(result.goal.status).toBe('completed');
    expect(result.events.filter(e => e.type === 'target_completed')).toHaveLength(2);
  });

  it('ends an expired incomplete goal and preserves history', () => {
    const g = goal({ targetDate: '2026-06-04' });
    const progress = calculateGoalProgress(g, input({ events: [] }));
    const result = evaluateGoalLifecycle(g, progress, [], NOW, () => 'ended-event');

    expect(result.goal.status).toBe('ended');
    expect(result.goal.endedAt).toBe(NOW);
    expect(result.events[0].type).toBe('ended');
  });

  it('is idempotent and does not append duplicate lifecycle events', () => {
    const g = goal({ targets: [target()] });
    const existing: GoalEvent[] = [
      { id: 'target-event', studentId: STUDENT_ID, goalId: g.id, targetId: 'target-1', type: 'target_completed', createdAt: NOW },
      { id: 'goal-event', studentId: STUDENT_ID, goalId: g.id, type: 'completed', createdAt: NOW },
    ];
    const result = evaluateGoalLifecycle(g, completeProgress(g), existing, NOW, () => 'new-event');

    expect(result.goal.status).toBe('completed');
    expect(result.events).toHaveLength(0);
  });

  it('creates pause and resume events through deterministic transitions', () => {
    const paused = transitionGoal(goal(), 'paused', NOW, () => 'pause-event');
    expect(paused.goal.status).toBe('paused');
    expect(paused.events[0].type).toBe('paused');

    const resumed = transitionGoal(paused.goal, 'resumed', '2026-06-06T12:00:00.000Z', () => 'resume-event');
    expect(resumed.goal.status).toBe('active');
    expect(resumed.events[0].type).toBe('resumed');
  });
});

describe('goal target editing', () => {
  it('preserves unchanged baselines and captures baselines for new targets', () => {
    const oldBaseline = baseline({ capturedAt: '2026-06-01T00:00:00.000Z' });
    const newBaseline = baseline({ capturedAt: '2026-06-05T00:00:00.000Z', status: 'new' });
    const existing = [target({ id: 'target-old', skillId: SKILL_ID, baseline: oldBaseline })];

    const result = applyGoalTargetEdits(
      existing,
      [
        { id: 'target-old', skillId: SKILL_ID, reason: 'needs_practice', targetAccuracy: 0.9 },
        { skillId: OTHER_SKILL_ID, reason: 'needs_evaluation' },
      ],
      skillId => skillId === OTHER_SKILL_ID ? newBaseline : baseline(),
      () => 'target-new',
    );

    expect(result[0].baseline).toBe(oldBaseline);
    expect(result[0].targetAccuracy).toBe(0.9);
    expect(result[1].id).toBe('target-new');
    expect(result[1].baseline).toBe(newBaseline);
  });
});
