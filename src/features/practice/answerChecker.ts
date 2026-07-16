import type { PracticeItem, ReviewGrade } from '../../types/math';
import {
  policyForItem,
  DEFAULT_FLUENCY_EASY_MS,
  DEFAULT_FLUENCY_HARD_MS,
  type AnswerGradingContext,
} from '../scheduler/responsePolicy';
import { classifyFluency, type FluencyBand, type StudentFluencyBaseline } from '../fluency/fluencyEngine';

// Legacy fixed thresholds — kept only for classifying pre-#27 historical events
// that predate task-aware policies. See RESPONSE_POLICY_VERSION and
// legacyClassifyByLatency() below. Do not use these for new live grading.
export const FAST_MS = DEFAULT_FLUENCY_EASY_MS;
export const NORMAL_MS = DEFAULT_FLUENCY_HARD_MS;

/** Bumped whenever the live classification policy changes in a way that would grade the same answer differently. */
export const RESPONSE_POLICY_VERSION = 1;

export type RatingReason =
  | 'incorrect'
  | 'independent_correct'
  | 'fast_fluent_correct'
  | 'slow_fluent_correct'
  | 'supported_correct'
  | 'same_session_repeat'
  | 'not_scheduling_eligible'
  | 'untimed_assessment_correct'
  | 'untimed_assessment_incorrect';

export interface ResponseEvidence {
  isCorrect: boolean;
  reviewGrade: ReviewGrade;
  ratingReason: RatingReason;
  fluencyBand: FluencyBand;
  policyKind: ReturnType<typeof policyForItem>['kind'];
  gradingContext: AnswerGradingContext;
  schedulingEligible: boolean;
  fluencyBaselineSource: 'student' | 'policy_default' | 'not_applicable';
  fluencySampleCount: number;
  fluencyFastCutoffMs?: number;
  fluencySlowCutoffMs?: number;
}

// Strict patterns — reject trailing/embedded junk that parseFloat silently ignores.
// integerPattern: whole numbers only (positive or negative).
// decimalPattern: integers or a single decimal point with digits on at least one side.
const integerPattern = /^-?\d+$/;
const decimalPattern = /^-?(?:\d+|\d*\.\d+)$/;

export interface CheckResult extends ResponseEvidence {
  latencyMs: number;
  correctAnswer: string | number;
  studentAnswer: string | number;
}

export interface CheckAnswerOptions {
  /** True when this submission followed a hint/explanation or is a retry — never scheduling-eligible. */
  hintUsed?: boolean;
  /** Student-relative latency baseline for this card, when available. Falls back to policy defaults when omitted. */
  studentFluency?: StudentFluencyBaseline | null;
  /** Whether latency is valid FSRS evidence for this answer. */
  gradingContext?: AnswerGradingContext;
}

export function checkAnswer(
  item: PracticeItem,
  rawInput: string,
  latencyMs: number,
  options: CheckAnswerOptions = {}
): CheckResult {
  const normalizedInput = rawInput.trim().replace(/\s+/g, '');
  const correctAnswer = item.answer;

  let isCorrect: boolean;
  let studentAnswer: string | number;

  if (item.answerInput === 'choice' || typeof correctAnswer === 'string') {
    // String/choice comparison (e.g. fraction compare: '<', '=', '>')
    studentAnswer = normalizedInput;
    isCorrect = normalizedInput === String(correctAnswer).trim().replace(/\s+/g, '');
  } else {
    // Numeric comparison — validate format before parsing to reject "12abc", "1.2.3", etc.
    const expected = Number(correctAnswer);
    const pattern = Number.isInteger(expected) ? integerPattern : decimalPattern;
    if (!pattern.test(normalizedInput)) {
      studentAnswer = normalizedInput;
      isCorrect = false;
    } else {
      const parsed = parseFloat(normalizedInput);
      studentAnswer = parsed;
      isCorrect = Math.abs(parsed - expected) < 0.001;
    }
  }

  const evidence = classifyResponse(item, {
    isCorrect,
    latencyMs,
    hintUsed: options.hintUsed ?? false,
    studentFluency: options.studentFluency,
    gradingContext: options.gradingContext ?? 'practice',
  });

  return { ...evidence, latencyMs, correctAnswer, studentAnswer };
}

/**
 * Task-aware response classifier (issue #27). Separates three previously
 * conflated concepts:
 *   - correctness/independent retrieval → primary FSRS evidence;
 *   - fluency (speed) → meaningful only for atomic_fluency cards
 *     (multiplication/division facts — see scheduler/cardModel);
 *   - support level → hinted/retried answers never update scheduling.
 *
 * Only atomic_fluency cards use latency to grade FSRS. Every other policy
 * kind (procedural/conceptual/multi_step/visual_interpretation) grades an
 * independent correct answer 'good' regardless of raw working time, so
 * multi-step reasoning and reading time are never mistaken for weak recall.
 */
export function classifyResponse(
  item: PracticeItem,
  context: {
    isCorrect: boolean;
    latencyMs: number;
    hintUsed: boolean;
    studentFluency?: StudentFluencyBaseline | null;
    gradingContext?: AnswerGradingContext;
  }
): ResponseEvidence {
  const policy = policyForItem(item);
  const { isCorrect, latencyMs, hintUsed, studentFluency } = context;
  const gradingContext = context.gradingContext ?? 'practice';
  const useLatencyForFsrs = policy.useLatencyForFsrs && gradingContext !== 'untimed_assessment';
  const fluencyMetadata = useLatencyForFsrs
    ? {
        fluencyBaselineSource: studentFluency ? 'student' as const : 'policy_default' as const,
        fluencySampleCount: studentFluency?.sampleCount ?? 0,
        fluencyFastCutoffMs: studentFluency?.p25Ms ?? policy.easyMs,
        fluencySlowCutoffMs: studentFluency?.p75Ms ?? policy.hardMs,
      }
    : { fluencyBaselineSource: 'not_applicable' as const, fluencySampleCount: 0 };

  if (!isCorrect) {
    return {
      isCorrect: false,
      reviewGrade: 'again',
      ratingReason: gradingContext === 'untimed_assessment' ? 'untimed_assessment_incorrect' : 'incorrect',
      fluencyBand: 'not_applicable',
      policyKind: policy.kind,
      gradingContext,
      schedulingEligible: true,
      ...fluencyMetadata,
    };
  }

  if (hintUsed) {
    // Supported/retry answers remain direct evidence for stats but never
    // update long-term FSRS state — the caller must not persist their grade
    // to itemStates (see recordPracticeAnswer's isFirstAttempt gate).
    return {
      isCorrect: true,
      reviewGrade: 'good',
      ratingReason: 'supported_correct',
      fluencyBand: 'not_applicable',
      policyKind: policy.kind,
      gradingContext,
      schedulingEligible: false,
      ...fluencyMetadata,
    };
  }

  if (!useLatencyForFsrs) {
    return {
      isCorrect: true,
      reviewGrade: 'good',
      ratingReason: gradingContext === 'untimed_assessment' ? 'untimed_assessment_correct' : 'independent_correct',
      fluencyBand: 'not_applicable',
      policyKind: policy.kind,
      gradingContext,
      schedulingEligible: true,
      ...fluencyMetadata,
    };
  }

  const fluencyBand = classifyFluency(latencyMs, policy, studentFluency);
  if (fluencyBand === 'slow') {
    return {
      isCorrect: true,
      reviewGrade: 'hard',
      ratingReason: 'slow_fluent_correct',
      fluencyBand,
      policyKind: policy.kind,
      gradingContext,
      schedulingEligible: true,
      ...fluencyMetadata,
    };
  }
  // Require an established personal baseline before awarding 'easy' — a
  // trivial fact answered quickly on first exposure is not yet proven fluent.
  if (fluencyBand === 'fast' && studentFluency) {
    return {
      isCorrect: true,
      reviewGrade: 'easy',
      ratingReason: 'fast_fluent_correct',
      fluencyBand,
      policyKind: policy.kind,
      gradingContext,
      schedulingEligible: true,
      ...fluencyMetadata,
    };
  }
  return {
    isCorrect: true,
    reviewGrade: 'good',
    ratingReason: 'independent_correct',
    fluencyBand,
    policyKind: policy.kind,
    gradingContext,
    schedulingEligible: true,
    ...fluencyMetadata,
  };
}

/**
 * Fixed-threshold (isCorrect, latency) → ReviewGrade classification, exactly
 * matching the pre-#27 global policy. Used ONLY to reconstruct the ReviewGrade
 * of historical events that predate the `reviewGrade` field itself — a real
 * migration/rebuild concern, not a live-grading path. See RESPONSE_POLICY_VERSION.
 */
export function legacyClassifyByLatency(isCorrect: boolean, latencyMs: number): ReviewGrade {
  if (!isCorrect) return 'again';
  if (latencyMs > NORMAL_MS) return 'hard';
  if (latencyMs <= FAST_MS) return 'easy';
  return 'good';
}
