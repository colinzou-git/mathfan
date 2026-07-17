import { describe, expect, it } from 'vitest';
import {
  decidePracticeScheduling,
  SAME_PRESENTATION_RECOVERY_GRADE,
  type PendingRelearning,
} from '../features/practice/practiceScheduling';

const pending: PendingRelearning = {
  cardKey: 'fact:mul:7x8',
  presentationIndex: 1,
  firstWrongEventId: 'wrong-event',
  firstWrongAnsweredAt: '2026-07-16T08:00:00.000Z',
};

describe('practice scheduling decisions', () => {
  it('allows one independent first attempt', () => {
    expect(decidePracticeScheduling({
      isFirstAttemptAtPresentation: true, isCorrect: false, plannerSchedulingEligible: true,
      guardCanScheduleIndependent: true, pendingRelearning: null, cardKey: pending.cardKey,
      presentationIndex: 1, normalGrade: 'again',
    })).toEqual({ kind: 'independent_review', reason: 'first_card_evidence', eligible: true, grade: 'again' });
  });

  it('allows a conservative correct recovery only for the same presentation', () => {
    expect(decidePracticeScheduling({
      isFirstAttemptAtPresentation: false, isCorrect: true, plannerSchedulingEligible: true,
      guardCanScheduleIndependent: false, pendingRelearning: pending, cardKey: pending.cardKey,
      presentationIndex: 1, normalGrade: 'good',
    })).toEqual({
      kind: 'relearning_step', reason: 'same_presentation_relearning', eligible: true,
      grade: SAME_PRESENTATION_RECOVERY_GRADE, relearningFromEventId: pending.firstWrongEventId,
    });
  });

  it('rejects wrong retries, mismatched presentations, and duplicate independent presentations', () => {
    for (const overrides of [
      { isFirstAttemptAtPresentation: false, isCorrect: false, pendingRelearning: pending },
      { isFirstAttemptAtPresentation: false, isCorrect: true, pendingRelearning: pending, presentationIndex: 2 },
      { isFirstAttemptAtPresentation: true, isCorrect: true, pendingRelearning: null },
    ]) {
      expect(decidePracticeScheduling(Object.assign({
        isFirstAttemptAtPresentation: true, isCorrect: true, plannerSchedulingEligible: true,
        guardCanScheduleIndependent: false, pendingRelearning: null, cardKey: pending.cardKey,
        presentationIndex: 1, normalGrade: 'good' as const,
      }, overrides))).toMatchObject({ eligible: false, reason: 'same_session_repeat' });
    }
  });
});
