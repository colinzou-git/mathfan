import { describe, expect, it } from 'vitest';
import { allocateLessonSegments, estimateItemSeconds, planDailyLesson } from '../features/learningPlan/dailyLessonPlanner';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import type { LearningGoal } from '../features/goals/types';
import type { StudentSkillSummary } from '../features/mastery/skillMasteryEngine';
import type { StudentItemState, StudentSettings } from '../types/math';
import { deriveCardKeyFromItemId } from '../features/scheduler/cardModel';
import { mulberry32 } from '../utils/rng';

const studentId = 'lesson-student';
const now = '2026-07-15T12:00:00.000Z';
const settings: StudentSettings = { audioEnabled: true, speechRate: 1, dailyGoalMinutes: 10, sessionLength: 10, autoAdvance: true, theme: 'indigo', allowTimedMode: false, competitionModeEnabled: false, parentModeEnabled: false };
const summary = (skillId: string, status: StudentSkillSummary['status'], accuracy = 0): StudentSkillSummary => ({ studentId, skillId, status, attemptCount: status === 'new' ? 0 : 5, correctCount: Math.round(accuracy * 5), accuracy, dueItemCount: status === 'review_due' ? 1 : 0, itemCount: status === 'new' ? 0 : 5, mistakePatterns: [] });
const state = (id: string, nextDueAt: string): StudentItemState => ({ studentId, cardKey: deriveCardKeyFromItemId(id), lastItemId: id, skillId: 'skill', attemptCount: 2, correctCount: 1, lastCorrect: false, lastLatencyMs: 2000, medianLatencyMs: 2000, ease: 2.5, stabilityDays: 1, difficulty: .4, masteryLevel: 'learning', mistakePatterns: [], nextDueAt });
const goal = (id: string): LearningGoal => ({ id, studentId, title: id, source: 'manual', status: 'active', portfolioRole: 'primary', durationDays: 10, startDate: '2026-07-10', targetDate: '2026-07-20', targets: [{ id: `target-${id}`, skillId: 'g3-frac-unit', reason: 'needs_practice', baseline: { capturedAt: '2026-07-10T00:00:00.000Z', status: 'new', attemptCount: 0, distinctItemCount: 0, recentAccuracy: 0, dueItemCount: 0, mistakePatterns: [], hintRate: 0 }, targetAccuracy: .8, minFirstAttempts: 8, minDistinctItems: 4, minActiveDays: 2, maxHintRate: .2, misconceptionTargets: [], weight: 1 }], createdAt: now, updatedAt: now });

function args(overrides: Partial<Parameters<typeof planDailyLesson>[0]> = {}): Parameters<typeof planDailyLesson>[0] {
  return { studentId, gradeLevel: 3, now, timezone: 'UTC', settings, events: [], itemStates: [state('MUL_3x4', '2026-07-10T00:00:00.000Z'), state('MUL_4x3', '2026-07-09T00:00:00.000Z'), state('DIV_12d3', '2026-07-08T00:00:00.000Z'), state('FCMP_1_4_3_4', '2026-07-07T00:00:00.000Z')], skillSummaries: [summary('g3-frac-unit', 'needs_practice', .4), summary('g3-mul-tables-basic', 'strong', .9), summary('g3-div-within-100', 'review_due', .7)], goals: [goal('a'), goal('b')], rng: mulberry32(12), ...overrides };
}

describe('adaptive daily lesson planning', () => {
  it('is deterministic and stays near the target-time policy', () => {
    const first = planDailyLesson(args({ rng: mulberry32(44) }));
    const second = planDailyLesson(args({ rng: mulberry32(44) }));
    expect(first).toEqual(second);
    expect(first.estimatedMinutes).toBeGreaterThanOrEqual(1);
    expect(first.estimatedMinutes).toBeLessThanOrEqual(15);
    expect(first.items.length).toBeGreaterThanOrEqual(8);
  });

  it('uses unique due scheduling cards and only one focus skill', () => {
    const plan = planDailyLesson(args());
    const retrieval = plan.items.filter(value => value.segment === 'retrieval');
    expect(new Set(retrieval.map(value => value.cardKey)).size).toBe(retrieval.length);
    expect(retrieval.filter(value => value.item.id === 'MUL_3x4' || value.item.id === 'MUL_4x3')).toHaveLength(1);
    expect(plan.focusSkillId).toBe('g3-frac-unit');
    expect(new Set(plan.items.filter(value => value.segment === 'focus').map(value => value.item.skillId)).size).toBeGreaterThanOrEqual(1);
  });

  it('does not multiply focus items for overlapping goals', () => {
    const oneGoal = planDailyLesson(args({ goals: [goal('a')], rng: mulberry32(9) }));
    const twoGoals = planDailyLesson(args({ goals: [goal('a'), goal('b')], rng: mulberry32(9) }));
    expect(twoGoals.segmentCounts.focus).toBe(oneGoal.segmentCounts.focus);
  });

  it('uses advisory prerequisite warnings rather than hard locks', () => {
    const plan = planDailyLesson(args({ skillSummaries: [summary('g3-div-decomposition', 'needs_practice', .2)], goals: [], rng: mulberry32(3) }));
    expect(plan.focusSkillId).toBe('g3-div-decomposition');
    expect(plan.warnings.map(value => value.code)).toContain('unmet_prerequisite');
    expect(plan.segmentCounts.focus).toBeGreaterThan(0);
  });

  it('handles no due cards, no goals, and sparse transfer without duplication', () => {
    const plan = planDailyLesson(args({ itemStates: [], goals: [], skillSummaries: [summary('g3-frac-unit', 'new')], rng: mulberry32(2) }));
    expect(plan.segmentCounts.retrieval).toBe(0);
    expect(plan.items.length).toBeGreaterThan(0);
    const scheduling = plan.items.filter(value => value.schedulingEligible);
    expect(new Set(scheduling.map(value => value.cardKey)).size).toBe(scheduling.length);
  });

  it('uses task-aware estimates and bounded segment allocation', () => {
    expect(estimateItemSeconds(makeItemFromId('MUL_3x4')!, [])).toBe(20);
    expect(estimateItemSeconds(makeItemFromId('WRD2_muls_4_5_8')!, [])).toBe(45);
    expect(allocateLessonSegments(600, { retrieval: 20, focus: 20, transfer: 20 })).toEqual({ retrieval: 5, focus: 10, transfer: 5 });
  });
});
