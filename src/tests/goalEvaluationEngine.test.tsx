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
  buildSelectionHistory,
  itemScore,
  planFullAdaptiveGoalEvaluation,
  selectNextAdaptiveGoalEvaluationItem,
  validateAdaptiveGoalEvaluationCatalogue,
} from '../features/goals/goalEvaluationEngine';
import type { AdaptiveGoalEvaluationItem, AdaptiveGoalSkillEvidence } from '../features/goals/goalEvaluationEngine';
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

  it('marks only the first selected item for each canonical card as scheduling eligible', () => {
    const plan = fullPlan();
    const scheduled = new Set<string>();
    for (const selection of plan) {
      expect(selection.schedulingEligible).toBe(!scheduled.has(selection.cardKey));
      expect(selection.schedulingReason).toBe(
        selection.schedulingEligible ? 'first_card_evidence' : 'same_evaluation_template_repeat',
      );
      if (selection.schedulingEligible) scheduled.add(selection.cardKey);
    }
    expect(plan).toHaveLength(30);
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

  it('is independent of candidate catalogue order', () => {
    const skillId = 'g3-mul-tables-basic';
    const ids = planPracticeForSkill(skillId, { sessionLength: 40 }).specificItemIds ?? [];
    const forward = selectNextAdaptiveGoalEvaluationItem(baseArgs({
      itemPoolForSkill: id => ({
        mode: 'daily_review', sessionLength: 40,
        specificItemIds: id === skillId ? ids : planPracticeForSkill(id, { sessionLength: 40 }).specificItemIds,
      }),
    }));
    const reversed = selectNextAdaptiveGoalEvaluationItem(baseArgs({
      itemPoolForSkill: id => ({
        mode: 'daily_review', sessionLength: 40,
        specificItemIds: id === skillId ? [...ids].reverse() : planPracticeForSkill(id, { sessionLength: 40 }).specificItemIds,
      }),
    }));
    expect(reversed?.item.id).toBe(forward?.item.id);
  });

  it('produces schema and representation diversity across the 30-question fixture', () => {
    const plan = fullPlan();
    const schemas = new Set(plan.map(selection => selection.item.schemaId ?? selection.item.itemType));
    const representations = new Set(plan.map(selection =>
      selection.item.itemType === 'word_problem' || selection.item.itemType === 'measurement_word' ? 'word'
        : selection.item.visualModelType && selection.item.visualModelType !== 'none' ? 'visual'
          : 'symbolic'));
    expect(schemas.size).toBeGreaterThanOrEqual(12);
    expect(representations.size).toBeGreaterThanOrEqual(3);
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

describe('Adaptive Goal Evaluation novelty scoring', () => {
  const makeCandidate = (
    id: string,
    schemaKey: string,
    representation: AdaptiveGoalEvaluationItem['representation'],
  ): AdaptiveGoalEvaluationItem => ({
    item: {
      id, skillId: 'skill', itemType: 'multiplication_fact', prompt: id,
      answer: 1, tags: [], difficulty: .55,
    },
    skillId: 'skill',
    domain: 'multiplication',
    schemaKey,
    representation,
  });
  const schemaA = makeCandidate('a', 'schema-a', 'symbolic');
  const schemaB = makeCandidate('b', 'schema-b', 'visual');
  const evidence = {
    skillId: 'skill', domain: 'multiplication', alpha: 2, beta: 2, mean: .5,
    variance: .05, uncertainty: 1, historicalWeight: 0, historicalCorrectWeight: 0,
    evaluationAttempts: 1, evaluationCorrect: 1, evaluationIncorrect: 0,
  } satisfies AdaptiveGoalSkillEvidence;

  it('uses prior catalogue items to penalize repeated schemas and reward a new representation', () => {
    const lookup = new Map([[schemaA.item.id, schemaA], [schemaB.item.id, schemaB]]);
    const history = buildSelectionHistory([{ itemId: schemaA.item.id, isCorrect: true }], lookup);
    const repeatedScore = itemScore(schemaA, evidence, history, () => 0);
    const novelScore = itemScore(schemaB, evidence, history, () => 0);
    expect(history.selectedSchemaKeys).toEqual(new Set(['schema-a']));
    expect(history.selectedRepresentations).toEqual(new Set(['symbolic']));
    expect(novelScore - repeatedScore).toBeCloseTo(.43);
  });

  it('keeps exact used item IDs in the exclusion history', () => {
    const history = buildSelectionHistory([{ itemId: schemaA.item.id, isCorrect: true }], new Map([[schemaA.item.id, schemaA]]));
    expect(history.usedItemIds.has(schemaA.item.id)).toBe(true);
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

  it('weights historical evidence by timestamp rather than insertion order', () => {
    const oldWrong = event({ id: 'z-old', isCorrect: false, createdAt: '2026-01-01T00:00:00.000Z' });
    const newCorrect = event({ id: 'a-new', isCorrect: true, createdAt: '2026-06-01T00:00:00.000Z' });
    const forward = buildAdaptiveGoalSkillEvidence(baseArgs({ mathAnswerEvents: [oldWrong, newCorrect] }))
      .find(item => item.skillId === 'g3-mul-tables-basic')!;
    const reversed = buildAdaptiveGoalSkillEvidence(baseArgs({ mathAnswerEvents: [newCorrect, oldWrong] }))
      .find(item => item.skillId === 'g3-mul-tables-basic')!;
    expect(reversed.historicalCorrectWeight).toBe(forward.historicalCorrectWeight);
    expect(forward.historicalCorrectWeight).toBeGreaterThan(forward.historicalWeight / 2);
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
