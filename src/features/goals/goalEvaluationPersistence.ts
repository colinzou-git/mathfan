import { db } from '../../db/dexie';
import type { AttemptLog, PracticeItem, StudentItemState } from '../../types/math';
import { generateId } from '../../utils/id';
import { goalEvaluationRepo } from '../../db/repositories';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { randomSeed } from '../../utils/rng';
import type { AdaptiveGoalEvaluationSelection } from './goalEvaluationEngine';
import type { GoalEvaluation, PersistedGoalEvaluationSelection } from './types';
import { deriveCardKey } from '../scheduler/cardModel';
import { validatePersistedGoalEvaluationSelection } from './goalEvaluationSelection';
import type { CheckResult } from '../practice/answerChecker';
import { applyReview, createInitialState } from '../scheduler/scheduler';
import { applyMisconceptionConfirmation, applyMisconceptionDetection, detectMistakes } from '../mastery/misconceptionEngine';
import { buildSchedulingTelemetry } from '../learning/schedulingTelemetry';

export interface GoalEvaluationAnswerProposal {
  evaluationId: string;
  eventId: string;
  attemptId: string;
  studentId: string;
  answeredAt: string;
  questionIndex: number;
  selectionRevision: number;
  item: PracticeItem;
  rawAnswer: string;
  latencyMs: number;
  checked: CheckResult;
  selection: PersistedGoalEvaluationSelection;
}

export interface PersistedGoalEvaluationAnswerResult {
  evaluation: GoalEvaluation;
  event: MathAnswerEvent;
  attempt: AttemptLog;
  stateAfter?: StudentItemState;
  schedulingApplied: boolean;
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

export class GoalEvaluationIdempotencyConflictError extends Error {
  constructor(eventId: string) {
    super(`Conflicting goal-evaluation event identity: ${eventId}`);
    this.name = 'GoalEvaluationIdempotencyConflictError';
  }
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

function goalAnswerFingerprint(value: {
  studentId: string; sessionId: string; itemId: string; cardKey?: string;
  studentAnswer: string | number | null; correctAnswer: string | number; isCorrect: boolean;
  latencyMs: number; reviewGrade?: string; gradingContext?: string; schedulingEligible?: boolean; createdAt: string;
}): string {
  return JSON.stringify({ studentId: value.studentId, sessionId: value.sessionId, itemId: value.itemId,
    cardKey: value.cardKey, studentAnswer: value.studentAnswer, correctAnswer: value.correctAnswer,
    isCorrect: value.isCorrect, latencyMs: value.latencyMs, reviewGrade: value.reviewGrade,
    gradingContext: value.gradingContext, schedulingEligible: value.schedulingEligible, createdAt: value.createdAt });
}

function classifySchedulerError(error: unknown): MathAnswerEvent['schedulerErrorCode'] {
  return error instanceof RangeError ? 'clock_drift'
    : error instanceof TypeError ? 'invalid_card'
      : error instanceof Error ? 'fsrs_validation' : 'unknown';
}

export async function persistGoalEvaluationAnswer(proposal: GoalEvaluationAnswerProposal): Promise<PersistedGoalEvaluationAnswerResult> {
  return db.transaction('rw', db.mathAnswerEvents, db.itemStates, db.attempts, db.goalEvaluations, async () => {
    const current = await db.goalEvaluations.get(proposal.evaluationId);
    if (!current || current.studentId !== proposal.studentId) throw new Error('Goal evaluation not found.');
    const cardKey = deriveCardKey(proposal.item);
    const existingEvent = await db.mathAnswerEvents.get(proposal.eventId);
    if (existingEvent) {
      const expected = { studentId: proposal.studentId, sessionId: proposal.evaluationId, itemId: proposal.item.id, cardKey,
        studentAnswer: proposal.checked.studentAnswer, correctAnswer: proposal.checked.correctAnswer,
        isCorrect: proposal.checked.isCorrect, latencyMs: proposal.latencyMs, reviewGrade: proposal.checked.reviewGrade,
        gradingContext: proposal.checked.gradingContext, schedulingEligible: proposal.selection.schedulingEligible,
        createdAt: proposal.answeredAt };
      if (goalAnswerFingerprint(existingEvent) !== goalAnswerFingerprint(expected)) throw new GoalEvaluationIdempotencyConflictError(proposal.eventId);
      const attempt = await db.attempts.get(proposal.attemptId);
      if (!attempt) throw new GoalEvaluationIdempotencyConflictError(proposal.eventId);
      return { evaluation: current, event: existingEvent, attempt,
        stateAfter: existingEvent.schedulingApplied ? await db.itemStates.get([proposal.studentId, cardKey]) : undefined,
        schedulingApplied: existingEvent.schedulingApplied === true };
    }
    if (current.status !== 'in_progress') throw new Error('Goal evaluation is not in progress.');
    const pending = current.currentSelection;
    if (!pending) throw new GoalEvaluationSelectionConflictError('No persisted pending question.');
    const validatedPending = validatePersistedGoalEvaluationSelection({ evaluation: current, selection: pending });
    if (validatedPending.questionIndex !== proposal.questionIndex || (current.selectionRevision ?? 0) !== proposal.selectionRevision) throw new GoalEvaluationSelectionConflictError('Pending question changed.');
    if (validatedPending.item.id !== proposal.item.id || validatedPending.cardKey !== proposal.selection.cardKey
      || cardKey !== validatedPending.cardKey) {
      throw new GoalEvaluationSelectionConflictError('Answer does not match pending question.');
    }
    const schedulerNow = new Date(proposal.answeredAt);
    if (!Number.isFinite(schedulerNow.getTime())) throw new Error('Invalid immutable answer timestamp.');
    const alreadyScheduled = (current.scheduledCardKeys ?? []).includes(cardKey);
    const schedulingEligible = validatedPending.schedulingEligible && !alreadyScheduled;
    const schedulingReason = schedulingEligible ? 'first_card_evidence' : 'same_evaluation_template_repeat';
    const before = await db.itemStates.get([proposal.studentId, cardKey]) ?? createInitialState(proposal.studentId, proposal.item);
    let after = before;
    let schedulingApplied = false;
    let schedulerErrorCode: MathAnswerEvent['schedulerErrorCode'];
    let detected: string[] = [];
    let confirmed: string[] = [];
    if (schedulingEligible) {
      try {
        after = applyReview(before, proposal.checked.reviewGrade, proposal.latencyMs, proposal.rawAnswer, schedulerNow, { isCorrect: proposal.checked.isCorrect });
        after = { ...after, cardKey, lastItemId: proposal.item.id };
        const context = { eventId: proposal.eventId, sessionId: current.id, itemId: proposal.item.id, createdAt: proposal.answeredAt };
        if (!proposal.checked.isCorrect) {
          detected = detectMistakes(proposal.item, proposal.checked.studentAnswer);
          after = { ...after, mistakePatterns: [...new Set([...(after.mistakePatterns ?? []), ...detected])],
            misconceptionEvidence: applyMisconceptionDetection(after.misconceptionEvidence, detected, context, before.mistakePatterns) };
        } else {
          const confirmation = applyMisconceptionConfirmation(after.misconceptionEvidence, proposal.item, context, after.mistakePatterns);
          confirmed = confirmation.confirmedCodes;
          if (confirmation.evidence.length || after.misconceptionEvidence) after = { ...after, misconceptionEvidence: confirmation.evidence };
        }
        schedulingApplied = true;
      } catch (error) {
        after = before;
        schedulerErrorCode = classifySchedulerError(error);
      }
    }
    const event: MathAnswerEvent = {
      id: proposal.eventId, studentId: proposal.studentId, sessionId: current.id, itemId: proposal.item.id,
      cardKey, schemaId: proposal.item.schemaId, mode: 'goal_evaluation', promptShown: proposal.item.prompt,
      correctAnswer: proposal.checked.correctAnswer, studentAnswer: proposal.checked.studentAnswer,
      isCorrect: proposal.checked.isCorrect, isRetry: false, hintUsed: false, latencyMs: proposal.latencyMs,
      ratingReason: proposal.checked.ratingReason, responsePolicy: proposal.checked.policyKind,
      gradingContext: proposal.checked.gradingContext, fluencyBand: proposal.checked.fluencyBand,
      detectedMisconceptions: detected.length ? detected : undefined, confirmedMisconceptions: confirmed.length ? confirmed : undefined,
      reviewGrade: proposal.checked.reviewGrade, factStatusBefore: before.masteryLevel,
      factStatusAfter: schedulingApplied ? after.masteryLevel : before.masteryLevel,
      schedulingEligible, schedulingApplied, schedulerErrorCode, schedulingReason,
      schedulingTelemetry: buildSchedulingTelemetry({ item: proposal.item, stateBefore: before,
        stateAfter: schedulingApplied ? after : undefined,
        response: { reviewGrade: proposal.checked.reviewGrade, ratingReason: proposal.checked.ratingReason,
          responsePolicy: proposal.checked.policyKind, gradingContext: proposal.checked.gradingContext,
          fluencyBand: proposal.checked.fluencyBand, fluencyBaselineSource: proposal.checked.fluencyBaselineSource,
          fluencySampleCount: proposal.checked.fluencySampleCount, fluencyFastCutoffMs: proposal.checked.fluencyFastCutoffMs,
          fluencySlowCutoffMs: proposal.checked.fluencySlowCutoffMs, hintUsed: false, isRetry: false,
          schedulingEligible, schedulingApplied, schedulerErrorCode },
        selection: { origin: 'goal', rationaleCodes: ['active_goal', 'diagnostic_coverage', schedulingReason] },
        presentationIndex: current.answers.length + 1, attemptNo: 1, now: schedulerNow, schedulingReason }),
      createdAt: proposal.answeredAt,
    };
    const attempt: AttemptLog = { id: proposal.attemptId, studentId: proposal.studentId, itemId: proposal.item.id,
      skillId: validatedPending.skillId, sessionId: current.id, promptShown: proposal.item.prompt,
      correctAnswer: proposal.checked.correctAnswer, studentAnswer: proposal.checked.studentAnswer,
      isCorrect: proposal.checked.isCorrect, latencyMs: proposal.latencyMs, reviewGrade: proposal.checked.reviewGrade,
      createdAt: proposal.answeredAt };
    const answer = { eventId: proposal.eventId, attemptId: proposal.attemptId, itemId: proposal.item.id,
      skillId: validatedPending.skillId, answeredAt: proposal.answeredAt, isCorrect: proposal.checked.isCorrect,
      studentAnswer: proposal.checked.studentAnswer, latencyMs: proposal.latencyMs, reviewGrade: proposal.checked.reviewGrade };
    const answers = [...current.answers, answer];
    const answerEvents = [...(current.answerEvents ?? []).filter(value => value.id !== event.id), event];
    const scheduledCardKeys = schedulingApplied ? [...new Set([...(current.scheduledCardKeys ?? []), cardKey])] : current.scheduledCardKeys ?? [];
    const complete = answers.length >= current.plannedQuestionCount;
    const evaluation: GoalEvaluation = {
      ...current,
      status: complete ? 'completed' : 'in_progress', completedAt: complete ? proposal.answeredAt : current.completedAt,
      currentQuestionIndex: answers.length,
      itemIds: [...new Set([...current.itemIds, answer.itemId])],
      targetSkillIds: [...new Set([...current.targetSkillIds, validatedPending.skillId])],
      answers, answerEvents, scheduledCardKeys, updatedAt: proposal.answeredAt, currentSelection: undefined,
    };
    await db.mathAnswerEvents.put(event);
    await db.attempts.put(attempt);
    if (schedulingApplied) await db.itemStates.put(after);
    await db.goalEvaluations.put(evaluation);
    return { evaluation, event, attempt, stateAfter: schedulingApplied ? after : undefined, schedulingApplied };
  });
}
