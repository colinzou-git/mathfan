import type { PracticeItem, PerimeterReasoningSpec } from '../../types/math';
import type { VisualSpec, Point } from '../visuals/types';
import { pluralizeUnit } from '../../utils/grammar';

export type AreaPerimVariant = 'sadp' | 'spad';

export type AreaPerimeterSchema =
  | 'area_count_squares'
  | 'area_rows_columns'
  | 'perimeter_sum_sides'
  | 'perimeter_rectangle_structure'
  | 'area_or_perimeter_choice'
  | 'perimeter_missing_side'
  | 'rectilinear_area_decompose'
  | 'same_area_diff_perimeter'
  | 'same_perimeter_diff_area';

export interface TemplateGeneratorContext {
  rng?: () => number;
  difficulty?: number;
}

function templateFields(schemaId: AreaPerimeterSchema) {
  return { schemaId, cardKey: `template:g3-area-perimeter:${schemaId}` };
}

/**
 * Canonicalizes rectangle dimensions where orientation is mathematically
 * irrelevant (issue #30) — 4×8 and 8×4 are the same rectangle-formula
 * template and must not be treated as independent mastery evidence. Visual
 * orientation can still vary per item instance; only the long-term card
 * identity is canonicalized — see features/scheduler/cardModel.
 */
export function canonicalRectangleDimensions(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

// ── ID constructors ────────────────────────────────────────────────────────────

export function areaSquaresId(rows: number, cols: number): string {
  return `AREA_SQ_${rows}x${cols}`;
}

export function areaRectId(rows: number, cols: number): string {
  return `AREA_RECT_${rows}x${cols}`;
}

export function perimRectId(l: number, w: number): string {
  return `PERIM_RECT_${l}x${w}`;
}

export function rectiId(a1: number, b1: number, a2: number, b2: number): string {
  return `RECTI_${a1}x${b1}_${a2}x${b2}`;
}

// ── Item makers ───────────────────────────────────────────────────────────────

function difficulty(product: number): number {
  if (product <= 9) return 0.3;
  if (product <= 24) return 0.4;
  if (product <= 49) return 0.55;
  return 0.7;
}

export function makeAreaUnitSquaresItem(rows: number, cols: number): PracticeItem {
  return {
    id: areaSquaresId(rows, cols),
    skillId: 'g3-area-concept',
    itemType: 'area_unit_squares',
    ...templateFields('area_count_squares'),
    prompt: `A rectangle has ${pluralizeUnit(rows, 'row')} of ${cols} unit ${cols === 1 ? 'square' : 'squares'}. How many unit squares in all?`,
    answer: rows * cols,
    answerInput: 'numeric',
    visualModelType: 'area_model',
    visualSpec: { kind: 'area_grid', rows, cols, showTiles: true },
    tags: ['area', 'unit_squares'],
    difficulty: difficulty(rows * cols),
    factA: rows,
    factB: cols,
  };
}

export function makeAreaRectangleItem(rows: number, cols: number): PracticeItem {
  return {
    id: areaRectId(rows, cols),
    skillId: 'g3-area-formula',
    itemType: 'area_rectangle',
    ...templateFields('area_rows_columns'),
    prompt: `A rectangle is ${pluralizeUnit(rows, 'unit')} long and ${pluralizeUnit(cols, 'unit')} wide. What is its area in square units?`,
    answer: rows * cols,
    answerInput: 'numeric',
    visualModelType: 'area_model',
    visualSpec: { kind: 'area_grid', rows, cols, showTiles: false },
    tags: ['area', 'rectangle'],
    difficulty: difficulty(rows * cols),
    factA: rows,
    factB: cols,
  };
}

export function makePerimeterRectangleItem(l: number, w: number): PracticeItem {
  return {
    id: perimRectId(l, w),
    skillId: 'g3-perimeter',
    itemType: 'perimeter_rectangle',
    ...templateFields('perimeter_rectangle_structure'),
    prompt: `A rectangle is ${pluralizeUnit(l, 'unit')} long and ${pluralizeUnit(w, 'unit')} wide. What is its perimeter in units?`,
    answer: 2 * (l + w),
    answerInput: 'numeric',
    visualSpec: { kind: 'rectangle_measure', length: l, width: w, emphasize: 'boundary' },
    tags: ['perimeter', 'rectangle'],
    difficulty: l + w <= 10 ? 0.35 : 0.55,
    factA: l,
    factB: w,
  };
}

// ── ID set generators ─────────────────────────────────────────────────────────

/** Unit-square items for 1×1 through 8×8 rectangles (Grade 3 counting range). */
export function areaSquaresItemIds(): string[] {
  const ids: string[] = [];
  for (let r = 1; r <= 8; r++) {
    for (let c = 1; c <= 8; c++) {
      ids.push(areaSquaresId(r, c));
    }
  }
  return ids;
}

/** Area-by-multiplication items for 1×1 through 10×10 rectangles. */
export function areaRectangleItemIds(): string[] {
  const ids: string[] = [];
  for (let r = 1; r <= 10; r++) {
    for (let c = 1; c <= 10; c++) {
      ids.push(areaRectId(r, c));
    }
  }
  return ids;
}

export function makeRectilinearAreaItem(a1: number, b1: number, a2: number, b2: number): PracticeItem {
  const totalArea = a1 * b1 + a2 * b2;
  return {
    id: rectiId(a1, b1, a2, b2),
    skillId: 'g3-geo-rectilinear-area',
    itemType: 'rectilinear_area',
    ...templateFields('rectilinear_area_decompose'),
    prompt: `An L-shaped figure is made of two rectangles. One is ${a1} by ${b1}. The other is ${a2} by ${b2}. What is the total area in square units?`,
    answer: totalArea,
    answerInput: 'numeric',
    explanation: `Add the areas of both rectangles: ${a1}×${b1} = ${a1 * b1}, and ${a2}×${b2} = ${a2 * b2}. Total = ${totalArea}.`,
    visualSpec: {
      kind: 'rectilinear_area',
      rectangles: [{ length: a1, width: b1 }, { length: a2, width: b2 }],
      showDecomposition: true,
    },
    tags: ['area', 'rectilinear', 'decompose'],
    difficulty: totalArea <= 20 ? 0.5 : 0.65,
    factA: a1 * b1,
    factB: a2 * b2,
  };
}

/** Rectilinear-area items using two non-overlapping rectangles (Grade 3 range). */
export function rectilinearAreaItemIds(): string[] {
  const pairs: [number, number, number, number][] = [
    [2, 3, 1, 2], [3, 4, 2, 2], [2, 5, 3, 3], [4, 3, 2, 4],
    [3, 3, 2, 5], [5, 2, 3, 3], [4, 4, 2, 3], [3, 5, 4, 2],
    [2, 6, 3, 4], [5, 3, 2, 4], [4, 5, 3, 2], [6, 2, 4, 3],
  ];
  return pairs.map(([a1, b1, a2, b2]) => rectiId(a1, b1, a2, b2));
}

/** Perimeter items for 1×1 through 10×10 rectangles. */
export function perimeterRectangleItemIds(): string[] {
  const ids: string[] = [];
  for (let l = 1; l <= 10; l++) {
    for (let w = 1; w <= 10; w++) {
      ids.push(perimRectId(l, w));
    }
  }
  return ids;
}

// ── Perimeter of general polygon (non-rectangle) ───────────────────────────

export function perimPolygonId(sides: number[]): string {
  return `PERIM_POLY_${sides.join('-')}`;
}

const SHAPE_NAMES: Record<number, string> = {
  3: 'triangle', 4: 'quadrilateral', 5: 'pentagon', 6: 'hexagon',
};

/** Schematic (not-to-scale) regular-n-gon vertices for a perimeter path visual. */
function regularPolygonVertices(sideCount: number, radius = 3): Point[] {
  const vertices: Point[] = [];
  for (let i = 0; i < sideCount; i++) {
    const angle = (2 * Math.PI * i) / sideCount - Math.PI / 2;
    vertices.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  }
  return vertices;
}

export function makePerimeterPolygonItem(sides: number[]): PracticeItem {
  const perimeter = sides.reduce((sum, s) => sum + s, 0);
  const shapeName = SHAPE_NAMES[sides.length] ?? 'polygon';
  return {
    id: perimPolygonId(sides),
    skillId: 'g3-perimeter',
    itemType: 'perimeter_polygon',
    ...templateFields('perimeter_sum_sides'),
    prompt: `A ${shapeName} has side lengths of ${sides.join(', ')} units. What is its perimeter in units?`,
    answer: perimeter,
    answerInput: 'numeric',
    visualSpec: {
      kind: 'perimeter_path',
      vertices: regularPolygonVertices(sides.length),
      sideLabels: sides,
    },
    tags: ['perimeter', shapeName],
    difficulty: perimeter <= 20 ? 0.4 : 0.55,
  };
}

const POLYGON_SIDES: number[][] = [
  // Triangles
  [3, 4, 5], [3, 3, 3], [4, 5, 6], [2, 3, 4], [5, 6, 7],
  [3, 5, 7], [4, 4, 4], [5, 5, 5], [6, 7, 8], [4, 6, 8],
  // Quadrilaterals (irregular)
  [2, 3, 4, 5], [3, 4, 5, 6], [4, 5, 4, 7], [2, 5, 3, 4], [3, 6, 3, 6],
  // Pentagons
  [2, 3, 4, 3, 2], [3, 4, 5, 4, 3], [2, 2, 3, 2, 2],
];

export function perimeterPolygonItemIds(): string[] {
  return POLYGON_SIDES.map(perimPolygonId);
}

// ── Perimeter with unknown side ────────────────────────────────────────────

export function perimUnknownSideId(total: number, knownSides: number[]): string {
  return `PERIM_UNKSIDE_${total}_${knownSides.join('-')}`;
}

export function makePerimeterUnknownSideItem(total: number, knownSides: number[]): PracticeItem {
  const missing = total - knownSides.reduce((s, n) => s + n, 0);
  const totalSides = knownSides.length + 1;
  const shapeName = SHAPE_NAMES[totalSides] ?? 'polygon';
  const unknownSideIndex = knownSides.length; // convention: unknown side is placed last
  const allSides = [...knownSides, null] as Array<number | null>;
  return {
    id: perimUnknownSideId(total, knownSides),
    skillId: 'g3-perimeter-missing-side',
    itemType: 'perimeter_unknown_side',
    ...templateFields('perimeter_missing_side'),
    prompt: `A ${shapeName} has a perimeter of ${total} units. The known sides are ${knownSides.join(', ')} units. What is the missing side length?`,
    answer: missing,
    answerInput: 'numeric',
    reasoningSpec: {
      totalPerimeter: total,
      knownSides,
      unknownSideIndex,
      equation: `${knownSides.join(' + ')} + x = ${total}`,
    },
    visualSpec: {
      kind: 'perimeter_path',
      vertices: regularPolygonVertices(totalSides),
      sideLabels: allSides,
    },
    tags: ['perimeter', 'unknown_side', shapeName],
    difficulty: 0.55,
  };
}

// ── Missing-side reasoning progression (issue #30) ─────────────────────────
// Early modes expose the equation structure before the mixed/independent mode
// asks only for the number — see grade3MasteryMap's g3-perimeter-missing-side.

export type PerimeterReasoningMode = 'equation' | 'sum' | 'mixed';

const REASONING_MODE_PREFIX: Record<PerimeterReasoningMode, string> = {
  equation: 'EQ', sum: 'SUM', mixed: 'MIX',
};

export function perimReasoningId(mode: PerimeterReasoningMode, total: number, knownSides: number[]): string {
  return `PERIM_UNKSIDE_${REASONING_MODE_PREFIX[mode]}_${total}_${knownSides.join('-')}`;
}

function reasoningSpecFor(total: number, knownSides: number[]): PerimeterReasoningSpec {
  return {
    totalPerimeter: total,
    knownSides,
    unknownSideIndex: knownSides.length,
    equation: `${knownSides.join(' + ')} + x = ${total}`,
  };
}

function reasoningVisual(knownSides: number[]): VisualSpec {
  const totalSides = knownSides.length + 1;
  return {
    kind: 'perimeter_path',
    vertices: regularPolygonVertices(totalSides),
    sideLabels: [...knownSides, null],
  };
}

/** "Choose the correct equation" — early rung exposing the equation structure before solving. */
export function makePerimeterEquationChoiceItem(total: number, knownSides: number[]): PracticeItem {
  const sumKnown = knownSides.reduce((s, n) => s + n, 0);
  const correct = `${knownSides.join(' + ')} + x = ${total}`;
  const choices = [
    correct,
    `x = ${total} + ${sumKnown}`, // missing_side_subtraction_error: added instead of subtracted
    `${knownSides[0]} + x = ${total}`, // forgot_one_pair_of_sides: dropped the other known sides
    `x = ${total}`, // copied_given_perimeter: ignored the known sides entirely
  ];
  return {
    id: perimReasoningId('equation', total, knownSides),
    skillId: 'g3-perimeter-missing-side',
    itemType: 'perimeter_unknown_side',
    ...templateFields('perimeter_missing_side'),
    prompt: `A polygon has a perimeter of ${total} units. The known sides are ${knownSides.join(', ')} units. Which equation finds the missing side x?`,
    answer: correct,
    answerInput: 'choice',
    choices,
    reasoningSpec: reasoningSpecFor(total, knownSides),
    visualSpec: reasoningVisual(knownSides),
    tags: ['perimeter', 'unknown_side', 'equation'],
    difficulty: 0.5,
  };
}

/** "Sum the known sides" — intermediate rung isolating the addition step from the final subtraction. */
export function makePerimeterSumKnownSidesItem(total: number, knownSides: number[]): PracticeItem {
  const sumKnown = knownSides.reduce((s, n) => s + n, 0);
  return {
    id: perimReasoningId('sum', total, knownSides),
    skillId: 'g3-perimeter-missing-side',
    itemType: 'perimeter_unknown_side',
    ...templateFields('perimeter_missing_side'),
    prompt: `A polygon has a perimeter of ${total} units. The known sides are ${knownSides.join(', ')} units. What is the sum of the known sides?`,
    answer: sumKnown,
    answerInput: 'numeric',
    reasoningSpec: reasoningSpecFor(total, knownSides),
    visualSpec: reasoningVisual(knownSides),
    tags: ['perimeter', 'unknown_side', 'sum_known_sides'],
    difficulty: 0.4,
  };
}

/** "Mixed independent application" — final rung, asks only for the missing number. */
export function makePerimeterMixedReasoningItem(total: number, knownSides: number[]): PracticeItem {
  const missing = total - knownSides.reduce((s, n) => s + n, 0);
  return {
    id: perimReasoningId('mixed', total, knownSides),
    skillId: 'g3-perimeter-missing-side',
    itemType: 'perimeter_unknown_side',
    ...templateFields('perimeter_missing_side'),
    prompt: `A polygon has a perimeter of ${total} units. The known sides are ${knownSides.join(', ')} units. What is the missing side?`,
    answer: missing,
    answerInput: 'numeric',
    reasoningSpec: reasoningSpecFor(total, knownSides),
    visualSpec: reasoningVisual(knownSides),
    tags: ['perimeter', 'unknown_side', 'mixed'],
    difficulty: 0.55,
  };
}

const UNKNOWN_SIDE_PARAMS: { total: number; knownSides: number[] }[] = [
  // Triangles (3 sides: 2 known + 1 missing)
  { total: 12, knownSides: [3, 4] },
  { total: 15, knownSides: [4, 5] },
  { total: 18, knownSides: [6, 7] },
  { total: 20, knownSides: [7, 8] },
  { total: 24, knownSides: [8, 9] },
  // Rectangles as quadrilaterals (3 known sides + 1 missing)
  { total: 16, knownSides: [5, 3, 5] },
  { total: 20, knownSides: [6, 4, 6] },
  { total: 24, knownSides: [7, 5, 7] },
  { total: 18, knownSides: [5, 4, 5] },
  { total: 22, knownSides: [6, 5, 6] },
  // Irregular quadrilaterals (3 known + 1 missing)
  { total: 20, knownSides: [4, 6, 5] },
  { total: 24, knownSides: [5, 7, 6] },
  { total: 22, knownSides: [4, 7, 5] },
  { total: 26, knownSides: [6, 8, 7] },
  { total: 30, knownSides: [7, 9, 8] },
];

export function perimeterUnknownSideItemIds(): string[] {
  return UNKNOWN_SIDE_PARAMS.map(({ total, knownSides }) => perimUnknownSideId(total, knownSides));
}

/** Full missing-side reasoning progression: equation choice -> sum known sides -> mixed application. */
export function perimeterReasoningItemIds(): string[] {
  const ids: string[] = [];
  for (const { total, knownSides } of UNKNOWN_SIDE_PARAMS) {
    ids.push(perimReasoningId('equation', total, knownSides));
    ids.push(perimReasoningId('sum', total, knownSides));
    ids.push(perimReasoningId('mixed', total, knownSides));
  }
  return ids;
}

// ── Area-or-perimeter operation selection (issue #30) ──────────────────────
// "Would you use area or perimeter?" / "Which expression represents the boundary?"

export type AreaPerimeterChoiceKind = 'operation' | 'expression';

export function apChoiceId(kind: AreaPerimeterChoiceKind, length: number, width: number): string {
  return `AP_CHOICE_${kind}_${length}x${width}`;
}

const OPERATION_CONTEXTS: { asks: 'area' | 'perimeter'; scenario: (l: number, w: number) => string }[] = [
  { asks: 'area', scenario: (l, w) => `carpet to cover the floor of a room that is ${l} by ${w}` },
  { asks: 'perimeter', scenario: (l, w) => `fencing to go around a garden that is ${l} by ${w}` },
  { asks: 'area', scenario: (l, w) => `paint to cover a wall that is ${l} by ${w}` },
  { asks: 'perimeter', scenario: (l, w) => `ribbon to go around a picture frame that is ${l} by ${w}` },
];

/** "Would you use area or perimeter?" — operation-selection choice item. */
export function makeAreaPerimeterOperationChoiceItem(length: number, width: number, contextIndex = 0): PracticeItem {
  const [l, w] = canonicalRectangleDimensions(length, width);
  const context = OPERATION_CONTEXTS[contextIndex % OPERATION_CONTEXTS.length];
  return {
    id: apChoiceId('operation', length, width),
    skillId: 'g3-area-perimeter-choice',
    itemType: 'area_perimeter_choice',
    ...templateFields('area_or_perimeter_choice'),
    prompt: `You need ${context.scenario(length, width)}. Would you use area or perimeter to find how much you need?`,
    answer: context.asks,
    answerInput: 'choice',
    choices: ['area', 'perimeter'],
    visualSpec: { kind: 'rectangle_measure', length, width, emphasize: context.asks === 'area' ? 'inside' : 'boundary' },
    tags: ['area', 'perimeter', 'operation_choice'],
    difficulty: 0.4,
    factA: l,
    factB: w,
  };
}

/** "Which expression represents the boundary?" — expression-selection choice item with misconception distractors. */
export function makeAreaPerimeterExpressionChoiceItem(length: number, width: number): PracticeItem {
  const correct = `2×${length} + 2×${width}`;
  const choices = [
    correct,
    `${length}×${width}`, // used_area_for_perimeter
    `${length} + ${width}`, // used_half_perimeter
    `2×${length} + ${width}`, // forgot_one_pair_of_sides
  ];
  return {
    id: apChoiceId('expression', length, width),
    skillId: 'g3-area-perimeter-choice',
    itemType: 'area_perimeter_choice',
    ...templateFields('area_or_perimeter_choice'),
    prompt: `A rectangle is ${length} by ${width}. Which expression represents its perimeter (the boundary)?`,
    answer: correct,
    answerInput: 'choice',
    choices,
    visualSpec: { kind: 'rectangle_measure', length, width, emphasize: 'boundary' },
    tags: ['perimeter', 'expression_choice'],
    difficulty: 0.5,
    factA: length,
    factB: width,
  };
}

const CHOICE_PARAMS: [number, number][] = [
  [3, 4], [5, 2], [6, 3], [4, 7], [8, 2], [5, 5], [6, 4], [3, 9],
];

export function areaPerimeterChoiceItemIds(): string[] {
  const ids: string[] = [];
  for (const [l, w] of CHOICE_PARAMS) ids.push(apChoiceId('operation', l, w));
  for (const [l, w] of CHOICE_PARAMS) ids.push(apChoiceId('expression', l, w));
  return ids;
}

export function makeAreaPerimeterChoiceItem(kind: AreaPerimeterChoiceKind, length: number, width: number): PracticeItem {
  if (kind === 'operation') {
    const index = CHOICE_PARAMS.findIndex(([l, w]) => l === length && w === width);
    return makeAreaPerimeterOperationChoiceItem(length, width, index >= 0 ? index : 0);
  }
  return makeAreaPerimeterExpressionChoiceItem(length, width);
}

// ── Area / perimeter comparison ────────────────────────────────────────────

export function areaPerimCmpId(variant: AreaPerimVariant, index: number): string {
  return `AREA_PERIM_CMP_${variant}_${index}`;
}

// sadp: same area, different perimeter — ask for perimeter of Rectangle A
const SADP_PARAMS: { r1: [number, number]; r2: [number, number] }[] = [
  { r1: [2, 12], r2: [3, 8]  },  // area 24, perims 28 vs 22
  { r1: [2, 8],  r2: [4, 4]  },  // area 16, perims 20 vs 16
  { r1: [1, 9],  r2: [3, 3]  },  // area  9, perims 20 vs 12
  { r1: [2, 6],  r2: [3, 4]  },  // area 12, perims 16 vs 14
  { r1: [2, 10], r2: [4, 5]  },  // area 20, perims 24 vs 18
];

// spad: same perimeter, different area — ask for area of Rectangle B
const SPAD_PARAMS: { r1: [number, number]; r2: [number, number] }[] = [
  { r1: [2, 8],  r2: [4, 6]  },  // perim 20, areas 16 vs 24
  { r1: [1, 7],  r2: [2, 6]  },  // perim 16, areas  7 vs 12
  { r1: [2, 6],  r2: [3, 5]  },  // perim 16, areas 12 vs 15
  { r1: [3, 7],  r2: [4, 6]  },  // perim 20, areas 21 vs 24
  { r1: [1, 9],  r2: [3, 7]  },  // perim 20, areas  9 vs 21
];

export function makeAreaPerimCompareItem(variant: AreaPerimVariant, index: number): PracticeItem | null {
  if (variant === 'sadp') {
    const p = SADP_PARAMS[index];
    if (!p) return null;
    const [a1, b1] = p.r1;
    const [a2, b2] = p.r2;
    const area = a1 * b1;
    const perimA = 2 * (a1 + b1);
    const perimB = 2 * (a2 + b2);
    return {
      id: areaPerimCmpId(variant, index),
      skillId: 'g3-area-perimeter-compare',
      itemType: 'area_perimeter_compare',
      ...templateFields('same_area_diff_perimeter'),
      prompt: `Rectangle A is ${a1} by ${b1}. Rectangle B is ${a2} by ${b2}. Both have an area of ${area} square units. What is the perimeter of Rectangle A in units?`,
      answer: perimA,
      explanation: `Rectangle A: P = 2×(${a1}+${b1}) = ${perimA} units. Rectangle B: P = 2×(${a2}+${b2}) = ${perimB} units. Same area, but different perimeters!`,
      answerInput: 'numeric',
      visualSpec: {
        kind: 'area_perimeter_compare',
        rectangles: [{ length: a1, width: b1, label: 'A' }, { length: a2, width: b2, label: 'B' }],
        comparison: 'same_area',
      },
      tags: ['area', 'perimeter', 'compare', 'same_area'],
      difficulty: 0.55,
      factA: a1,
      factB: b1,
    };
  } else {
    const p = SPAD_PARAMS[index];
    if (!p) return null;
    const [a1, b1] = p.r1;
    const [a2, b2] = p.r2;
    const perim = 2 * (a1 + b1);
    const areaA = a1 * b1;
    const areaB = a2 * b2;
    return {
      id: areaPerimCmpId(variant, index),
      skillId: 'g3-area-perimeter-compare',
      itemType: 'area_perimeter_compare',
      ...templateFields('same_perimeter_diff_area'),
      prompt: `Rectangle A is ${a1} by ${b1}. Rectangle B is ${a2} by ${b2}. Both have a perimeter of ${perim} units. What is the area of Rectangle B in square units?`,
      answer: areaB,
      explanation: `Rectangle A: area = ${a1}×${b1} = ${areaA} sq units. Rectangle B: area = ${a2}×${b2} = ${areaB} sq units. Same perimeter, different areas!`,
      answerInput: 'numeric',
      visualSpec: {
        kind: 'area_perimeter_compare',
        rectangles: [{ length: a1, width: b1, label: 'A' }, { length: a2, width: b2, label: 'B' }],
        comparison: 'same_perimeter',
      },
      tags: ['area', 'perimeter', 'compare', 'same_perimeter'],
      difficulty: 0.6,
      factA: a2,
      factB: b2,
    };
  }
}

export function areaPerimCompareItemIds(): string[] {
  const ids: string[] = [];
  for (let i = 0; i < SADP_PARAMS.length; i++) ids.push(areaPerimCmpId('sadp', i));
  for (let i = 0; i < SPAD_PARAMS.length; i++) ids.push(areaPerimCmpId('spad', i));
  return ids;
}

/** Generates a fresh concrete instance while keeping scheduling identity at schema level. */
export function generateAreaPerimeterItem(
  schema: AreaPerimeterSchema,
  context: TemplateGeneratorContext = {},
): PracticeItem {
  const rng = context.rng ?? Math.random;
  const pick = <T,>(values: readonly T[]): T => values[Math.min(values.length - 1, Math.floor(rng() * values.length))];
  const dimension = () => 2 + Math.floor(rng() * 7);

  switch (schema) {
    case 'area_count_squares': return makeAreaUnitSquaresItem(dimension(), dimension());
    case 'area_rows_columns': return makeAreaRectangleItem(dimension(), dimension());
    case 'perimeter_rectangle_structure': return makePerimeterRectangleItem(dimension(), dimension());
    case 'perimeter_sum_sides': return makePerimeterPolygonItem(pick(POLYGON_SIDES));
    case 'area_or_perimeter_choice': {
      const [l, w] = pick(CHOICE_PARAMS);
      return makeAreaPerimeterChoiceItem(rng() < 0.5 ? 'operation' : 'expression', l, w);
    }
    case 'perimeter_missing_side': {
      const { total, knownSides } = pick(UNKNOWN_SIDE_PARAMS);
      return makePerimeterMixedReasoningItem(total, knownSides);
    }
    case 'rectilinear_area_decompose': {
      const id = pick(rectilinearAreaItemIds());
      const match = id.match(/^RECTI_(\d+)x(\d+)_(\d+)x(\d+)$/)!;
      return makeRectilinearAreaItem(+match[1], +match[2], +match[3], +match[4]);
    }
    case 'same_area_diff_perimeter': return makeAreaPerimCompareItem('sadp', Math.floor(rng() * SADP_PARAMS.length))!;
    case 'same_perimeter_diff_area': return makeAreaPerimCompareItem('spad', Math.floor(rng() * SPAD_PARAMS.length))!;
  }
}
