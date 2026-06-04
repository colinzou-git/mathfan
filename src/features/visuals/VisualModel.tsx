/**
 * VisualModel — given a PracticeItem, renders the most appropriate visual model.
 *
 * Supported item types in this phase:
 * - multiplication_fact / unknown_factor → ArrayModel
 * - word_problem with 'eg' schema → EqualGroupsModel
 * - fraction_equivalent / fraction_compare / fraction_number_line → FractionBar
 *
 * Returns null for item types with no suitable visual.
 */

import type { PracticeItem } from '../../types/math';
import { ArrayModel } from './ArrayModel';
import { EqualGroupsModel } from './EqualGroupsModel';
import { FractionBar } from './FractionBar';

interface Props {
  item: PracticeItem;
  /** Optional color override passed to the chosen visual. */
  color?: string;
}

function parseFractionFromPrompt(prompt: string): { n: number; d: number } | null {
  // Matches prompts like "2/3 = ?/6" or "Compare: 1/4 vs 3/4"
  const m = prompt.match(/(\d+)\/(\d+)/);
  if (!m) return null;
  return { n: parseInt(m[1], 10), d: parseInt(m[2], 10) };
}

function parseEqualGroupsFromId(itemId: string): { groups: number; perGroup: number } | null {
  // WORD_eg_{a}_{b} — a = groups, b = items per group
  const m = itemId.match(/^WORD_eg_(\d+)_(\d+)$/);
  if (!m) return null;
  return { groups: parseInt(m[1], 10), perGroup: parseInt(m[2], 10) };
}

export function VisualModel({ item, color }: Props) {
  const { itemType, factA, factB, id, prompt } = item;

  // ── Multiplication array ──────────────────────────────────────────────────
  if (
    (itemType === 'multiplication_fact' || itemType === 'unknown_factor') &&
    factA != null && factB != null &&
    factA >= 1 && factA <= 10 && factB >= 1 && factB <= 10
  ) {
    return (
      <ArrayModel
        rows={factA}
        cols={factB}
        color={color}
        ariaLabel={`Array showing ${factA} rows of ${factB} dots = ${factA * factB} total`}
      />
    );
  }

  // ── Equal-groups word problem ─────────────────────────────────────────────
  if (itemType === 'word_problem') {
    const parsed = parseEqualGroupsFromId(id);
    if (parsed) {
      return (
        <EqualGroupsModel
          groups={parsed.groups}
          itemsPerGroup={parsed.perGroup}
        />
      );
    }
  }

  // ── Fraction bar ─────────────────────────────────────────────────────────
  if (
    itemType === 'fraction_equivalent' ||
    itemType === 'fraction_compare' ||
    itemType === 'fraction_number_line'
  ) {
    const frac = parseFractionFromPrompt(prompt);
    if (frac) {
      return (
        <FractionBar
          numerator={frac.n}
          denominator={frac.d}
          fillColor={color}
        />
      );
    }
  }

  // ── Area model ───────────────────────────────────────────────────────────
  if (
    (itemType === 'area_unit_squares' || itemType === 'area_rectangle') &&
    factA != null && factB != null &&
    factA >= 1 && factA <= 10 && factB >= 1 && factB <= 10
  ) {
    return (
      <ArrayModel
        rows={factA}
        cols={factB}
        color={color}
        ariaLabel={`Area grid: ${factA} rows × ${factB} columns = ${factA * factB} square units`}
      />
    );
  }

  // No visual available for this item type
  return null;
}
