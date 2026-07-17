import type { AttemptLog, PracticeItem, StudentItemState } from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';
import { buildSchedulingTelemetry } from '../learning/schedulingTelemetry';
import {
  applyMisconceptionConfirmation,
  applyMisconceptionDetection,
  detectMistakes,
} from '../mastery/misconceptionEngine';
import { checkAnswer } from '../practice/answerChecker';
import { deriveCardKey } from '../scheduler/cardModel';
import { applyReview, createInitialState } from '../scheduler/scheduler';
import { diagnosticStateRevision, type DiagnosticAnswerProposal } from './diagnosticPersistence';

function classifySchedulerError(error: unknown): MathAnswerEvent['schedulerErrorCode'] {
  return error instanceof RangeError ? 'clock_drift'
    : error instanceof TypeError ? 'invalid_card'
      : error instanceof Error ? 'fsrs_validation' : 'unknown';
}

export function buildDiagnosticAnswerProposal(args: {
  eventId: string;
  attemptId: string;
  answeredAt: string;
  studentId: string;
  sessionId: string;
  item: PracticeItem;
  rawInput: string;
  latencyMs: number;
  existingState?: StudentItemState;
}): DiagnosticAnswerProposal {
  const checked = checkAnswer(args.item, args.rawInput, args.latencyMs, { gradingContext: 'untimed_assessment' });
  const cardKey = deriveCardKey(args.item);
  const before = args.existingState ?? createInitialState(args.studentId, args.item);
  const answeredAt = new Date(args.answeredAt);
  if (!Number.isFinite(answeredAt.getTime())) throw new TypeError('Invalid diagnostic answer timestamp.');

  let after = before;
  let schedulingApplied = false;
  let schedulerErrorCode: MathAnswerEvent['schedulerErrorCode'];
  try {
    after = applyReview(
      before,
      checked.reviewGrade,
      args.latencyMs,
      String(checked.studentAnswer),
      answeredAt,
      { isCorrect: checked.isCorrect },
    );
    schedulingApplied = true;
  } catch (error) {
    schedulerErrorCode = classifySchedulerError(error);
  }
  after = { ...after, cardKey, lastItemId: args.item.id };

  let detectedMisconceptions: string[] = [];
  let confirmedMisconceptions: string[] = [];
  const context = {
    eventId: args.eventId,
    sessionId: args.sessionId,
    itemId: args.item.id,
    createdAt: args.answeredAt,
  };
  if (!checked.isCorrect) {
    detectedMisconceptions = detectMistakes(args.item, checked.studentAnswer);
    if (detectedMisconceptions.length > 0) {
      after = {
        ...after,
        mistakePatterns: Array.from(new Set([...(after.mistakePatterns ?? []), ...detectedMisconceptions])),
        misconceptionEvidence: applyMisconceptionDetection(
          after.misconceptionEvidence,
          detectedMisconceptions,
          context,
          before.mistakePatterns,
        ),
      };
    }
  } else {
    const confirmation = applyMisconceptionConfirmation(
      after.misconceptionEvidence,
      args.item,
      context,
      after.mistakePatterns,
    );
    confirmedMisconceptions = confirmation.confirmedCodes;
    if (confirmation.evidence.length > 0) {
      after = { ...after, misconceptionEvidence: confirmation.evidence };
    }
  }

  const event: MathAnswerEvent = {
    id: args.eventId,
    studentId: args.studentId,
    sessionId: args.sessionId,
    itemId: args.item.id,
    cardKey,
    schemaId: args.item.schemaId,
    mode: 'diagnostic',
    promptShown: args.item.prompt,
    correctAnswer: args.item.answer,
    studentAnswer: checked.studentAnswer,
    isCorrect: checked.isCorrect,
    isRetry: false,
    hintUsed: false,
    schedulingEligible: true,
    schedulingApplied,
    schedulerErrorCode,
    latencyMs: args.latencyMs,
    reviewGrade: checked.reviewGrade,
    ratingReason: checked.ratingReason,
    responsePolicy: checked.policyKind,
    gradingContext: checked.gradingContext,
    fluencyBand: checked.fluencyBand,
    detectedMisconceptions: detectedMisconceptions.length ? detectedMisconceptions : undefined,
    confirmedMisconceptions: confirmedMisconceptions.length ? confirmedMisconceptions : undefined,
    factStatusBefore: before.masteryLevel,
    factStatusAfter: after.masteryLevel,
    schedulingTelemetry: buildSchedulingTelemetry({
      item: args.item,
      stateBefore: before,
      stateAfter: schedulingApplied ? after : undefined,
      response: {
        reviewGrade: checked.reviewGrade,
        ratingReason: checked.ratingReason,
        responsePolicy: checked.policyKind,
        gradingContext: checked.gradingContext,
        fluencyBand: checked.fluencyBand,
        hintUsed: false,
        isRetry: false,
        schedulingEligible: true,
        schedulingApplied,
        schedulerErrorCode,
      },
      selection: { origin: 'diagnostic', rationaleCodes: ['diagnostic_coverage'] },
      presentationIndex: 1,
      attemptNo: 1,
      now: answeredAt,
    }),
    createdAt: args.answeredAt,
  };
  const attempt: AttemptLog = {
    id: args.attemptId,
    studentId: args.studentId,
    itemId: args.item.id,
    skillId: args.item.skillId,
    sessionId: args.sessionId,
    promptShown: args.item.prompt,
    correctAnswer: args.item.answer,
    studentAnswer: checked.studentAnswer,
    isCorrect: checked.isCorrect,
    latencyMs: args.latencyMs,
    reviewGrade: checked.reviewGrade,
    createdAt: args.answeredAt,
  };

  return {
    event,
    attempt,
    stateBefore: before,
    stateAfter: schedulingApplied ? after : undefined,
    expectedStateRevision: diagnosticStateRevision(before),
    schedulingApplied,
  };
}
