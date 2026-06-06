import type { PracticeItem } from '../../types/math';
import type { ShapeName } from './ShapeModel';

export function parseFractionFromPrompt(prompt: string): { n: number; d: number } | null {
  const m = prompt.match(/(\d+)\/(\d+)/);
  if (!m) return null;
  return { n: parseInt(m[1], 10), d: parseInt(m[2], 10) };
}

export function geoShapeFromItemId(id: string): ShapeName | null {
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

/** Returns true when VisualModel will render a non-null visual for the item. */
export function hasVisualModel(item: PracticeItem): boolean {
  const { itemType, factA, factB, id, prompt } = item;

  if ((itemType === 'multiplication_fact' || itemType === 'unknown_factor') &&
      factA != null && factB != null &&
      factA >= 1 && factA <= 10 && factB >= 1 && factB <= 10) return true;

  if (itemType === 'word_problem' && id.startsWith('WORD_eg_')) return true;

  if (itemType === 'fraction_number_line') {
    const d = factB ?? parseFractionFromPrompt(prompt)?.d ?? null;
    return d != null && d >= 1;
  }

  if (itemType === 'fraction_equivalent' || itemType === 'fraction_compare') {
    return parseFractionFromPrompt(prompt) != null;
  }

  if ((itemType === 'area_unit_squares' || itemType === 'area_rectangle' ||
       itemType === 'perimeter_rectangle') && factA != null && factB != null) return true;

  if (itemType === 'geometry_vocabulary') return geoShapeFromItemId(id) != null;

  if (itemType === 'time_to_minute' && factA != null && factB != null) return true;

  return false;
}
