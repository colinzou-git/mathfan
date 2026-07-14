/**
 * Enforces the invariant from issue #28: a canonical learning card may update
 * long-term FSRS state at most once per practice session, even if the same
 * card is presented more than once (e.g. a daily-review queue repeating due
 * items to fill the requested session length).
 *
 * Presentation counting and scheduling-eligibility are deliberately separate:
 * a card can be *presented* many times in a session (each contributes to
 * practice stats), but only its first scheduling-eligible presentation may
 * call applyReview(). markScheduled() is called synchronously, before the
 * async event write, so a rapid double-submit cannot schedule the same card
 * twice while the first write is still in flight.
 */
export interface SessionSchedulingGuard {
  /** Call when a card is shown to the student. Returns the 1-based presentation index for this session. */
  presentationStarted(cardKey: string): number;
  /** True only for a card's first presentation-first-attempt in this session. */
  canSchedule(cardKey: string, attemptNo: number): boolean;
  /** Reserve the card as scheduled. Call synchronously, before the async persistence write. */
  markScheduled(cardKey: string): void;
  /** Release a reservation after a write failure, so a retry can still schedule the card. */
  releaseScheduled(cardKey: string): void;
  reset(): void;
}

export function createSessionSchedulingGuard(): SessionSchedulingGuard {
  const scheduledCards = new Set<string>();
  const presentationCounts = new Map<string, number>();

  return {
    presentationStarted(cardKey) {
      const next = (presentationCounts.get(cardKey) ?? 0) + 1;
      presentationCounts.set(cardKey, next);
      return next;
    },
    canSchedule(cardKey, attemptNo) {
      return attemptNo === 1 && !scheduledCards.has(cardKey);
    },
    markScheduled(cardKey) {
      scheduledCards.add(cardKey);
    },
    releaseScheduled(cardKey) {
      scheduledCards.delete(cardKey);
    },
    reset() {
      scheduledCards.clear();
      presentationCounts.clear();
    },
  };
}
