import { describe, expect, it } from 'vitest';
import { planDailyNewForGoals } from '../features/goals/dailyNewGoalPlanner';
import {
  allocateGoalWorkload, analyzeGoalPortfolio, dedupeGoalAttribution, recommendedGoalLifecycleActions,
} from '../features/goals/goalPortfolioEngine';
import { calculateGoalProgress, type GoalEvidenceInput } from '../features/goals/goalEngine';
import type { GoalSkillTarget, LearningGoal } from '../features/goals/types';

const now = '2026-07-15T12:00:00.000Z';
const studentId = 'portfolio-student';
const target = (id: string, skillId = 'g3-mul-meaning'): GoalSkillTarget => ({
  id, skillId, reason: 'needs_evaluation', baseline: { capturedAt: '2026-07-01T00:00:00.000Z', status: 'new', attemptCount: 0, distinctItemCount: 0, recentAccuracy: 0, dueItemCount: 0, mistakePatterns: [], hintRate: 0 },
  targetAccuracy: .8, minFirstAttempts: 6, minDistinctItems: 4, minActiveDays: 2, maxHintRate: .25, misconceptionTargets: [], weight: 1,
});
const goal = (id: string, overrides: Partial<LearningGoal> = {}): LearningGoal => ({
  id, studentId, title: `Goal ${id}`, source: 'manual', status: 'active', durationDays: 14,
  startDate: '2026-07-01', targetDate: '2026-07-20', targets: [target(`target-${id}`)],
  createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z', ...overrides,
});
const evidence: GoalEvidenceInput = { studentId, events: [], itemStates: [], skillSummaries: [], now, timezone: 'UTC' };

describe('goal portfolio consolidation', () => {
  it('consolidates three overlapping goals without summing urgency', () => {
    const goals = [goal('a', { priorityRank: 2 }), goal('b', { priorityRank: 1 }), goal('c', { portfolioRole: 'maintenance' })];
    const analysis = analyzeGoalPortfolio({ goals, evidence, dailyNewGoalQuestionLimits: { maxQuestionsPerSkillTile: 5, maxPlannedQuestionsPerDay: 8 } });
    expect(analysis.consolidatedTargets).toHaveLength(1);
    expect(analysis.consolidatedTargets[0].contributions).toHaveLength(3);
    expect(analysis.consolidatedTargets[0].effectivePriority).toBe(Math.max(...analysis.consolidatedTargets[0].contributions.map(value => value.urgency)));
    expect(analysis.warnings.map(warning => warning.code)).toContain('overlapping_skill_targets');
    expect(analysis.activeGoals.map(value => value.id)).toEqual(['b', 'a', 'c']);
  });

  it('produces one daily quota with attribution to every overlapping goal', () => {
    const goals = [goal('a'), goal('b'), goal('c')];
    const plan = planDailyNewForGoals({ studentId, goals, events: [], itemStates: [], skillSummaries: [], now, timezone: 'UTC', dailyNewGoalQuestionLimits: { maxPlannedQuestionsPerDay: 6 } });
    expect(plan.tiles).toHaveLength(1);
    expect(plan.tiles[0].goalIds).toEqual(['a', 'b', 'c']);
    expect(plan.tiles[0].questionCount).toBeLessThanOrEqual(6);
  });

  it('allocates primary before maintenance within question and time caps', () => {
    const analysis = analyzeGoalPortfolio({ goals: [goal('primary'), goal('maint', { portfolioRole: 'maintenance', targets: [target('maint-target', 'g3-frac-unit')] })], evidence });
    const allocation = allocateGoalWorkload(analysis.consolidatedTargets, { maxNewQuestions: 5, maxEstimatedMinutes: 3, reservedReviewMinutes: 1 });
    expect(allocation.totalQuestions).toBeLessThanOrEqual(5);
    expect(allocation.allocations[0].goalIds).toContain('primary');
  });

  it('warns but does not block a crowded legacy-compatible portfolio', () => {
    const analysis = analyzeGoalPortfolio({ goals: [goal('a'), goal('b'), goal('c'), goal('d')], evidence });
    expect(analysis.activeGoals).toHaveLength(4);
    expect(analysis.warnings.map(warning => warning.code)).toEqual(expect.arrayContaining(['too_many_primary_goals', 'too_many_active_goals']));
    expect(analysis.activeGoals.every(value => (value.portfolioRole ?? 'primary') === 'primary')).toBe(true);
  });

  it('recommends lifecycle choices without mutating overdue status', () => {
    const overdue = goal('late', { targetDate: '2026-07-01' });
    const progress = calculateGoalProgress(overdue, evidence);
    expect(recommendedGoalLifecycleActions(overdue, progress, now).map(value => value.action)).toEqual([
      'extend_target_date', 'edit_targets', 'move_to_maintenance', 'pause', 'end_goal', 'keep_active',
    ]);
    expect(overdue.status).toBe('active');
  });

  it('deduplicates multi-goal attribution without creating another event', () => {
    expect(dedupeGoalAttribution(['a', 'a', 'b'], ['ta', 'ta', 'tb'])).toEqual({ goalIds: ['a', 'b'], targetIds: ['ta', 'tb'] });
  });
});
