import type { PracticeItem, StudentItemState } from '../../types/math';
import { getRelatedItemIds } from './relatedItemMapping';
import { deriveCardKeyFromItemId, stateForItem } from '../scheduler/cardModel';
import type { Rng } from '../../utils/rng';

/**
 * FSRS-informed selection for calculation-embedded higher-level practice.
 *
 * Each candidate is scored by the student's existing item-state history — both
 * for the item itself and for the underlying calculation it embeds — and the
 * queue is filled with a quota model so the session is dominated by the facts
 * that most need practice, while still leaving room for new/variety content and
 * occasional maintenance review of mastered facts.
 *
 * Two scoring rules keep new users from being skewed:
 *   - Unseen *related* calculations contribute nothing (only existing states
 *     that are due/weak/low-accuracy add a boost), so an item is never favoured
 *     just for embedding many calculations it has no history for.
 *   - Related boosts use the neediest related fact (max), not a sum, so a
 *     rectilinear/line-plot item with several embedded facts does not dominate.
 *
 * Multiplication and addition lookups are commutative: AREA_RECT_8x7 consults
 * whichever of MUL_8x7 / MUL_7x8 the student actually has a state for.
 */

export interface AdaptiveQuotas {
  /** Share of the session for due/weak/low-accuracy candidates. */
  priority: number;
  /** Share for new/unseen variety. */
  variety: number;
  /** Share reserved for mastered, not-yet-due maintenance review. */
  maintenance: number;
}

export interface AdaptiveOptions {
  /**
   * Tie-break randomness magnitude added to each score before sorting. Keeps
   * selection varied when many candidates score equally (e.g. a student with no
   * history), without overriding real differences. 0 = fully deterministic.
   */
  jitter?: number;
  /** Override the default 75/15/10 priority/variety/maintenance split. */
  quotas?: AdaptiveQuotas;
  /**
   * Seeded random source for the tie-break jitter. Defaults to Math.random.
   * Pass a seeded Rng (see utils/rng) to make selection ordering reproducible.
   */
  rng?: Rng;
}

const DEFAULT_JITTER = 0.5;
const DEFAULT_QUOTAS: AdaptiveQuotas = { priority: 0.75, variety: 0.15, maintenance: 0.10 };

/** Unseen candidate items get a mild positive score so new content still surfaces. */
const UNSEEN_OWN_SCORE = 10;
const MISCONCEPTION_BRIDGE_BOOST = 60;

type Tier = 'priority' | 'variety' | 'maintenance';

// ── State helpers ───────────────────────────────────────────────────────────────

function isDue(state: StudentItemState, nowStr: string): boolean {
  return !!(state.nextDueAt && state.nextDueAt <= nowStr);
}

/**
 * Look up a concrete item id's state via its canonical card key. Commutative
 * orientations (e.g. MUL_7x8 / MUL_8x7) already resolve to the same card key
 * — see features/scheduler/cardModel — so no manual operand-swap is needed.
 */
export function lookupState(
  stateMap: Map<string, StudentItemState>,
  id: string,
): StudentItemState | undefined {
  return stateMap.get(deriveCardKeyFromItemId(id));
}

/** True when a fact needs practice: due, still being learned, or low accuracy. */
export function isNeedyState(state: StudentItemState, now: Date): boolean {
  if (isDue(state, now.toISOString())) return true;
  if (state.masteryLevel === 'learning' || state.masteryLevel === 'developing') return true;
  const accuracy = state.attemptCount > 0 ? state.correctCount / state.attemptCount : 1;
  return accuracy < 0.75;
}

/** How much a fact (own or related) wants to be practiced. Only called for existing states. */
function needScore(state: StudentItemState, nowStr: string): number {
  let s = 0;
  const due = isDue(state, nowStr);
  if (due) s += 100;
  switch (state.masteryLevel) {
    case 'new': s += 15; break;
    case 'learning': s += 50; break;
    case 'developing': s += 30; break;
    case 'strong': s += due ? 0 : -10; break;
    case 'mastered': s += due ? 0 : -25; break;
  }
  const accuracy = state.attemptCount > 0 ? state.correctCount / state.attemptCount : 1;
  s += (1 - accuracy) * 40;
  return s;
}

/** Prefer an instructional bridge that directly addresses a recent area/perimeter misconception. */
export function misconceptionBridgeBoost(item: PracticeItem, state?: StudentItemState): number {
  if (!state?.mistakePatterns.length) return 0;
  const patterns = new Set(state.mistakePatterns);
  const schema = item.schemaId;
  const tags = new Set(item.tags);
  const matches =
    ((patterns.has('area_perim:used_area_for_perimeter') || patterns.has('area_perim:used_perimeter_for_area'))
      && (schema === 'area_or_perimeter_choice' || schema === 'area_count_squares'))
    || ((patterns.has('area_perim:used_half_perimeter') || patterns.has('area_perim:forgot_one_pair_of_sides'))
      && (schema === 'perimeter_sum_sides' || schema === 'perimeter_rectangle_structure'))
    || ((patterns.has('area_perim:copied_given_perimeter') || patterns.has('area_perim:summed_non_boundary_values')
      || patterns.has('area_perim:missing_side_subtraction_error'))
      && schema === 'perimeter_missing_side' && (tags.has('equation') || tags.has('sum_known_sides')));
  return matches ? MISCONCEPTION_BRIDGE_BOOST : 0;
}

// ── Scoring ─────────────────────────────────────────────────────────────────────

/**
 * Priority score for a candidate: its own state (mild positive when unseen) plus
 * the neediest embedded calculation it has history for. Unseen related facts add
 * nothing.
 */
export function scoreCandidateItem(
  item: PracticeItem,
  stateMap: Map<string, StudentItemState>,
  now: Date,
): number {
  const nowStr = now.toISOString();
  const own = stateForItem(item, stateMap);
  const score = (own ? needScore(own, nowStr) : UNSEEN_OWN_SCORE) + misconceptionBridgeBoost(item, own);

  let relatedBoost = 0;
  let hasRelatedState = false;
  for (const rid of getRelatedItemIds(item)) {
    const st = lookupState(stateMap, rid);
    if (!st) continue;
    const v = needScore(st, nowStr);
    relatedBoost = hasRelatedState ? Math.max(relatedBoost, v) : v;
    hasRelatedState = true;
  }
  return score + relatedBoost;
}

/** Candidates sorted by descending priority (with optional tie-break jitter). */
export function rankCandidateItems(
  items: PracticeItem[],
  stateMap: Map<string, StudentItemState>,
  now: Date,
  options?: AdaptiveOptions,
): PracticeItem[] {
  const jitter = options?.jitter ?? DEFAULT_JITTER;
  const rng = options?.rng ?? Math.random;
  return items
    .map(item => ({
      item,
      score: scoreCandidateItem(item, stateMap, now) + (jitter ? (rng() - 0.5) * jitter : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}

// ── Tiering & selection ─────────────────────────────────────────────────────────

/** Classify a candidate for quota allocation. */
function itemTier(item: PracticeItem, stateMap: Map<string, StudentItemState>, now: Date): Tier {
  const nowStr = now.toISOString();
  const states: StudentItemState[] = [];
  const own = stateForItem(item, stateMap);
  if (own) states.push(own);
  for (const rid of getRelatedItemIds(item)) {
    const st = lookupState(stateMap, rid);
    if (st) states.push(st);
  }
  if (states.length === 0) return 'variety'; // nothing known yet
  if (states.some(st => isNeedyState(st, now))) return 'priority';
  const allWellKnown = states.every(
    st => (st.masteryLevel === 'mastered' || st.masteryLevel === 'strong') && !isDue(st, nowStr),
  );
  return allWellKnown ? 'maintenance' : 'variety';
}

/**
 * Build a queue of `count` item IDs from the candidate pool using a quota model:
 * ~75% due/weak priority items, ~15% new/variety, ~10% mastered maintenance
 * (when available). Each tier is ranked adaptively; shortfalls backfill from the
 * remaining ranked candidates, and a pool smaller than `count` is cycled to fill
 * the rest — so mastered items are never permanently excluded.
 */
export function selectAdaptiveItems(
  items: PracticeItem[],
  stateMap: Map<string, StudentItemState>,
  now: Date,
  count: number,
  options?: AdaptiveOptions,
): string[] {
  if (count <= 0 || items.length === 0) return [];

  const quotas = options?.quotas ?? DEFAULT_QUOTAS;

  const buckets: Record<Tier, PracticeItem[]> = { priority: [], variety: [], maintenance: [] };
  for (const it of items) buckets[itemTier(it, stateMap, now)].push(it);

  const priority = rankCandidateItems(buckets.priority, stateMap, now, options);
  const variety = rankCandidateItems(buckets.variety, stateMap, now, options);
  const maintenance = rankCandidateItems(buckets.maintenance, stateMap, now, options);

  const nMaint = Math.min(Math.round(count * quotas.maintenance), maintenance.length);
  const nVariety = Math.min(Math.round(count * quotas.variety), variety.length);
  const nPriority = count - nMaint - nVariety;

  const selected: string[] = [];
  const used = new Set<string>();
  const take = (arr: PracticeItem[], n: number) => {
    let taken = 0;
    for (const it of arr) {
      if (selected.length >= count || taken >= n) break;
      if (used.has(it.id)) continue;
      selected.push(it.id);
      used.add(it.id);
      taken++;
    }
  };
  take(priority, nPriority);
  take(variety, nVariety);
  take(maintenance, nMaint);

  // Backfill any remaining slots from whatever ranked candidates are left.
  if (selected.length < count) {
    for (const it of [...priority, ...variety, ...maintenance]) {
      if (selected.length >= count) break;
      if (used.has(it.id)) continue;
      selected.push(it.id);
      used.add(it.id);
    }
  }

  // Pool smaller than the session: cycle the distinct selection to fill the rest.
  if (selected.length > 0 && selected.length < count) {
    const base = [...selected];
    let i = 0;
    while (selected.length < count) {
      selected.push(base[i % base.length]);
      i++;
    }
  }

  return selected;
}
