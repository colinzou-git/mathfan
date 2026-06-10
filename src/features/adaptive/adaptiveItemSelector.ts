import type { PracticeItem, StudentItemState } from '../../types/math';
import { getRelatedItemIds } from './relatedItemMapping';

/**
 * FSRS-informed selection for calculation-embedded higher-level practice.
 *
 * Instead of choosing items purely at random, score each candidate by the
 * student's existing item-state history — both for the item itself and for the
 * underlying calculation it embeds — and prefer the ones that most need
 * practice (due / weak / low-accuracy). Mastered, not-yet-due items are
 * deprioritised but never fully banned: when FSRS marks them due they jump back
 * to the top, and they remain selectable whenever the candidate pool is small.
 */

export interface AdaptiveOptions {
  /**
   * Tie-break randomness magnitude added to each score before sorting. Keeps
   * selection varied when many candidates score equally (e.g. a student with no
   * history), without overriding real differences. 0 = fully deterministic.
   */
  jitter?: number;
}

const DEFAULT_JITTER = 0.5;

/** Unseen items get a mild positive score so brand-new content still surfaces. */
const UNSEEN_SCORE = 8;

/** Score a single item/related state: higher = needs practice more. */
function stateScore(state: StudentItemState | undefined, nowStr: string): number {
  if (!state) return UNSEEN_SCORE;
  let s = 0;
  const due = !!(state.nextDueAt && state.nextDueAt <= nowStr);
  if (due) s += 100;
  switch (state.masteryLevel) {
    case 'new': s += 15; break;
    case 'learning': s += 50; break;
    case 'developing': s += 30; break;
    case 'strong': s += due ? 0 : -20; break;
    case 'mastered': s += due ? 0 : -40; break;
  }
  const accuracy = state.attemptCount > 0 ? state.correctCount / state.attemptCount : 1;
  s += (1 - accuracy) * 40;
  return s;
}

/**
 * Priority score for a candidate: its own state plus the neediest embedded
 * calculation (with a smaller contribution from any additional related facts).
 */
export function scoreCandidateItem(
  item: PracticeItem,
  stateMap: Map<string, StudentItemState>,
  now: Date,
): number {
  const nowStr = now.toISOString();
  let score = stateScore(stateMap.get(item.id), nowStr);

  const related = getRelatedItemIds(item);
  if (related.length > 0) {
    let best = -Infinity;
    let sum = 0;
    for (const rid of related) {
      const v = stateScore(stateMap.get(rid), nowStr);
      best = Math.max(best, v);
      sum += v;
    }
    score += best + 0.3 * (sum - best);
  }
  return score;
}

/** Candidates sorted by descending priority (with optional tie-break jitter). */
export function rankCandidateItems(
  items: PracticeItem[],
  stateMap: Map<string, StudentItemState>,
  now: Date,
  options?: AdaptiveOptions,
): PracticeItem[] {
  const jitter = options?.jitter ?? DEFAULT_JITTER;
  return items
    .map(item => ({
      item,
      score: scoreCandidateItem(item, stateMap, now) + (jitter ? (Math.random() - 0.5) * jitter : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}

/**
 * Build a queue of `count` item IDs from the candidate pool, ranked adaptively.
 * When the pool has at least `count` items the top `count` are taken (so well-
 * mastered items are left out unless they are due). When the pool is smaller the
 * ranked list is cycled to fill the queue, which keeps every candidate (mastered
 * included) selectable and spreads repeats out instead of clustering them.
 */
export function selectAdaptiveItems(
  items: PracticeItem[],
  stateMap: Map<string, StudentItemState>,
  now: Date,
  count: number,
  options?: AdaptiveOptions,
): string[] {
  if (count <= 0 || items.length === 0) return [];
  const ranked = rankCandidateItems(items, stateMap, now, options);
  const queue: string[] = [];
  if (count <= ranked.length) {
    for (let i = 0; i < count; i++) queue.push(ranked[i].id);
  } else {
    let i = 0;
    while (queue.length < count) {
      queue.push(ranked[i % ranked.length].id);
      i++;
    }
  }
  return queue;
}
