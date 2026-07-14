import type { PracticeItem } from '../../types/math';
import { describeLearningCard, type LearningCardDescriptor } from './cardModel';

/**
 * Separates task complexity from retrieval strength. Only `atomic_fluency`
 * cards (multiplication/division facts — see cardModel) use raw latency to
 * grade FSRS scheduling; every other policy kind grades independent correct
 * answers 'good' regardless of how long the student worked, so reading time
 * and multi-step reasoning are never mistaken for weak recall.
 */
export type ResponsePolicyKind =
  | 'atomic_fluency'
  | 'procedural'
  | 'conceptual'
  | 'multi_step'
  | 'visual_interpretation';

export interface ResponsePolicy {
  kind: ResponsePolicyKind;
  useLatencyForFsrs: boolean;
  easyMs?: number;
  hardMs?: number;
}

/** Fallback latency thresholds for atomic_fluency cards with no student-relative baseline yet. */
export const DEFAULT_FLUENCY_EASY_MS = 1500;
export const DEFAULT_FLUENCY_HARD_MS = 4000;

const VISUAL_ITEM_TYPES = new Set([
  'time_to_minute',
  'elapsed_time',
  'bar_graph_read',
  'line_plot_read',
  'fraction_number_line',
]);

const PROCEDURAL_ITEM_TYPES = new Set([
  'addition_fact',
  'subtraction_fact',
  'rounding',
]);

function policyKindForItem(item: PracticeItem): ResponsePolicyKind {
  const card = describeLearningCard(item);
  if (card.kind === 'atomic_fact') return 'atomic_fluency';
  if (item.id.startsWith('WRD2_')) return 'multi_step';
  if (VISUAL_ITEM_TYPES.has(item.itemType)) return 'visual_interpretation';
  if (PROCEDURAL_ITEM_TYPES.has(item.itemType)) return 'procedural';
  return 'conceptual';
}

export function policyForCard(card: LearningCardDescriptor): ResponsePolicy {
  if (card.kind === 'atomic_fact') {
    return {
      kind: 'atomic_fluency',
      useLatencyForFsrs: true,
      easyMs: DEFAULT_FLUENCY_EASY_MS,
      hardMs: DEFAULT_FLUENCY_HARD_MS,
    };
  }
  return { kind: 'conceptual', useLatencyForFsrs: false };
}

export function policyForItem(item: PracticeItem): ResponsePolicy {
  const kind = policyKindForItem(item);
  if (kind === 'atomic_fluency') {
    return {
      kind,
      useLatencyForFsrs: true,
      easyMs: DEFAULT_FLUENCY_EASY_MS,
      hardMs: DEFAULT_FLUENCY_HARD_MS,
    };
  }
  return { kind, useLatencyForFsrs: false };
}
