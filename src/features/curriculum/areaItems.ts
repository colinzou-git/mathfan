import type { PracticeItem } from '../../types/math';

export type AreaPerimVariant = 'sadp' | 'spad';

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
    prompt: `A rectangle has ${rows} rows of ${cols} unit squares. How many unit squares in all?`,
    answer: rows * cols,
    answerInput: 'numeric',
    visualModelType: 'area_model',
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
    prompt: `A rectangle is ${rows} units long and ${cols} units wide. What is its area in square units?`,
    answer: rows * cols,
    answerInput: 'numeric',
    visualModelType: 'area_model',
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
    prompt: `A rectangle is ${l} units long and ${w} units wide. What is its perimeter in units?`,
    answer: 2 * (l + w),
    answerInput: 'numeric',
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
    prompt: `An L-shaped figure is made of two rectangles. One is ${a1} by ${b1}. The other is ${a2} by ${b2}. What is the total area in square units?`,
    answer: totalArea,
    answerInput: 'numeric',
    explanation: `Add the areas of both rectangles: ${a1}×${b1} = ${a1 * b1}, and ${a2}×${b2} = ${a2 * b2}. Total = ${totalArea}.`,
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

export function makePerimeterPolygonItem(sides: number[]): PracticeItem {
  const perimeter = sides.reduce((sum, s) => sum + s, 0);
  const shapeName = SHAPE_NAMES[sides.length] ?? 'polygon';
  return {
    id: perimPolygonId(sides),
    skillId: 'g3-perimeter',
    itemType: 'perimeter_polygon',
    prompt: `A ${shapeName} has side lengths of ${sides.join(', ')} units. What is its perimeter in units?`,
    answer: perimeter,
    answerInput: 'numeric',
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
  return {
    id: perimUnknownSideId(total, knownSides),
    skillId: 'g3-perimeter',
    itemType: 'perimeter_unknown_side',
    prompt: `A ${shapeName} has a perimeter of ${total} units. The known sides are ${knownSides.join(', ')} units. What is the missing side length?`,
    answer: missing,
    answerInput: 'numeric',
    tags: ['perimeter', 'unknown_side', shapeName],
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
      prompt: `Rectangle A is ${a1} by ${b1}. Rectangle B is ${a2} by ${b2}. Both have an area of ${area} square units. What is the perimeter of Rectangle A in units?`,
      answer: perimA,
      explanation: `Rectangle A: P = 2×(${a1}+${b1}) = ${perimA} units. Rectangle B: P = 2×(${a2}+${b2}) = ${perimB} units. Same area, but different perimeters!`,
      answerInput: 'numeric',
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
      prompt: `Rectangle A is ${a1} by ${b1}. Rectangle B is ${a2} by ${b2}. Both have a perimeter of ${perim} units. What is the area of Rectangle B in square units?`,
      answer: areaB,
      explanation: `Rectangle A: area = ${a1}×${b1} = ${areaA} sq units. Rectangle B: area = ${a2}×${b2} = ${areaB} sq units. Same perimeter, different areas!`,
      answerInput: 'numeric',
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
