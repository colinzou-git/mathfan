import type { PracticeItem } from '../../types/math';

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
