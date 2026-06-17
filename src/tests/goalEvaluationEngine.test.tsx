import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { AdaptiveGoalEvaluationResponse } from '../features/goals/goalEvaluationEngine';
import type { StudentItemState } from '../types/math';
import { checkAnswer } from '../features/practice/answerChecker';
import { QuestionRenderer } from '../features/practice/QuestionRenderer';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import {
  ADAPTIVE_GOAL_EVALUATION_HISTORICAL_PRIOR_CAP,
  ADAPTIVE_GOAL_EVALUATION_QUESTION_COUNT,
  buildAdaptiveGoalEvaluationResult,
  buildAdaptiveGoalSkillEvidence,
  planFullAdaptiveGoalEvaluation,
  selectNextAdaptiveGoalEvaluationItem,
  validateAdaptiveGoalEvaluationCatalogue,
} from '../features/goals/goalEvaluationEngine';
import { GRADE3_MASTERY_MAP, type Grade3Domain } from '../features/mastery/grade3MasteryMap';

const STUDENT_ID = 'student-1';
const NOW = '2026-06-17T12:00:00.000Z';
const EMPTY_STATES: StudentItemState[] = [];
const EMPTY_EVENTS: MathAnswerEvent[] = [];

function baseArgs(overrides: Partial<Parameters<typeof selectNextAdaptiveGoalEvaluationItem>[0]> = {}) {
  return {
    studentId: STUDENT_ID,
    seed: 12345,
    now: NOW,
    mathAnswerEvents: EMPTY_EVENTS,
    itemStates: EMPTY_STATES,
    responses: [],
    ...overrides,
  };
}

function itemIdForSkill(skillId: string, index = 0): string {
  const ids = planPracticeForSkill(skillId, { sessionLength: 40 }).specificItemIds ?? [];
  const itemId = ids[index];
  if (!itemId) throw new Error(`No item for ${skillId}`);
  const item = makeItemFromId(itemId);
  if (!item) throw new Error(`Unresolved item ${itemId}`);
  return itemId;
}

function response(skillId: string, isCorrect: boolean, index = 0): AdaptiveGoalEvaluationResponse {
  return {
    itemId: itemIdForSkill(skillId, index),
    skillId,
    isCorrect,
  };
}

function event(overrides: Partial<MathAnswerEvent>): MathAnswerEvent {
  return {
    id: overrides.id ?? 'event-1',
    studentId: STUDENT_ID,
    sessionId: 'session-1',
    itemId: itemIdForSkill('g3-mul-tables-basic'),
    mode: 'practice',
    promptShown: 'Question',
    correctAnswer: 1,
    studentAnswer: 1,
    isCorrect: true,
    isRetry: false,
    hintUsed: false,
    latencyMs: 1000,
    createdAt: '2026-06-01T12:00:00.000Z',
    ...overrides,
  };
}

function fullPlan(seed = 12345, strategy?: (n: number) => boolean) {
  return planFullAdaptiveGoalEvaluation({
    studentId: STUDENT_ID,
    seed,
    now: NOW,
    mathAnswerEvents: EMPTY_EVENTS,
    itemStates: EMPTY_STATES,
    responseStrategy: selection => strategy?.(selection.questionNumber) ?? true,
  });
}

function selectedResponses(strategy?: (n: number) => boolean): AdaptiveGoalEvaluationResponse[] {
  return fullPlan(12345, strategy).map(selection => ({
    itemId: selection.item.id,
    skillId: selection.skillId,
    isCorrect: strategy?.(selection.questionNumber) ?? true,
  }));
}

describe('Adaptive Goal Evaluation catalogue', () => {
  it('has enough resolved items across every Grade 3 domain', () => {
    expect(validateAdaptiveGoalEvaluationCatalogue(baseArgs())).toEqual([]);
  });

  it('detects impossible catalogue gaps instead of looping', () => {
    const problems = validateAdaptiveGoalEvaluationCatalogue(baseArgs({
      itemPoolForSkill: () => ({ mode: 'daily_review', sessionLength: 1, specificItemIds: [] }),
    }));
    expect(problems.length).toBeGreaterThan(0);
    expect(() => selectNextAdaptiveGoalEvaluationItem(baseArgs({
      itemPoolForSkill: () => ({ mode: 'daily_review', sessionLength: 1, specificItemIds: [] }),
    }))).toThrow(/catalogue is incomplete/i);
  });
});

describe('Adaptive Goal Evaluation planning constraints', () => {
  it('plans exactly 30 questions with no duplicate item IDs', () => {
    const plan = fullPlan();
    expect(plan).toHaveLength(ADAPTIVE_GOAL_EVALUATION_QUESTION_COUNT);
    expect(new Set(plan.map(selection => selection.item.id)).size).toBe(plan.length);
  });

  it('covers all seven domains during broad screening', () => {
    const plan = fullPlan();
    const firstTenDomains = new Set(plan.slice(0, 10).map(selection => selection.domain));
    expect(firstTenDomains).toEqual(new Set<Grade3Domain>([
      'multiplication',
      'division',
      'fractions',
      'area_perimeter',
      'geometry',
      'addition_subtraction',
      'measurement_data',
    ]));
  });

  it('never asks more than two consecutive questions from one domain', () => {
    const plan = fullPlan();
    for (let i = 2; i < plan.length; i++) {
      expect([
        plan[i - 2].domain,
        plan[i - 1].domain,
        plan[i].domain,
      ]).not.toEqual([plan[i].domain, plan[i].domain, plan[i].domain]);
    }
  });

  it('is deterministic for the same seed and response path', () => {
    const first = fullPlan(99, n => n % 2 === 0);
    const second = fullPlan(99, n => n % 2 === 0);
    expect(second.map(selection => selection.item.id)).toEqual(first.map(selection => selection.item.id));
  });

  it('takes different paths after different response sequences', () => {
    const correct = fullPlan(99, () => true).map(selection => selection.item.id);
    const incorrect = fullPlan(99, () => false).map(selection => selection.item.id);
    expect(incorrect).not.toEqual(correct);
  });

  it('uses the final six questions to confirm three candidates with distinct pairs', () => {
    const plan = fullPlan(12345, n => n % 3 !== 0);
    const finalSix = plan.slice(24);
    expect(finalSix.map(selection => selection.phase)).toEqual([
      'confirmation',
      'confirmation',
      'confirmation',
      'confirmation',
      'confirmation',
      'confirmation',
    ]);
    expect(finalSix[0].skillId).toBe(finalSix[1].skillId);
    expect(finalSix[2].skillId).toBe(finalSix[3].skillId);
    expect(finalSix[4].skillId).toBe(finalSix[5].skillId);
    expect(new Set(finalSix.map(selection => selection.skillId)).size).toBe(3);
    expect(new Set(finalSix.map(selection => selection.item.id)).size).toBe(6);
  });

  it('selects only items that resolve, render, and can be checked', () => {
    const plan = fullPlan();
    for (const selection of plan) {
      const item = makeItemFromId(selection.item.id);
      expect(item).toBeTruthy();
      render(<QuestionRenderer item={selection.item} />);
      const result = checkAnswer(selection.item, String(selection.item.answer), 1000);
      expect(result.isCorrect).toBe(true);
    }
  });
});

describe('Adaptive Goal Evaluation adaptive behavior', () => {
  it('incorrect responses can route to prerequisites or another representation of the same concept', () => {
    const responses = [
      response('g3-mul-meaning', true, 0),
      response('g3-frac-unit', true, 0),
      response('g3-area-concept', true, 0),
      response('g3-geo-categories', true, 0),
      response('g3-time-to-minute', true, 0),
      response('g3-add-2digit-regrouping', true, 0),
      response('g3-div-meaning', true, 0),
      response('g3-perimeter', true, 0),
      response('g3-round-nearest-10-100', true, 0),
      response('g3-div-within-100', false, 0),
    ];
    const selection = selectNextAdaptiveGoalEvaluationItem(baseArgs({ responses }))!;
    expect(['g3-div-meaning', 'g3-mul-tables-basic', 'g3-div-within-100']).toContain(selection.skillId);
  });

  it('correct responses can advance to dependent or harder skills', () => {
    const responses = [
      response('g3-mul-meaning', true, 0),
      response('g3-frac-unit', true, 0),
      response('g3-area-concept', true, 0),
      response('g3-geo-categories', true, 0),
      response('g3-time-to-minute', true, 0),
      response('g3-add-2digit-regrouping', true, 0),
      response('g3-div-meaning', true, 0),
      response('g3-perimeter', true, 0),
      response('g3-round-nearest-10-100', true, 0),
      response('g3-mul-tables-basic', true, 0),
    ];
    const selection = selectNextAdaptiveGoalEvaluationItem(baseArgs({ responses }))!;
    expect([
      'g3-mul-tables-advanced',
      'g3-div-within-100',
      'g3-area-formula',
      'g3-mul-multiple-of-10',
      'g3-patterns-arithmetic',
      'g3-mul-tables-basic',
    ]).toContain(selection.skillId);
  });
});

describe('Adaptive Goal Evaluation evidence model', () => {
  it('uses sparse no-history priors', () => {
    const evidence = buildAdaptiveGoalSkillEvidence(baseArgs()).find(item => item.skillId === 'g3-frac-unit')!;
    expect(evidence.alpha).toBe(2);
    expect(evidence.beta).toBe(2);
    expect(evidence.mean).toBe(0.5);
  });

  it('caps historical pseudo-count influence', () => {
    const events = Array.from({ length: 80 }, (_, i) =>
      event({
        id: `hist-${i}`,
        itemId: itemIdForSkill('g3-mul-tables-basic', i % 10),
        isCorrect: true,
        createdAt: `2026-05-${String((i % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
      }),
    );
    const evidence = buildAdaptiveGoalSkillEvidence(baseArgs({ mathAnswerEvents: events }))
      .find(item => item.skillId === 'g3-mul-tables-basic')!;
    expect(evidence.historicalWeight).toBeLessThanOrEqual(ADAPTIVE_GOAL_EVALUATION_HISTORICAL_PRIOR_CAP);
    expect(evidence.alpha + evidence.beta).toBeLessThanOrEqual(4 + ADAPTIVE_GOAL_EVALUATION_HISTORICAL_PRIOR_CAP);
  });

  it('produces recommendation-ready strengths, skills to strengthen, ready-next skills, and top candidates', () => {
    const responses = selectedResponses(n => n % 4 !== 0);
    const result = buildAdaptiveGoalEvaluationResult(baseArgs({ responses }));
    expect(result.topGoalCandidates).toHaveLength(3);
    expect(result.evidence.length).toBe(GRADE3_MASTERY_MAP.length);
    expect(result.strengths.length + result.skillsToStrengthen.length + result.skillsReadyToLearnNext.length)
      .toBeGreaterThan(0);
  });
});
