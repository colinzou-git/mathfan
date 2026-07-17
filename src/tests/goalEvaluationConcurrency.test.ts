import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/dexie';
import { GoalEvaluationIdempotencyConflictError, GoalEvaluationSelectionConflictError, persistGoalEvaluationAnswer, type GoalEvaluationAnswerProposal } from '../features/goals/goalEvaluationPersistence';
import type { GoalEvaluation, PersistedGoalEvaluationSelection } from '../features/goals/types';
import { applyReview, createInitialState } from '../features/scheduler/scheduler';
import { rebuildItemStatesFromEvents } from '../features/learning/eventRebuild';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';

const studentId = 'concurrent-student';
const evaluationId = 'evaluation-concurrent';
const cardKey = 'template:shared';

const pendingSelection = (questionIndex: number, itemId: string): PersistedGoalEvaluationSelection => ({
  version: 1, questionIndex, selectedAt: `2026-07-01T00:00:0${questionIndex}.000Z`,
  item: { id: itemId, skillId: 'skill', itemType: 'multiplication_fact', prompt: 'prompt', answer: 1, tags: [], difficulty: 1, cardKey },
  skillId: 'skill', domain: 'multiplication', phase: 'screening', rationale: 'shared-card coverage', cardKey,
  schedulingEligible: questionIndex === 0, schedulingReason: questionIndex === 0 ? 'first_card_evidence' : 'same_evaluation_template_repeat',
});

const baseEvaluation = (): GoalEvaluation => ({
  id: evaluationId, studentId, status: 'in_progress', source: 'evaluation', createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z', currentQuestionIndex: 0, plannedQuestionCount: 30,
  itemIds: [], targetSkillIds: [], answers: [], answerEvents: [], scheduledCardKeys: [], selectionRevision: 1,
  currentSelection: pendingSelection(0, 'TEMPLATE_A1'),
});

function write(suffix: string, itemId: string, questionIndex = Number(suffix) - 1): GoalEvaluationAnswerProposal {
  const eventId = `event-${suffix}`;
  const answeredAt = `2026-07-01T00:00:0${suffix}.000Z`;
  return {
    evaluationId, eventId, attemptId: `attempt-${suffix}`, studentId, answeredAt, questionIndex,
    selectionRevision: questionIndex + 1, item: pendingSelection(questionIndex, itemId).item,
    rawAnswer: '1', latencyMs: 1000,
    checked: { isCorrect: true, reviewGrade: 'good', ratingReason: 'untimed_assessment_correct',
      fluencyBand: 'not_applicable', policyKind: 'atomic_fluency', gradingContext: 'untimed_assessment',
      schedulingEligible: true, fluencyBaselineSource: 'not_applicable', fluencySampleCount: 0,
      latencyMs: 1000, correctAnswer: 1, studentAnswer: 1 },
    selection: pendingSelection(questionIndex, itemId),
  };
}

beforeAll(async () => { if (!db.isOpen()) await db.open(); });
beforeEach(async () => { await Promise.all([db.goalEvaluations.clear(), db.mathAnswerEvents.clear(), db.attempts.clear(), db.itemStates.clear()]); await db.goalEvaluations.put(baseEvaluation()); });

describe('goal evaluation transactional scheduling guard', () => {
  it('preserves later shared-card answers while applying scheduling once', async () => {
    await persistGoalEvaluationAnswer(write('1', 'TEMPLATE_A1'));
    const afterFirst = await db.goalEvaluations.get(evaluationId);
    await db.goalEvaluations.put({ ...afterFirst!, currentSelection: pendingSelection(1, 'TEMPLATE_A2'), selectionRevision: 2 });
    await persistGoalEvaluationAnswer(write('2', 'TEMPLATE_A2'));
    const evaluation = await db.goalEvaluations.get(evaluationId);
    const events = await db.mathAnswerEvents.where('sessionId').equals(evaluationId).toArray();
    expect(evaluation?.answers).toHaveLength(2);
    expect(evaluation?.scheduledCardKeys).toEqual([cardKey]);
    expect(events).toHaveLength(2);
    expect(events.filter(event => event.schedulingApplied)).toHaveLength(1);
    expect(events.find(event => !event.schedulingApplied)).toMatchObject({ schedulingEligible: false, schedulingReason: 'same_evaluation_template_repeat' });
    expect((await db.itemStates.get([studentId, cardKey]))?.reps).toBe(1);
    expect(evaluation?.currentSelection).toBeUndefined();
    expect(evaluation?.selectionRevision).toBe(2);
  });

  it('schedules later questions on a different card independently', async () => {
    await persistGoalEvaluationAnswer(write('1', 'TEMPLATE_A1'));
    const afterFirst = await db.goalEvaluations.get(evaluationId);
    const item = makeItemFromId('MUL_6x9')!;
    const secondSelection = { ...pendingSelection(1, item.id), item, cardKey: 'fact:mul:6x9',
      schedulingEligible: true as const, schedulingReason: 'first_card_evidence' as const };
    await db.goalEvaluations.put({ ...afterFirst!, currentSelection: secondSelection, selectionRevision: 2 });
    const base = write('2', item.id);
    await persistGoalEvaluationAnswer({ ...base, item, rawAnswer: '54', selection: secondSelection,
      checked: { ...base.checked, correctAnswer: 54, studentAnswer: 54 } });
    expect((await db.goalEvaluations.get(evaluationId))?.scheduledCardKeys).toEqual([cardKey, 'fact:mul:6x9']);
    expect(await db.itemStates.count()).toBe(2);
  });

  it('rejects a stale selection revision without clearing the pending question', async () => {
    const proposal = { ...write('1', 'TEMPLATE_A1'), selectionRevision: 0 };
    await expect(persistGoalEvaluationAnswer(proposal)).rejects.toBeInstanceOf(GoalEvaluationSelectionConflictError);
    expect((await db.goalEvaluations.get(evaluationId))?.currentSelection).toEqual(pendingSelection(0, 'TEMPLATE_A1'));
    expect(await db.mathAnswerEvents.where('sessionId').equals(evaluationId).count()).toBe(0);
  });

  it('treats a duplicate event proposal as idempotent', async () => {
    const proposal = write('1', 'TEMPLATE_A1');
    await persistGoalEvaluationAnswer(proposal);
    await persistGoalEvaluationAnswer(proposal);
    expect((await db.goalEvaluations.get(evaluationId))?.answers).toHaveLength(1);
    expect(await db.mathAnswerEvents.where('sessionId').equals(evaluationId).count()).toBe(1);
    expect(await db.attempts.where('sessionId').equals(evaluationId).count()).toBe(1);
  });

  it('rejects the same event ID with different answer, correctness, latency, grade, or timestamp', async () => {
    const proposal = write('1', 'TEMPLATE_A1');
    await persistGoalEvaluationAnswer(proposal);
    const conflicts = [
      { ...proposal, checked: { ...proposal.checked, studentAnswer: 0 } },
      { ...proposal, checked: { ...proposal.checked, isCorrect: false } },
      { ...proposal, latencyMs: 2000, checked: { ...proposal.checked, latencyMs: 2000 } },
      { ...proposal, checked: { ...proposal.checked, reviewGrade: 'hard' as const } },
      { ...proposal, answeredAt: '2026-07-01T00:00:09.000Z' },
    ];
    for (const conflict of conflicts) {
      await expect(persistGoalEvaluationAnswer(conflict)).rejects.toBeInstanceOf(GoalEvaluationIdempotencyConflictError);
    }
  });

  it('reads a newer card state inside the transaction and uses the immutable answer timestamp', async () => {
    const proposal = write('1', 'TEMPLATE_A1');
    const initial = createInitialState(studentId, proposal.item);
    const newer = { ...applyReview(initial, 'good', 900, '1', new Date('2026-06-30T00:00:00.000Z'), { isCorrect: true }), cardKey };
    await db.itemStates.put(newer);
    const committed = await persistGoalEvaluationAnswer(proposal);
    expect(committed.stateAfter?.reps).toBe((newer.reps ?? 0) + 1);
    expect(committed.stateAfter?.lastSeenAt).toBe(proposal.answeredAt);
    await persistGoalEvaluationAnswer(proposal);
    expect((await db.itemStates.get([studentId, cardKey]))?.lastSeenAt).toBe(proposal.answeredAt);
  });

  it('records scheduler failure without reserving the card', async () => {
    const proposal = write('1', 'TEMPLATE_A1');
    proposal.checked = { ...proposal.checked, reviewGrade: 'invalid' as never };
    const committed = await persistGoalEvaluationAnswer(proposal);
    expect(committed.schedulingApplied).toBe(false);
    expect(committed.event).toMatchObject({ schedulingEligible: true, schedulingApplied: false });
    expect(committed.evaluation.scheduledCardKeys).toEqual([]);
    expect(await db.itemStates.get([studentId, cardKey])).toBeUndefined();
  });

  it('rolls back every record when a transaction write fails', async () => {
    const proposal = { ...write('1', 'TEMPLATE_A1'), attemptId: undefined as never };
    await expect(persistGoalEvaluationAnswer(proposal)).rejects.toThrow();
    expect(await db.mathAnswerEvents.count()).toBe(0);
    expect(await db.attempts.count()).toBe(0);
    expect(await db.itemStates.count()).toBe(0);
    expect((await db.goalEvaluations.get(evaluationId))?.answers).toEqual([]);
    expect((await db.goalEvaluations.get(evaluationId))?.scheduledCardKeys).toEqual([]);
  });

  it('rebuilds the same live state from the transaction-produced event', async () => {
    const knownCardKey = 'fact:mul:7x8';
    const knownItem = makeItemFromId('MUL_7x8')!;
    const knownSelection = { ...pendingSelection(0, 'MUL_7x8'), item: knownItem, cardKey: knownCardKey };
    await db.goalEvaluations.put({ ...baseEvaluation(), currentSelection: knownSelection });
    const base = write('1', 'MUL_7x8');
    const proposal = { ...base, item: knownItem, rawAnswer: '56', selection: knownSelection,
      checked: { ...base.checked, correctAnswer: 56, studentAnswer: 56 } };
    const committed = await persistGoalEvaluationAnswer(proposal);
    const live = committed.stateAfter;
    await db.itemStates.delete([studentId, knownCardKey]);
    await rebuildItemStatesFromEvents(studentId, { mode: 'strict', baselinePolicy: 'none' });
    expect(await db.itemStates.get([studentId, knownCardKey])).toEqual(live);
  });
});
