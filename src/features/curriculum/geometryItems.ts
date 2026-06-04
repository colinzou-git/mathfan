import type { PracticeItem } from '../../types/math';

const SKILL_GEO = 'g3-geo-categories';

function geoItem(
  id: string,
  prompt: string,
  answer: string | number,
  choices?: Array<string | number>,
  diff = 0.4,
): PracticeItem {
  return {
    id,
    skillId: SKILL_GEO,
    itemType: 'geometry_vocabulary',
    prompt,
    answer,
    choices,
    answerInput: choices ? 'choice' : 'numeric',
    tags: ['geometry', 'grade3'],
    difficulty: diff,
  };
}

// ── Sides-of-shape questions ───────────────────────────────────────────────────

const SIDES_ITEMS: PracticeItem[] = [
  geoItem('GEO_SIDES_triangle',     'How many sides does a triangle have?',     3),
  geoItem('GEO_SIDES_square',       'How many sides does a square have?',       4),
  geoItem('GEO_SIDES_rectangle',    'How many sides does a rectangle have?',    4),
  geoItem('GEO_SIDES_pentagon',     'How many sides does a pentagon have?',     5),
  geoItem('GEO_SIDES_hexagon',      'How many sides does a hexagon have?',      6),
  geoItem('GEO_SIDES_quadrilateral','How many sides does a quadrilateral have?',4),
];

// ── Name-by-sides questions ───────────────────────────────────────────────────

const NAME_ITEMS: PracticeItem[] = [
  geoItem(
    'GEO_NAME_3',
    'What do we call a polygon with 3 sides?',
    'triangle',
    ['triangle', 'square', 'pentagon', 'hexagon'],
  ),
  geoItem(
    'GEO_NAME_4',
    'What do we call a polygon with 4 sides?',
    'quadrilateral',
    ['triangle', 'quadrilateral', 'pentagon', 'hexagon'],
  ),
  geoItem(
    'GEO_NAME_5',
    'What do we call a polygon with 5 sides?',
    'pentagon',
    ['triangle', 'quadrilateral', 'pentagon', 'hexagon'],
  ),
  geoItem(
    'GEO_NAME_6',
    'What do we call a polygon with 6 sides?',
    'hexagon',
    ['triangle', 'quadrilateral', 'pentagon', 'hexagon'],
  ),
];

// ── Attribute questions ────────────────────────────────────────────────────────

const ATTR_ITEMS: PracticeItem[] = [
  geoItem(
    'GEO_ATTR_square_right',
    'How many right angles does a square have?',
    4,
  ),
  geoItem(
    'GEO_ATTR_rectangle_right',
    'How many right angles does a rectangle have?',
    4,
  ),
  geoItem(
    'GEO_ATTR_square_is_rect',
    'True or False: A square is a type of rectangle.',
    'True',
    ['True', 'False'],
    0.5,
  ),
  geoItem(
    'GEO_ATTR_rect_is_square',
    'True or False: Every rectangle is a square.',
    'False',
    ['True', 'False'],
    0.55,
  ),
  geoItem(
    'GEO_ATTR_quad_sides',
    'How many sides does a quadrilateral have?',
    4,
  ),
  geoItem(
    'GEO_ATTR_triangle_corners',
    'How many corners does a triangle have?',
    3,
  ),
];

// ── Public catalogue ──────────────────────────────────────────────────────────

export const ALL_GEO_ITEMS: PracticeItem[] = [
  ...SIDES_ITEMS,
  ...NAME_ITEMS,
  ...ATTR_ITEMS,
];

export const GEO_ITEM_MAP: Map<string, PracticeItem> = new Map(
  ALL_GEO_ITEMS.map(i => [i.id, i]),
);

export function geoItemIds(): string[] {
  return ALL_GEO_ITEMS.map(i => i.id);
}
