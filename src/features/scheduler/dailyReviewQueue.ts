import type { PlannedSessionItem, SelectionContext, StudentItemState } from '../../types/math';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { deriveCardKey } from './cardModel';
import { shuffled, type Rng } from '../../utils/rng';
import { ADAPTIVE_SELECTOR_VERSION } from '../learning/schedulingTelemetry';
import { resolveCanonicalReviewCards, type CanonicalReviewCard } from './dailyReviewCandidates';

export interface DailyReviewQueueArgs {
  /** Concrete due item ids requested for this review (e.g. from the dashboard's grouped due list). */
  requestedItemIds: string[];
  /** The student's full item-state map — used to resolve card keys and find backfill candidates. */
  states: Map<string, StudentItemState>;
  sessionLength: number;
  now: Date;
  rng: Rng;
  repeatPolicy?: 'none' | 'user_requested_rounds';
  rounds?: number;
}

function isDueNow(state: StudentItemState, nowStr: string): boolean {
  return !!(state.nextDueAt && state.nextDueAt <= nowStr);
}

/**
 * Builds a daily-review queue from the same canonical card view used to repair
 * and count the derived item-state cache. Obsolete aliases cannot inflate the
 * queue or resurrect a card whose authoritative canonical row is future-due.
 */
const selection = (origin: SelectionContext['origin'], rationaleCode: string): SelectionContext => ({
  origin,
  plannerVersion: ADAPTIVE_SELECTOR_VERSION,
  rationaleCodes: [rationaleCode],
});

export function buildDailyReviewQueue(args: DailyReviewQueueArgs): PlannedSessionItem[] {
  const { requestedItemIds, states, sessionLength, now, rng } = args;
  const nowStr = now.toISOString();
  const canonical = resolveCanonicalReviewCards([...states.values()]);
  const canonicalByKey = new Map(canonical.cards.map(card => [card.cardKey, card]));

  const usedCardKeys = new Set<string>();
  const requestedDeduped: string[] = [];
  for (const id of requestedItemIds) {
    const item = makeItemFromId(id);
    if (!item) continue;
    const cardKey = deriveCardKey(item);
    if (usedCardKeys.has(cardKey)) continue;

    // A dashboard request may contain an obsolete alias. When a current
    // authoritative state exists and is no longer due, do not resurrect it.
    const authoritative = canonicalByKey.get(cardKey);
    if (authoritative && !isDueNow(authoritative.state, nowStr)) continue;

    usedCardKeys.add(cardKey);
    requestedDeduped.push(id);
  }

  if (args.repeatPolicy === 'user_requested_rounds') {
    return buildRepeatedReviewQueue(requestedDeduped, args.rounds ?? 1, rng);
  }

  const order = shuffled(requestedDeduped, rng);
  if (order.length >= sessionLength) {
    return order.slice(0, sessionLength).map(itemId => ({
      itemId, selection: selection('due_retrieval', 'daily_review_requested_due'),
    }));
  }

  const needed = sessionLength - order.length;
  const overdue: CanonicalReviewCard[] = [];
  const weak: CanonicalReviewCard[] = [];
  for (const card of canonical.cards) {
    if (usedCardKeys.has(card.cardKey)) continue;
    if (isDueNow(card.state, nowStr)) overdue.push(card);
    else if (card.state.masteryLevel === 'learning' || card.state.masteryLevel === 'developing') weak.push(card);
  }
  overdue.sort((a, b) => (a.state.nextDueAt ?? '').localeCompare(b.state.nextDueAt ?? ''));
  weak.sort((a, b) => {
    const accA = a.state.attemptCount > 0 ? a.state.correctCount / a.state.attemptCount : 0;
    const accB = b.state.attemptCount > 0 ? b.state.correctCount / b.state.attemptCount : 0;
    return accA - accB;
  });

  const backfill: PlannedSessionItem[] = [];
  for (const card of overdue) {
    if (backfill.length >= needed) break;
    if (usedCardKeys.has(card.cardKey)) continue;
    if (!makeItemFromId(card.itemId)) continue;
    usedCardKeys.add(card.cardKey);
    backfill.push({ itemId: card.itemId, selection: selection('due_retrieval', 'daily_review_backfill_overdue') });
  }
  for (const card of weak) {
    if (backfill.length >= needed) break;
    if (usedCardKeys.has(card.cardKey)) continue;
    if (!makeItemFromId(card.itemId)) continue;
    usedCardKeys.add(card.cardKey);
    backfill.push({ itemId: card.itemId, selection: selection('weak_skill', 'daily_review_backfill_weak') });
  }

  // No distinct eligible cards remain — a shorter queue is correct, not a repeat.
  return [
    ...order.map(itemId => ({ itemId, selection: selection('due_retrieval', 'daily_review_requested_due') })),
    ...backfill,
  ];
}

export function buildRepeatedReviewQueue(baseItemIds: string[], rounds: number, rng: Rng): PlannedSessionItem[] {
  const queue: PlannedSessionItem[] = [];
  for (let round = 0; round < Math.max(1, Math.floor(rounds)); round++) {
    queue.push(...shuffled(baseItemIds, rng).map(itemId => ({
      itemId,
      selection: selection('due_retrieval', 'daily_review_requested_round'),
    })));
  }
  return queue;
}
