import type { ItemType } from '../../types/math';
import { ITEM_MAP } from './multiplicationItems';

export interface ItemDescription {
  prompt: string;
  itemType: ItemType;
  /** Coarse operation group for filtering: ×, ÷, +, −, frac, or other. */
  group: 'mul' | 'div' | 'unk' | 'add' | 'sub' | 'frac' | 'other';
}

/**
 * Resolve a human-readable prompt + type from an itemId alone.
 * Works for dynamically generated items (addition, subtraction, division,
 * fractions) that are not in the static ITEM_MAP.
 */
export function describeItem(itemId: string): ItemDescription {
  // Multiplication: MUL_3x4
  let m = itemId.match(/^MUL_(\d+)x(\d+)$/);
  if (m) return { prompt: `${m[1]} × ${m[2]}`, itemType: 'multiplication_fact', group: 'mul' };

  // Unknown factor: UNK_{product}k{known}
  m = itemId.match(/^UNK_(\d+)k(\d+)$/);
  if (m) return { prompt: `${m[2]} × ? = ${m[1]}`, itemType: 'unknown_factor', group: 'unk' };

  // Division: DIV_{dividend}d{divisor}
  m = itemId.match(/^DIV_(\d+)d(\d+)$/);
  if (m) return { prompt: `${m[1]} ÷ ${m[2]}`, itemType: 'division_fact', group: 'div' };

  // Addition: ADD_{a}p{b}
  m = itemId.match(/^ADD_(\d+)p(\d+)$/);
  if (m) return { prompt: `${m[1]} + ${m[2]}`, itemType: 'addition_fact', group: 'add' };

  // Subtraction: SUB_{a}m{b}
  m = itemId.match(/^SUB_(\d+)m(\d+)$/);
  if (m) return { prompt: `${m[1]} − ${m[2]}`, itemType: 'subtraction_fact', group: 'sub' };

  // Fraction equivalent: FEQ_{n}_{d}_{targetDen}
  m = itemId.match(/^FEQ_(\d+)_(\d+)_(\d+)$/);
  if (m) return { prompt: `${m[1]}/${m[2]} = ?/${m[3]}`, itemType: 'fraction_equivalent', group: 'frac' };

  // Fraction compare: FCMP_{n1}_{d1}_{n2}_{d2}
  m = itemId.match(/^FCMP_(\d+)_(\d+)_(\d+)_(\d+)$/);
  if (m) return { prompt: `${m[1]}/${m[2]} ▢ ${m[3]}/${m[4]}`, itemType: 'fraction_compare', group: 'frac' };

  // Fallback to the static catalogue (or the raw id)
  const item = ITEM_MAP.get(itemId);
  if (item) {
    const group = item.itemType === 'multiplication_fact' ? 'mul'
      : item.itemType === 'division_fact' ? 'div'
      : item.itemType === 'unknown_factor' ? 'unk' : 'other';
    return { prompt: item.prompt, itemType: item.itemType, group };
  }
  return { prompt: itemId, itemType: 'multiplication_fact', group: 'other' };
}

export function itemPrompt(itemId: string): string {
  return describeItem(itemId).prompt;
}
