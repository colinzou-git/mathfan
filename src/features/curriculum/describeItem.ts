import type { ItemType } from '../../types/math';
import { ITEM_MAP } from './multiplicationItems';

export interface ItemDescription {
  prompt: string;
  itemType: ItemType;
  /** Coarse operation group for filtering/tabs. */
  group: 'mul' | 'div' | 'unk' | 'add' | 'sub' | 'frac' | 'word' | 'round' | 'factors' | 'dec' | 'other';
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

  // Word problem: WORD_{schema}_{a}_{b}
  m = itemId.match(/^WORD_([a-z]+)_(\d+)_(\d+)$/);
  if (m) {
    const schemaLabel: Record<string, string> = {
      eg: 'equal groups', ar: 'array', cmp: 'compare', dv: 'sharing',
    };
    const label = schemaLabel[m[1]] ?? m[1];
    const op = m[1] === 'dv' ? `${Number(m[2]) * Number(m[3])} ÷ ${m[2]}` : `${m[2]} × ${m[3]}`;
    return { prompt: `Word: ${op} (${label})`, itemType: 'word_problem', group: 'word' };
  }

  // Rounding: ROUND_{n}_{place}
  m = itemId.match(/^ROUND_(\d+)_(\d+)$/);
  if (m) return { prompt: `Round ${m[1]} → ${m[2]}`, itemType: 'rounding', group: 'round' };

  // Prime/composite: PRIME_{n}
  m = itemId.match(/^PRIME_(\d+)$/);
  if (m) return { prompt: `${m[1]} prime?`, itemType: 'prime_composite', group: 'factors' };

  // Factor check: FACT_{x}_{y}
  m = itemId.match(/^FACT_(\d+)_(\d+)$/);
  if (m) return { prompt: `${m[1]} factor of ${m[2]}?`, itemType: 'factor_check', group: 'factors' };

  // Decimal add: DADD_{a}_{b}  (tokens use 'p' for the decimal point)
  m = itemId.match(/^DADD_([\dp]+)_([\dp]+)$/);
  if (m) return { prompt: `${m[1].replace('p', '.')} + ${m[2].replace('p', '.')}`, itemType: 'decimal_add', group: 'dec' };

  // Decimal sub: DSUB_{a}_{b}
  m = itemId.match(/^DSUB_([\dp]+)_([\dp]+)$/);
  if (m) return { prompt: `${m[1].replace('p', '.')} − ${m[2].replace('p', '.')}`, itemType: 'decimal_sub', group: 'dec' };

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
