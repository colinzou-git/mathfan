import type { ReviewGrade, MasteryLevel, PracticeOrigin, GoalLearningKind, SelectionOrigin } from '../../types/math';
import type { MasteryState } from '../multiplication/types';
import type { SchedulingTelemetry } from './schedulingTelemetry';
import { db } from '../../db/dexie';

export type MathEventMode = 'quiz' | 'practice' | 'diagnostic' | 'goal_evaluation';

export type SchedulingKind = 'independent_review' | 'relearning_step' | 'related_evidence';
export type SchedulingReason = 'first_card_evidence' | 'same_session_repeat'
  | 'same_presentation_relearning' | 'deferred_related_evidence'
  | 'same_evaluation_template_repeat';

export type MathFactStatus =
  | 'new'
  | 'weak'
  | 'learning'
  | 'developing'
  | 'strong'
  | 'mastered'
  | 'forgotten';

export interface MathAnswerEvent {
  id: string;
  studentId: string;
  sessionId: string;
  itemId: string;
  mode: MathEventMode;
  promptShown: string;
  correctAnswer: string | number;
  studentAnswer: string | number | null;
  isCorrect: boolean;
  /** True when the student is retrying after a wrong first attempt. */
  isRetry: boolean;
  hintUsed: boolean;
  latencyMs: number;
  reviewGrade?: ReviewGrade;
  factStatusBefore?: MathFactStatus;
  factStatusAfter?: MathFactStatus;
  origin?: PracticeOrigin;
  goalId?: string;
  goalTargetId?: string;
  goalIds?: string[];
  goalTargetIds?: string[];
  lessonPlanId?: string;
  lessonSegment?: 'retrieval' | 'focus' | 'transfer';
  lessonRationale?: string;
  selectionOrigin?: SelectionOrigin;
  selectionRationaleCodes?: string[];
  selectionPlannerVersion?: string;
  goalLearningKind?: GoalLearningKind;
  /**
   * True when this event is INDIRECT evidence from a related higher-level item
   * (e.g. solving AREA_RECT_8x7 reinforcing MUL_8x7), not a direct attempt at
   * the fact itself. Such events nudge FSRS scheduling only and are excluded
   * from accuracy/speed stats. See features/adaptive/relatedEvidence.
   */
  relatedEvidence?: boolean;
  /** When relatedEvidence is true, the higher-level item ID that produced it. */
  evidenceSourceItemId?: string;
  /** Canonical scheduling card this event's item belongs to — see features/scheduler/cardModel. */
  cardKey?: string;
  /** Uniquely identifies this presentation when the same generated item appears more than once. */
  itemInstanceId?: string;
  /** Coarse structural schema of the item, for analytics and question variety. */
  schemaId?: string;
  /** 1-based count of how many times this card has been presented so far in the session — see SessionSchedulingGuard. */
  presentationIndex?: number;
  /** False when this presentation could not update long-term FSRS state — see SessionSchedulingGuard (issue #28). */
  schedulingEligible?: boolean;
  /** True only when the eligible scheduler transition was calculated and durably stored. */
  schedulingApplied?: boolean;
  schedulingKind?: SchedulingKind;
  schedulerErrorCode?: 'clock_drift' | 'invalid_card' | 'fsrs_validation' | 'unknown';
  schedulingReason?: SchedulingReason;
  /** Direct causal parent for a same-presentation relearning step. */
  relearningFromEventId?: string;
  /** Versioned, immutable context captured at selection/review time. */
  schedulingTelemetry?: SchedulingTelemetry;
  /**
   * Why this event's reviewGrade was assigned — see RatingReason in
   * features/practice/answerChecker. Kept as an inline literal union (not
   * imported) to avoid a dependency cycle through fluencyEngine.
   */
  ratingReason?: 'incorrect' | 'independent_correct' | 'fast_fluent_correct' | 'slow_fluent_correct'
    | 'supported_correct' | 'same_session_repeat' | 'not_scheduling_eligible'
    | 'untimed_assessment_correct' | 'untimed_assessment_incorrect';
  /** Whether latency was eligible to affect the review grade. */
  gradingContext?: 'practice' | 'untimed_assessment' | 'fluency_assessment';
  /** Task-complexity policy applied — see ResponsePolicyKind in features/scheduler/responsePolicy. */
  responsePolicy?: 'atomic_fluency' | 'procedural' | 'conceptual' | 'multi_step' | 'visual_interpretation';
  /** Speed classification — see FluencyBand in features/fluency/fluencyEngine. Only meaningful for atomic_fluency cards. */
  fluencyBand?: 'fast' | 'expected' | 'slow' | 'not_applicable';
  /** Misconception transitions captured on this canonical event for deterministic cache replay. */
  detectedMisconceptions?: string[];
  confirmedMisconceptions?: string[];
  createdAt: string;
}

export async function recordAnswerEvent(event: MathAnswerEvent): Promise<void> {
  await db.mathAnswerEvents.put(event);
}

// ── Status type conversions ───────────────────────────────────────────────────
// MathFactStatus is the canonical status, a superset of both MasteryLevel (practice/FSRS)
// and MasteryState (quiz mastery score). Use these functions when crossing system boundaries.

/**
 * Convert quiz MasteryState to canonical MathFactStatus.
 * MasteryState ⊆ MathFactStatus, so this is a safe widening.
 */
export function multiplicationStateToCanonicalStatus(state: MasteryState): MathFactStatus {
  return state; // MasteryState values are all valid MathFactStatus values
}

/**
 * Convert canonical MathFactStatus to quiz MasteryState.
 * 'developing' exists in MathFactStatus but not in MasteryState — maps to 'learning'.
 */
export function canonicalStatusToMultiplicationState(status: MathFactStatus): MasteryState {
  if (status === 'developing') return 'learning';
  return status as MasteryState;
}

/**
 * Convert canonical MathFactStatus to legacy practice MasteryLevel.
 * 'weak' and 'forgotten' exist in MathFactStatus but not in MasteryLevel — both map to 'learning'.
 */
export function canonicalStatusToLegacyMasteryLevel(status: MathFactStatus): MasteryLevel {
  if (status === 'weak' || status === 'forgotten') return 'learning';
  return status as MasteryLevel;
}
