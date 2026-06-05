/**
 * VisualModel — given a PracticeItem, renders the most appropriate visual model.
 *
 * Supported item types:
 * - multiplication_fact / unknown_factor → ArrayModel (dot grid)
 * - word_problem with 'eg' schema → EqualGroupsModel
 * - fraction_equivalent / fraction_compare / fraction_number_line → FractionBar
 * - area_unit_squares → AreaGrid (unit square grid)
 * - area_rectangle → AreaGrid (labeled rectangle)
 * - perimeter_rectangle → AreaGrid (labeled outline)
 * - geometry_vocabulary → ShapeModel (SVG polygon)
 *
 * Returns null for item types with no suitable visual.
 */

import type { PracticeItem } from '../../types/math';
import { ArrayModel } from './ArrayModel';
import { EqualGroupsModel } from './EqualGroupsModel';
import { FractionBar } from './FractionBar';
import { AreaGrid } from './AreaGrid';
import { ShapeModel } from './ShapeModel';
import type { ShapeName } from './ShapeModel';

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

function geoShapeFromItemId(id: string): ShapeName | null {
  const sidesMatch = id.match(/^GEO_SIDES_(\w+)$/);
  if (sidesMatch) {
    const s = sidesMatch[1] as ShapeName;
    if (['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'quadrilateral'].includes(s)) return s;
  }
  const nameMatch = id.match(/^GEO_NAME_(\d+)$/);
  if (nameMatch) {
    const map: Record<number, ShapeName> = { 3: 'triangle', 4: 'quadrilateral', 5: 'pentagon', 6: 'hexagon' };
    return map[parseInt(nameMatch[1], 10)] ?? null;
  }
  if (id.startsWith('GEO_ATTR_square')) return 'square';
  if (id.startsWith('GEO_ATTR_rectangle') || id.startsWith('GEO_ATTR_rect_')) return 'rectangle';
  if (id.startsWith('GEO_ATTR_quad')) return 'quadrilateral';
  if (id.startsWith('GEO_ATTR_triangle')) return 'triangle';
  return null;
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
  if (itemType === 'area_unit_squares' && factA != null && factB != null) {
    return <AreaGrid rows={factA} cols={factB} mode="unit_squares" color={color} />;
  }

  if (itemType === 'area_rectangle' && factA != null && factB != null) {
    return <AreaGrid rows={factA} cols={factB} mode="rectangle" color={color} />;
  }

  if (itemType === 'perimeter_rectangle' && factA != null && factB != null) {
    return <AreaGrid rows={factA} cols={factB} mode="perimeter" color={color} />;
  }

  // ── Geometry shape ────────────────────────────────────────────────────────
  if (itemType === 'geometry_vocabulary') {
    const shape = geoShapeFromItemId(id);
    if (shape) return <ShapeModel shape={shape} color={color} />;
  }

  // No visual available for this item type
  return null;
}
