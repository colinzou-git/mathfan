import { db } from '../../db/dexie';
import type { AttemptLog, StudentItemState } from '../../types/math';
import { generateId } from '../../utils/id';
import { itemStateRepo, mathAnswerEventRepo, attemptRepo, goalEvaluationRepo } from '../../db/repositories';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { randomSeed } from '../../utils/rng';
import type { GoalEvaluation } from './types';

export interface GoalEvaluationAnswerWrite {
  event: MathAnswerEvent;
  attempt: AttemptLog;
  updatedState?: StudentItemState;
  evaluation: GoalEvaluation;
}

export async function loadLatestResumableGoalEvaluation(studentId: string): Promise<GoalEvaluation | null> {
  const evaluations = await goalEvaluationRepo.listForStudent(studentId);
  return evaluations
    .filter(evaluation => evaluation.status === 'in_progress')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export async function createGoalEvaluation(studentId: string, now: string): Promise<GoalEvaluation> {
  const evaluation: GoalEvaluation = {
    id: generateId(),
    studentId,
    status: 'in_progress',
    source: 'evaluation',
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    seed: randomSeed(),
    currentQuestionIndex: 0,
    plannedQuestionCount: 30,
    itemIds: [],
    targetSkillIds: [],
    answers: [],
    answerEvents: [],
    scheduledCardKeys: [],
  };
  await goalEvaluationRepo.save(evaluation, now);
  return evaluation;
}

export async function recordGoalEvaluationAnswer(payload: GoalEvaluationAnswerWrite): Promise<void> {
  await db.transaction('rw', db.mathAnswerEvents, db.itemStates, db.attempts, db.goalEvaluations, async () => {
    await mathAnswerEventRepo.save(payload.event);
    if (payload.updatedState) await itemStateRepo.save(payload.updatedState);
    await attemptRepo.save(payload.attempt);
    await goalEvaluationRepo.save(payload.evaluation, payload.evaluation.updatedAt);
  });
}
