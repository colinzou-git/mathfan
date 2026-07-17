import type { ReviewGrade } from '../../types/math';
import type { SchedulingKind, SchedulingReason } from '../learning/learningEvents';

export const SAME_PRESENTATION_RECOVERY_GRADE: ReviewGrade = 'hard';

export interface PendingRelearning {
  cardKey: string;
  presentationIndex: number;
  firstWrongEventId: string;
  firstWrongAnsweredAt: string;
}

export interface PracticeSchedulingDecision {
  kind?: SchedulingKind;
  reason?: SchedulingReason;
  eligible: boolean;
  grade?: ReviewGrade;
  relearningFromEventId?: string;
}

export function decidePracticeScheduling(args: {
  isFirstAttemptAtPresentation: boolean;
  isCorrect: boolean;
  plannerSchedulingEligible: boolean;
  guardCanScheduleIndependent: boolean;
  pendingRelearning: PendingRelearning | null;
  cardKey: string;
  presentationIndex: number;
  normalGrade: ReviewGrade;
}): PracticeSchedulingDecision {
  if (args.isFirstAttemptAtPresentation
    && args.plannerSchedulingEligible
    && args.guardCanScheduleIndependent) {
    return {
      kind: 'independent_review',
      reason: 'first_card_evidence',
      eligible: true,
      grade: args.normalGrade,
    };
  }

  const recovery = !args.isFirstAttemptAtPresentation
    && args.isCorrect
    && args.pendingRelearning?.cardKey === args.cardKey
    && args.pendingRelearning.presentationIndex === args.presentationIndex;
  if (recovery) {
    return {
      kind: 'relearning_step',
      reason: 'same_presentation_relearning',
      eligible: true,
      grade: SAME_PRESENTATION_RECOVERY_GRADE,
      relearningFromEventId: args.pendingRelearning!.firstWrongEventId,
    };
  }

  return { reason: 'same_session_repeat', eligible: false };
}
