import type { StudentItemState } from '../../types/math';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { deriveCardKey } from './cardModel';
import { shuffled, type Rng } from '../../utils/rng';

export interface DailyReviewQueueArgs {
  /** Concrete due item ids requested for this review (e.g. from the dashboard's grouped due list). */
  requestedItemIds: string[];
  /** The student's full item-state map — used to resolve card keys and find backfill candidates. */
  states: Map<string, StudentItemState>;
  sessionLength: number;
  now: Date;
  rng: Rng;
}

function isDueNow(state: StudentItemState, nowStr: string): boolean {
  return !!(state.nextDueAt && state.nextDueAt <= nowStr);
}

/**
 * Builds a daily-review queue that includes every requested due card at most
 * once (issue #28) instead of repeating due items to fill sessionLength.
 * When the requested set is smaller than sessionLength, backfills with other
 * distinct eligible cards from the student's own history — overdue cards
 * first, then weak/developing ones — and returns a shorter queue rather than
 * repeating a card.
 */
export function buildDailyReviewQueue(args: DailyReviewQueueArgs): string[] {
  const { requestedItemIds, states, sessionLength, now, rng } = args;
  const nowStr = now.toISOString();

  const usedCardKeys = new Set<string>();
  const requestedDeduped: string[] = [];
  for (const id of requestedItemIds) {
    const item = makeItemFromId(id);
    if (!item) continue;
    const cardKey = deriveCardKey(item);
    if (usedCardKeys.has(cardKey)) continue;
    usedCardKeys.add(cardKey);
    requestedDeduped.push(id);
  }

  const order = shuffled(requestedDeduped, rng);
  if (order.length >= sessionLength) return order.slice(0, sessionLength);

  const needed = sessionLength - order.length;
  const overdue: StudentItemState[] = [];
  const weak: StudentItemState[] = [];
  for (const state of states.values()) {
    if (usedCardKeys.has(state.cardKey)) continue;
    if (isDueNow(state, nowStr)) overdue.push(state);
    else if (state.masteryLevel === 'learning' || state.masteryLevel === 'developing') weak.push(state);
  }
  overdue.sort((a, b) => (a.nextDueAt ?? '').localeCompare(b.nextDueAt ?? ''));
  weak.sort((a, b) => {
    const accA = a.attemptCount > 0 ? a.correctCount / a.attemptCount : 0;
    const accB = b.attemptCount > 0 ? b.correctCount / b.attemptCount : 0;
    return accA - accB;
  });

  const backfill: string[] = [];
  for (const state of [...overdue, ...weak]) {
    if (backfill.length >= needed) break;
    if (usedCardKeys.has(state.cardKey)) continue;
    const itemId = state.lastItemId;
    if (!itemId || !makeItemFromId(itemId)) continue;
    usedCardKeys.add(state.cardKey);
    backfill.push(itemId);
  }

  // No distinct eligible cards remain — a shorter queue is correct, not a repeat.
  return [...order, ...backfill];
}
