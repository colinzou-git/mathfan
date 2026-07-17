import { db } from '../../db/dexie';
import type { AttemptLog, StudentItemState } from '../../types/math';
import { generateId } from '../../utils/id';
import { itemStateRepo, mathAnswerEventRepo, attemptRepo, goalEvaluationRepo } from '../../db/repositories';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { randomSeed } from '../../utils/rng';
import type { AdaptiveGoalEvaluationSelection } from './goalEvaluationEngine';
import type { GoalEvaluation, PersistedGoalEvaluationSelection } from './types';
import { deriveCardKey } from '../scheduler/cardModel';
import { validatePersistedGoalEvaluationSelection } from './goalEvaluationSelection';

export interface GoalEvaluationAnswerWrite {
  event: MathAnswerEvent;
  attempt: AttemptLog;
  updatedState?: StudentItemState;
  evaluation: GoalEvaluation;
  questionIndex: number;
  selectionRevision: number;
  selection: PersistedGoalEvaluationSelection;
}

export class GoalEvaluationSelectionConflictError extends Error {
  constructor(message: string) { super(message); this.name = 'GoalEvaluationSelectionConflictError'; }
}

export interface PersistNextGoalQuestionArgs {
  evaluationId: string;
  expectedAnswerCount: number;
  expectedSelectionRevision: number;
  selectedAt: string;
  selection: AdaptiveGoalEvaluationSelection;
}

export async function persistNextGoalEvaluationQuestion(args: PersistNextGoalQuestionArgs): Promise<GoalEvaluation> {
  return db.transaction('rw', db.goalEvaluations, async () => {
    const current = await db.goalEvaluations.get(args.evaluationId);
    if (!current || current.status !== 'in_progress') throw new Error('Goal evaluation is not resumable.');
    if (current.currentSelection?.questionIndex === current.answers.length) {
      return { ...current, currentSelection: validatePersistedGoalEvaluationSelection({ evaluation: current, selection: current.currentSelection }) };
    }
    if (current.answers.length !== args.expectedAnswerCount) throw new GoalEvaluationSelectionConflictError('Answer count changed before question selection was committed.');
    const revision = current.selectionRevision ?? 0;
    if (revision !== args.expectedSelectionRevision) throw new GoalEvaluationSelectionConflictError('Pending-question revision changed.');
    const currentSelection: PersistedGoalEvaluationSelection = {
      version: 1, questionIndex: current.answers.length, selectedAt: args.selectedAt, item: args.selection.item,
      skillId: args.selection.skillId, domain: args.selection.domain, phase: args.selection.phase,
      rationale: args.selection.rationale, cardKey: args.selection.cardKey,
      schedulingEligible: args.selection.schedulingEligible, schedulingReason: args.selection.schedulingReason,
    };
    const validated = validatePersistedGoalEvaluationSelection({ evaluation: current, selection: currentSelection });
    const updated = { ...current, currentSelection: validated, selectionRevision: revision + 1, updatedAt: args.selectedAt };
    await db.goalEvaluations.put(updated);
    return updated;
  });
}

export interface CommittedGoalEvaluationAnswer {
  evaluation: GoalEvaluation;
  event: MathAnswerEvent;
  updatedState?: StudentItemState;
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
    selectionRevision: 0,
  };
  await goalEvaluationRepo.save(evaluation, now);
  return evaluation;
}

export async function recordGoalEvaluationAnswer(payload: GoalEvaluationAnswerWrite): Promise<CommittedGoalEvaluationAnswer> {
  return db.transaction('rw', db.mathAnswerEvents, db.itemStates, db.attempts, db.goalEvaluations, async () => {
    const current = await db.goalEvaluations.get(payload.evaluation.id);
    if (!current) throw new Error('Goal evaluation not found.');
    const existingEvent = await db.mathAnswerEvents.get(payload.event.id);
    if (existingEvent) {
      const equivalent = existingEvent.studentId === payload.event.studentId && existingEvent.sessionId === payload.event.sessionId && existingEvent.itemId === payload.event.itemId;
      if (!equivalent) throw new Error(`Conflicting goal-evaluation event identity: ${payload.event.id}`);
      return { evaluation: current, event: existingEvent, updatedState: await db.itemStates.get([current.studentId, existingEvent.cardKey ?? '']) };
    }
    const pending = current.currentSelection;
    if (!pending) throw new GoalEvaluationSelectionConflictError('No persisted pending question.');
    const validatedPending = validatePersistedGoalEvaluationSelection({ evaluation: current, selection: pending });
    if (validatedPending.questionIndex !== payload.questionIndex || (current.selectionRevision ?? 0) !== payload.selectionRevision) throw new GoalEvaluationSelectionConflictError('Pending question changed.');
    if (validatedPending.item.id !== payload.selection.item.id || validatedPending.cardKey !== payload.selection.cardKey
      || payload.event.itemId !== validatedPending.item.id || deriveCardKey(payload.selection.item) !== validatedPending.cardKey) {
      throw new GoalEvaluationSelectionConflictError('Answer does not match pending question.');
    }
    const cardKey = payload.event.cardKey;
    const alreadyScheduled = Boolean(cardKey && (current.scheduledCardKeys ?? []).includes(cardKey));
    const schedulingApplied = payload.event.schedulingApplied === true && !alreadyScheduled;
    const event: MathAnswerEvent = schedulingApplied ? payload.event : {
      ...payload.event,
      schedulingEligible: false,
      schedulingApplied: false,
      schedulingReason: 'same_evaluation_template_repeat',
      factStatusAfter: payload.event.factStatusBefore,
      schedulingTelemetry: payload.event.schedulingTelemetry ? {
        ...payload.event.schedulingTelemetry,
        schedulingEligible: false,
        schedulingApplied: false,
        schedulingReason: 'same_evaluation_template_repeat',
        after: undefined,
      } : undefined,
    };
    const answer = payload.evaluation.answers.find(value => value.eventId === payload.event.id);
    if (!answer) throw new Error('Goal evaluation answer proposal is incomplete.');
    const answers = current.answers.some(value => value.eventId === answer.eventId) ? current.answers : [...current.answers, answer];
    const answerEvents = [...(current.answerEvents ?? []).filter(value => value.id !== event.id), event];
    const scheduledCardKeys = schedulingApplied && cardKey ? [...new Set([...(current.scheduledCardKeys ?? []), cardKey])] : current.scheduledCardKeys ?? [];
    const complete = answers.length >= current.plannedQuestionCount;
    const evaluation: GoalEvaluation = {
      ...current,
      status: complete ? 'completed' : 'in_progress',
      completedAt: complete ? answer.answeredAt : current.completedAt,
      currentQuestionIndex: answers.length,
      itemIds: [...new Set([...current.itemIds, answer.itemId])],
      targetSkillIds: [...new Set([...current.targetSkillIds, ...payload.evaluation.targetSkillIds])],
      answers, answerEvents, scheduledCardKeys, updatedAt: answer.answeredAt,
      currentSelection: undefined,
    };
    await mathAnswerEventRepo.save(event);
    if (schedulingApplied && payload.updatedState) await itemStateRepo.save(payload.updatedState);
    await attemptRepo.save(payload.attempt);
    await goalEvaluationRepo.save(evaluation, evaluation.updatedAt);
    return { evaluation, event, updatedState: schedulingApplied ? payload.updatedState : undefined };
  });
}
