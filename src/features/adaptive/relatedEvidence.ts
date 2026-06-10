import type { PracticeItem, StudentItemState } from '../../types/math';
import { getRelatedItemIds } from './relatedItemMapping';
import { lookupState } from './adaptiveItemSelector';
import { applyRelatedEvidence } from '../scheduler/scheduler';

/**
 * Conservative cross-skill evidence: when a student solves a higher-level item
 * (area, word problem, data, ...) correctly on the first try, the calculation
 * facts it embeds get a mild positive FSRS nudge.
 *
 * Design rules (kept deliberately conservative and explainable):
 *   - Reinforce-only: a fact is nudged only if it ALREADY has a state. Indirect
 *     evidence never fabricates scheduling state for a fact the student has not
 *     practiced directly — so the rebuild path can reproduce it exactly.
 *   - First-try-correct only (the caller gates this): wrong higher-level answers
 *     contribute nothing, so a struggling concept never punishes its facts.
 *   - FSRS-only: applyRelatedEvidence leaves attempt/correct counts and latency
 *     untouched (see scheduler), keeping the fact's accuracy/speed stats honest.
 *   - Commutative lookup: AREA_RECT_8x7 reinforces whichever of MUL_8x7 / MUL_7x8
 *     the student actually has history for.
 *   - Concept and fact stay separate: this only touches the embedded fact's
 *     state, never the higher-level item's own state.
 */

export interface RelatedEvidenceUpdate {
  /** The reinforced fact's own state ID (commutative-resolved). */
  itemId: string;
  before: StudentItemState;
  after: StudentItemState;
}

/**
 * Compute the mild FSRS nudges for the facts embedded in `item`. Pure — does not
 * mutate `stateMap` or persist anything; the caller applies and records them.
 */
export function computeRelatedEvidence(
  item: PracticeItem,
  stateMap: Map<string, StudentItemState>,
  now: Date,
): RelatedEvidenceUpdate[] {
  const updates: RelatedEvidenceUpdate[] = [];
  const seen = new Set<string>();
  for (const rid of getRelatedItemIds(item)) {
    const before = lookupState(stateMap, rid);
    if (!before) continue;                 // reinforce-only
    if (seen.has(before.itemId)) continue; // each fact at most once per item
    seen.add(before.itemId);
    updates.push({ itemId: before.itemId, before, after: applyRelatedEvidence(before, now) });
  }
  return updates;
}
