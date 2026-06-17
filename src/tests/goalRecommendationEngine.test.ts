import { describe, expect, it } from 'vitest';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { StudentSkillSummary } from '../features/mastery/skillMasteryEngine';
import type { LearningGoal } from '../features/goals/types';
import type { StudentItemState, StudentSettings } from '../types/math';
import {
  estimateGoalWorkload,
  recommendLearningGoals,
  type GoalRecommendationArgs,
} from '../features/goals/goalRecommendationEngine';

const STUDENT_ID = 'student-1';
const NOW = '2026-06-15T12:00:00.000Z';
const TZ = 'America/Los_Angeles';

const itemSkill: Record<string, string> = {
  basicA: 'g3-mul-tables-basic',
  basicB: 'g3-mul-tables-basic',
  advancedA: 'g3-mul-tables-advanced',
  fracUnitA: 'g3-frac-unit',
  fracEqA: 'g3-frac-equivalent',
  areaA: 'g3-area-concept',
};

function resolveSkillId(itemId: string): string | null {
  return itemSkill[itemId] ?? null;
}

function settings(overrides: Partial<StudentSettings> = {}): StudentSettings {
  return {
    audioEnabled: false,
    speechRate: 1,
    dailyGoalMinutes: 10,
    sessionLength: 10,
    autoAdvance: true,
    theme: 'indigo',
    allowTimedMode: false,
    competitionModeEnabled: false,
    parentModeEnabled: false,
    ...overrides,
  };
}

function summary(
  skillId: string,
  status: StudentSkillSummary['status'],
  overrides: Partial<StudentSkillSummary> = {},
): StudentSkillSummary {
  return {
    studentId: STUDENT_ID,
    skillId,
    status,
    attemptCount: status === 'new' ? 0 : 8,
    correctCount: status === 'needs_practice' ? 3 : status === 'new' ? 0 : 7,
    accuracy: status === 'needs_practice' ? 0.38 : status === 'new' ? 0 : 0.88,
    dueItemCount: status === 'review_due' ? 2 : 0,
    itemCount: status === 'new' ? 0 : 3,
    mistakePatterns: [],
    ...overrides,
  };
}

function event(overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return {
    id: overrides.id ?? `event-${Math.random()}`,
    studentId: STUDENT_ID,
    sessionId: 'session-1',
    itemId: 'basicA',
    mode: 'practice',
    promptShown: 'Question',
    correctAnswer: 1,
    studentAnswer: 1,
    isCorrect: true,
    isRetry: false,
    hintUsed: false,
    latencyMs: 1000,
    createdAt: '2026-06-14T12:00:00.000Z',
    ...overrides,
  };
}

function state(overrides: Partial<StudentItemState> = {}): StudentItemState {
  return {
    studentId: STUDENT_ID,
    itemId: 'basicA',
    skillId: 'g3-mul-tables-basic',
    attemptCount: 5,
    correctCount: 3,
    lastCorrect: false,
    lastLatencyMs: 1000,
    medianLatencyMs: 1000,
    ease: 2.5,
    stabilityDays: 1,
    difficulty: 0.3,
    masteryLevel: 'learning',
    mistakePatterns: [],
    ...overrides,
  };
}

function activeGoal(skillId: string): LearningGoal {
  return {
    id: `goal-${skillId}`,
    studentId: STUDENT_ID,
    title: 'Existing goal',
    source: 'manual',
    status: 'active',
    durationDays: 7,
    startDate: '2026-06-10',
    targetDate: '2026-06-17',
    createdAt: '2026-06-10T12:00:00.000Z',
    updatedAt: '2026-06-10T12:00:00.000Z',
    targets: [{
      id: `target-${skillId}`,
      skillId,
      reason: 'needs_practice',
      baseline: {
        capturedAt: '2026-06-10T12:00:00.000Z',
        status: 'needs_practice',
        attemptCount: 0,
        distinctItemCount: 0,
        recentAccuracy: 0,
        dueItemCount: 0,
        mistakePatterns: [],
        hintRate: 0,
      },
      targetAccuracy: 0.8,
      minFirstAttempts: 10,
      minDistinctItems: 4,
      minActiveDays: 2,
      maxHintRate: 0.25,
      misconceptionTargets: [],
      weight: 1,
    }],
  };
}

function args(overrides: Partial<GoalRecommendationArgs> = {}): GoalRecommendationArgs {
  return {
    studentId: STUDENT_ID,
    skillSummaries: [],
    events: [],
    itemStates: [],
    activeGoals: [],
    settings: settings(),
    durationDays: 7,
    now: NOW,
    timezone: TZ,
    resolveSkillId,
    ...overrides,
  };
}

describe('goal recommendation eligibility and ranking', () => {
  it('excludes a stable mastered skill', () => {
    const result = recommendLearningGoals(args({
      skillSummaries: [summary('g3-mul-tables-basic', 'mastered', { accuracy: 1 })],
    }));
    expect(result.candidates.some(candidate => candidate.skillId === 'g3-mul-tables-basic')).toBe(false);
  });

  it('keeps a mastered skill eligible when due-review evidence exists', () => {
    const result = recommendLearningGoals(args({
      skillSummaries: [summary('g3-mul-tables-basic', 'mastered', { accuracy: 1 })],
      itemStates: [state({ itemId: 'basicA', nextDueAt: '2026-06-10T12:00:00.000Z' })],
    }));
    const candidate = result.candidates.find(c => c.skillId === 'g3-mul-tables-basic');
    expect(candidate?.primaryReason).toBe('Review now');
    expect(candidate?.dueItemCount).toBe(1);
  });

  it('ranks a review-due skill highly', () => {
    const result = recommendLearningGoals(args({
      skillSummaries: [
        summary('g3-mul-tables-basic', 'review_due'),
        summary('g3-frac-unit', 'new'),
      ],
      itemStates: [
        state({ itemId: 'basicA', nextDueAt: '2026-06-10T12:00:00.000Z' }),
        state({ itemId: 'basicB', nextDueAt: '2026-06-12T12:00:00.000Z' }),
      ],
    }));
    expect(result.recommendations[0].skillIds).toContain('g3-mul-tables-basic');
    expect(result.recommendations[0].primaryReason).toBe('Review now');
  });

  it('lets a weak skill outrank an unrelated new skill', () => {
    const wrongs = Array.from({ length: 10 }, (_, i) =>
      event({ id: `wrong-${i}`, itemId: 'basicA', isCorrect: false, createdAt: `2026-06-1${i % 5}T12:00:00.000Z` }),
    );
    const result = recommendLearningGoals(args({
      skillSummaries: [
        summary('g3-mul-tables-basic', 'needs_practice'),
        summary('g3-frac-unit', 'new'),
      ],
      events: wrongs,
    }));
    expect(result.candidates[0].skillId).toBe('g3-mul-tables-basic');
    expect(result.candidates[0].primaryReason).toBe('Strengthen a weak skill');
  });

  it('gives continuation value to a positive-progress skill', () => {
    const events = [
      event({ id: 'old-1', itemId: 'basicA', isCorrect: false, createdAt: '2026-06-01T12:00:00.000Z' }),
      event({ id: 'old-2', itemId: 'basicA', isCorrect: false, createdAt: '2026-06-02T12:00:00.000Z' }),
      event({ id: 'old-3', itemId: 'basicA', isCorrect: false, createdAt: '2026-06-03T12:00:00.000Z' }),
      event({ id: 'new-1', itemId: 'basicB', isCorrect: true, createdAt: '2026-06-11T12:00:00.000Z' }),
      event({ id: 'new-2', itemId: 'basicB', isCorrect: true, createdAt: '2026-06-12T12:00:00.000Z' }),
      event({ id: 'new-3', itemId: 'basicB', isCorrect: true, createdAt: '2026-06-13T12:00:00.000Z' }),
    ];
    const result = recommendLearningGoals(args({
      skillSummaries: [summary('g3-mul-tables-basic', 'strong')],
      events,
    }));
    const candidate = result.candidates.find(c => c.skillId === 'g3-mul-tables-basic')!;
    expect(candidate.features.progressContinuation).toBeGreaterThan(0);
    expect(candidate.primaryReason).toBe('Keep the progress going');
  });

  it('recommends a ready frontier skill and demotes unmet prerequisites without excluding them', () => {
    const result = recommendLearningGoals(args({
      skillSummaries: [
        summary('g3-frac-unit', 'strong'),
        summary('g3-frac-equivalent', 'new'),
        summary('g3-frac-compare', 'new'),
      ],
    }));
    const equivalent = result.candidates.find(c => c.skillId === 'g3-frac-equivalent')!;
    const compare = result.candidates.find(c => c.skillId === 'g3-frac-compare')!;
    expect(equivalent.primaryReason).toBe('Ready to learn next');
    expect(compare).toBeDefined();
    expect(equivalent.score).toBeGreaterThan(compare.score);
    expect(compare.prerequisiteAdvisories).toContain('Equivalent Fractions');
  });

  it('penalizes active goal overlap', () => {
    const base = args({
      skillSummaries: [summary('g3-mul-tables-basic', 'needs_practice')],
      events: [event({ id: 'wrong', itemId: 'basicA', isCorrect: false })],
    });
    const withoutOverlap = recommendLearningGoals(base).candidates.find(c => c.skillId === 'g3-mul-tables-basic')!;
    const withOverlap = recommendLearningGoals({ ...base, activeGoals: [activeGoal('g3-mul-tables-basic')] })
      .candidates.find(c => c.skillId === 'g3-mul-tables-basic')!;
    expect(withOverlap.features.activeGoalOverlap).toBe(1);
    expect(withOverlap.score).toBeLessThan(withoutOverlap.score);
  });

  it('smooths sparse evidence and raises priority for repeated misconceptions', () => {
    const sparse = recommendLearningGoals(args({
      skillSummaries: [summary('g3-mul-tables-basic', 'needs_practice')],
      events: [event({ id: 'one-wrong', itemId: 'basicA', isCorrect: false })],
      itemStates: [state({ itemId: 'basicA', mistakePatterns: ['mul:neighbor_fact', 'mul:skip_count_error'] })],
    })).candidates.find(c => c.skillId === 'g3-mul-tables-basic')!;

    expect(sparse.features.weakness).toBeLessThan(0.7);
    expect(sparse.features.misconceptionSeverity).toBeGreaterThan(0);
    expect(sparse.misconceptionCount).toBe(2);
  });
});

describe('goal recommendation workload and output', () => {
  it('uses the no-history capacity fallback', () => {
    const capacity = estimateGoalWorkload(args({
      settings: settings({ dailyGoalMinutes: 20 }),
      events: [],
    }));
    expect(capacity.recentMedianQuestionsPerActiveDay).toBeNull();
    expect(capacity.questionsPerDay).toBe(12);
    expect(capacity.fallbackQuestionsPerDay).toBe(12);
  });

  it('uses duration to change bundle size and workload', () => {
    const oneDay = recommendLearningGoals(args({ durationDays: 1 }));
    const tenDays = recommendLearningGoals(args({ durationDays: 10 }));

    expect(oneDay.recommendations[0].skillIds).toHaveLength(1);
    expect(tenDays.recommendations[0].skillIds.length).toBeLessThanOrEqual(3);
    expect(tenDays.capacity.totalQuestions).toBe(tenDays.capacity.questionsPerDay * 10);
  });

  it('keeps estimates feasible and marks stretch behavior explicitly', () => {
    const result = recommendLearningGoals(args({
      durationDays: 1,
      settings: settings({ dailyGoalMinutes: 2 }),
      skillSummaries: [summary('g3-mul-tables-basic', 'needs_practice')],
      events: Array.from({ length: 8 }, (_, i) =>
        event({ id: `wrong-${i}`, itemId: 'basicA', isCorrect: false }),
      ),
    }));
    const rec = result.recommendations[0];
    expect(rec.estimatedQuestionsPerDay).toBeGreaterThanOrEqual(8);
    expect(rec.estimatedQuestionsPerDay).toBeLessThanOrEqual(40);
    expect(rec.estimatedMinutesPerDay).toBe(Math.ceil(rec.estimatedQuestionsPerDay * 20 / 60));
    expect(rec.isStretch).toBe(true);
  });

  it('is deterministic and avoids duplicate skill bundles', () => {
    const first = recommendLearningGoals(args({ durationDays: 7 }));
    const second = recommendLearningGoals(args({ durationDays: 7 }));
    expect(second.recommendations.map(r => r.skillIds)).toEqual(first.recommendations.map(r => r.skillIds));
    expect(new Set(first.recommendations.map(r => r.skillIds.join('|'))).size).toBe(first.recommendations.length);
  });

  it('builds explanations only from evidence that is present', () => {
    const due = recommendLearningGoals(args({
      skillSummaries: [summary('g3-mul-tables-basic', 'review_due')],
      itemStates: [state({ itemId: 'basicA', nextDueAt: '2026-06-14T12:00:00.000Z' })],
    })).candidates.find(c => c.skillId === 'g3-mul-tables-basic')!;
    expect(due.explanation).toContain('1 due item');

    const evaluate = recommendLearningGoals(args({
      skillSummaries: [summary('g3-area-concept', 'new')],
    })).candidates.find(c => c.skillId === 'g3-area-concept')!;
    expect(evaluate.explanation).not.toContain('due item');
  });
});
