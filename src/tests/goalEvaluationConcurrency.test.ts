import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/dexie';
import { recordGoalEvaluationAnswer, type GoalEvaluationAnswerWrite } from '../features/goals/goalEvaluationPersistence';
import type { GoalEvaluation } from '../features/goals/types';
import type { StudentItemState } from '../types/math';

const studentId = 'concurrent-student';
const evaluationId = 'evaluation-concurrent';
const cardKey = 'template:shared';

const baseEvaluation = (): GoalEvaluation => ({
  id: evaluationId, studentId, status: 'in_progress', source: 'evaluation', createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z', currentQuestionIndex: 0, plannedQuestionCount: 30,
  itemIds: [], targetSkillIds: [], answers: [], answerEvents: [], scheduledCardKeys: [],
});

const stateAfter = (itemId: string): StudentItemState => ({
  studentId, cardKey, lastItemId: itemId, skillId: 'skill', attemptCount: 1, correctCount: 1,
  lastCorrect: true, lastLatencyMs: 1000, medianLatencyMs: 1000, ease: 2.5, stabilityDays: 1,
  difficulty: .2, reps: 1, lapses: 0, masteryLevel: 'learning', mistakePatterns: [],
});

function write(suffix: string, itemId: string): GoalEvaluationAnswerWrite {
  const eventId = `event-${suffix}`;
  const answeredAt = `2026-07-01T00:00:0${suffix}.000Z`;
  const answer = { eventId, attemptId: `attempt-${suffix}`, itemId, skillId: 'skill', answeredAt, isCorrect: true, studentAnswer: 1, latencyMs: 1000, reviewGrade: 'good' as const };
  return {
    event: { id: eventId, studentId, sessionId: evaluationId, itemId, cardKey, mode: 'goal_evaluation', promptShown: 'prompt', correctAnswer: 1, studentAnswer: 1, isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 1000, reviewGrade: 'good', factStatusBefore: 'new', factStatusAfter: 'learning', schedulingEligible: true, schedulingApplied: true, schedulingReason: 'first_card_evidence', createdAt: answeredAt },
    attempt: { id: `attempt-${suffix}`, studentId, itemId, skillId: 'skill', sessionId: evaluationId, promptShown: 'prompt', correctAnswer: 1, studentAnswer: 1, isCorrect: true, latencyMs: 1000, reviewGrade: 'good', createdAt: answeredAt },
    updatedState: stateAfter(itemId),
    evaluation: { ...baseEvaluation(), answers: [answer], answerEvents: [], itemIds: [itemId], scheduledCardKeys: [cardKey], currentQuestionIndex: 1, updatedAt: answeredAt },
  };
}

beforeAll(async () => { if (!db.isOpen()) await db.open(); });
beforeEach(async () => { await Promise.all([db.goalEvaluations.clear(), db.mathAnswerEvents.clear(), db.attempts.clear(), db.itemStates.clear()]); await db.goalEvaluations.put(baseEvaluation()); });

describe('goal evaluation transactional scheduling guard', () => {
  it('preserves concurrent shared-card answers while applying scheduling once', async () => {
    await Promise.all([recordGoalEvaluationAnswer(write('1', 'TEMPLATE_A1')), recordGoalEvaluationAnswer(write('2', 'TEMPLATE_A2'))]);
    const evaluation = await db.goalEvaluations.get(evaluationId);
    const events = await db.mathAnswerEvents.where('sessionId').equals(evaluationId).toArray();
    expect(evaluation?.answers).toHaveLength(2);
    expect(evaluation?.scheduledCardKeys).toEqual([cardKey]);
    expect(events).toHaveLength(2);
    expect(events.filter(event => event.schedulingApplied)).toHaveLength(1);
    expect(events.find(event => !event.schedulingApplied)).toMatchObject({ schedulingEligible: false, schedulingReason: 'same_evaluation_template_repeat' });
    expect((await db.itemStates.get([studentId, cardKey]))?.reps).toBe(1);
  });

  it('treats a duplicate event proposal as idempotent', async () => {
    const proposal = write('1', 'TEMPLATE_A1');
    await recordGoalEvaluationAnswer(proposal);
    await recordGoalEvaluationAnswer(proposal);
    expect((await db.goalEvaluations.get(evaluationId))?.answers).toHaveLength(1);
    expect(await db.mathAnswerEvents.where('sessionId').equals(evaluationId).count()).toBe(1);
    expect(await db.attempts.where('sessionId').equals(evaluationId).count()).toBe(1);
  });
});
