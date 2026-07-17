/**
 * Enforces the independent-review invariant from issue #28: a canonical card
 * may start at most one independent FSRS review per practice session. A failed
 * presentation's causal relearning completion is tracked separately by the
 * practice session and does not reserve the card again.
 *
 * Presentation counting and scheduling-eligibility are deliberately separate:
 * a card can be *presented* many times in a session (each contributes to
 * practice stats), but only its first scheduling-eligible presentation may
 * start an independent review. markScheduled() is called synchronously, before the
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

export function createSessionSchedulingGuard(initialScheduledCardKeys: Iterable<string> = []): SessionSchedulingGuard {
  const scheduledCards = new Set<string>(initialScheduledCardKeys);
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
