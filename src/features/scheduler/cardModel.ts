import type { PracticeItem, StudentItemState, GradeLevel } from '../../types/math';
import type { MathAnswerEvent } from '../learning/learningEvents';

/**
 * Canonical learning-card layer sitting above concrete item instances.
 *
 * - atomic_fact cards are retrieval memories that should be scheduled as one
 *   stable fact regardless of numeric orientation (e.g. 7×8 and 8×7 are the
 *   same multiplication fact). Only multiplication and division are folded
 *   into atomic-fact cards in this first implementation — see issue #26.
 * - template cards are everything else. Until the curriculum-redesign issues
 *   (#30-#34) register real generators in templateRegistry.ts, a template
 *   card degenerates to a 1:1 mapping with its concrete item id — this keeps
 *   today's scheduling behavior for those item types while giving them a
 *   stable place to grow into real templates without another migration.
 */

export type LearningCardKind = 'atomic_fact' | 'template';

export interface LearningCardDescriptor {
  cardKey: string;
  kind: LearningCardKind;
  skillId: string;
  schemaId: string;
  gradeLevel: GradeLevel;
}

const DEFAULT_GRADE: GradeLevel = 3;

/** Canonicalizes commutative multiplication orientation: MUL_7x8 and MUL_8x7 both map here. */
function canonicalMultiplicationCardKey(a: number, b: number): string {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `fact:mul:${lo}x${hi}`;
}

/** Division is kept as its own retrieval card — never folded into multiplication. */
function divisionCardKey(dividend: number, divisor: number): string {
  return `fact:div:${dividend}/${divisor}`;
}

const AREA_PERIM_TEMPLATE_PREFIX = 'template:g3-area-perimeter:';

/**
 * Derives a canonical card key from a concrete item id.
 * Multiplication and division facts resolve to atomic-fact keys; rectangle
 * area/perimeter instances resolve to stable schema templates; everything else falls
 * back to a 1:1 template key (`template:<itemId>`) until a real template
 * generator is registered for that schema.
 */
export function deriveCardKeyFromItemId(itemId: string): string {
  let m: RegExpMatchArray | null;
  if ((m = itemId.match(/^MUL_(\d+)x(\d+)$/))) {
    return canonicalMultiplicationCardKey(+m[1], +m[2]);
  }
  if ((m = itemId.match(/^DIV_(\d+)d(\d+)$/))) {
    return divisionCardKey(+m[1], +m[2]);
  }
  if (/^AREA_SQ_\d+x\d+$/.test(itemId)) return `${AREA_PERIM_TEMPLATE_PREFIX}area_count_squares`;
  if (/^AREA_RECT_\d+x\d+$/.test(itemId)) return `${AREA_PERIM_TEMPLATE_PREFIX}area_rows_columns`;
  if (/^PERIM_RECT_\d+x\d+$/.test(itemId)) return `${AREA_PERIM_TEMPLATE_PREFIX}perimeter_rectangle_structure`;
  if (/^PERIM_POLY_/.test(itemId)) return `${AREA_PERIM_TEMPLATE_PREFIX}perimeter_sum_sides`;
  if (/^PERIM_UNKSIDE_/.test(itemId)) return `${AREA_PERIM_TEMPLATE_PREFIX}perimeter_missing_side`;
  if (/^AP_CHOICE_/.test(itemId)) return `${AREA_PERIM_TEMPLATE_PREFIX}area_or_perimeter_choice`;
  if (/^RECTI_/.test(itemId)) return `${AREA_PERIM_TEMPLATE_PREFIX}rectilinear_area_decompose`;
  if (/^AREA_PERIM_CMP_sadp_/.test(itemId)) return `${AREA_PERIM_TEMPLATE_PREFIX}same_area_diff_perimeter`;
  if (/^AREA_PERIM_CMP_spad_/.test(itemId)) return `${AREA_PERIM_TEMPLATE_PREFIX}same_perimeter_diff_area`;
  return `template:${itemId}`;
}

/** Prefers a structured `item.cardKey` when present; falls back to id parsing. */
export function deriveCardKey(item: PracticeItem): string {
  if (item.cardKey) return item.cardKey;
  return deriveCardKeyFromItemId(item.id);
}

/** Same as `deriveCardKey`, but for a stored answer event. Returns null only when the event has no usable item id. */
export function deriveCardKeyFromEvent(event: MathAnswerEvent): string | null {
  if (event.cardKey) return event.cardKey;
  if (!event.itemId) return null;
  return deriveCardKeyFromItemId(event.itemId);
}

export function isAtomicFactCard(cardKey: string): boolean {
  return cardKey.startsWith('fact:');
}

export function isTemplateCard(cardKey: string): boolean {
  return cardKey.startsWith('template:');
}

export function describeLearningCard(item: PracticeItem): LearningCardDescriptor {
  const cardKey = deriveCardKey(item);
  return {
    cardKey,
    kind: isAtomicFactCard(cardKey) ? 'atomic_fact' : 'template',
    skillId: item.skillId,
    schemaId: item.schemaId ?? item.itemType,
    gradeLevel: item.gradeLevel ?? DEFAULT_GRADE,
  };
}

/**
 * Single card-aware lookup helper — used by every selector/scorer instead of
 * `states.get(item.id)` so scheduling state always resolves through the
 * canonical card key.
 */
export function stateForItem(
  item: PracticeItem,
  states: Map<string, StudentItemState>
): StudentItemState | undefined {
  return states.get(deriveCardKey(item));
}
