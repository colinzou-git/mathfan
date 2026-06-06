import type { SessionConfig, SessionMode, GradeLevel } from '../types/math';
import type { PracticeOp } from '../features/dashboard/StudentDashboard';
import {
  areaSquaresItemIds, areaRectangleItemIds, perimeterRectangleItemIds, rectilinearAreaItemIds,
  perimeterPolygonItemIds, perimeterUnknownSideItemIds, areaPerimCompareItemIds,
} from '../features/curriculum/areaItems';
import { geoItemIds } from '../features/curriculum/geometryItems';
import { clckId, etimeId, mwrdId, bargId, lplotId } from '../features/curriculum/measurementItems';
import { apatId } from '../features/curriculum/patternItems';

// ── Deterministic item ID sets for Grade 3 fixed-content operations ──────────

function allAreaItemIds(): string[] {
  return [
    ...areaSquaresItemIds(),
    ...areaRectangleItemIds(),
    ...rectilinearAreaItemIds(),
    ...perimeterRectangleItemIds(),
    ...perimeterPolygonItemIds(),
    ...perimeterUnknownSideItemIds(),
    ...areaPerimCompareItemIds(),
  ];
}

function allMeasurementItemIds(): string[] {
  return [
    clckId(1, 0),  clckId(2, 15), clckId(3, 25), clckId(4, 30),
    clckId(5, 35), clckId(6, 40), clckId(7, 45), clckId(8, 50),
    clckId(9, 55), clckId(10, 5), clckId(11, 10), clckId(12, 20),
    clckId(1, 30), clckId(2, 45), clckId(3, 15), clckId(4, 25),
    clckId(5, 40), clckId(6, 55), clckId(7, 0),  clckId(8, 35),
    clckId(9, 20), clckId(10, 50), clckId(11, 45), clckId(12, 10),
    etimeId(9, 15, 9, 45),   etimeId(10, 0, 10, 30), etimeId(2, 30, 3, 15),
    etimeId(1, 0, 1, 45),   etimeId(3, 15, 4, 0),   etimeId(11, 30, 12, 0),
    etimeId(8, 45, 9, 30),  etimeId(4, 0, 4, 20),   etimeId(2, 10, 2, 40),
    etimeId(7, 30, 8, 15),  etimeId(9, 0, 9, 25),   etimeId(10, 15, 11, 0),
    etimeId(1, 30, 2, 15),  etimeId(3, 0, 3, 40),   etimeId(6, 15, 7, 0),
    etimeId(11, 0, 11, 35), etimeId(8, 30, 9, 0),   etimeId(4, 45, 5, 30),
    etimeId(2, 0, 2, 55),   etimeId(7, 20, 8, 5),
    mwrdId('addg', 250, 150), mwrdId('addg', 350, 200), mwrdId('addg', 125, 175),
    mwrdId('subg', 500, 150), mwrdId('subg', 600, 250), mwrdId('subg', 450, 200),
    mwrdId('addl', 3, 5),     mwrdId('addl', 4, 7),     mwrdId('addl', 2, 8),
    mwrdId('subl', 10, 4),    mwrdId('subl', 8, 3),     mwrdId('subl', 12, 5),
    mwrdId('addkg', 8, 7),    mwrdId('addkg', 12, 8),
    mwrdId('subkg', 25, 8),   mwrdId('subkg', 30, 12),
    mwrdId('addml', 300, 450), mwrdId('addml', 250, 350),
    mwrdId('subml', 750, 250), mwrdId('subml', 800, 300),
  ];
}

function allDataItemIds(): string[] {
  return [
    bargId(5, 3),  bargId(5, 4),  bargId(5, 6),  bargId(5, 7),  bargId(5, 8),
    bargId(10, 2), bargId(10, 3), bargId(10, 4), bargId(10, 5), bargId(10, 7),
    bargId(2, 5),  bargId(2, 7),  bargId(2, 9),
    bargId(4, 3),  bargId(4, 5),  bargId(4, 7),
    bargId(3, 4),  bargId(3, 6),  bargId(3, 8),
    bargId(10, 8),
    lplotId(1, 2, 2, 3), lplotId(2, 2, 3, 4), lplotId(1, 1, 3, 4),
    lplotId(2, 3, 3, 4), lplotId(1, 2, 4, 4), lplotId(2, 3, 4, 5),
    lplotId(1, 3, 3, 5), lplotId(2, 2, 4, 5), lplotId(3, 3, 3, 4),
    lplotId(1, 2, 3, 6), lplotId(2, 4, 4, 5), lplotId(1, 3, 4, 6),
    lplotId(3, 3, 4, 5), lplotId(2, 3, 5, 5), lplotId(1, 4, 4, 7),
    lplotId(3, 4, 4, 6), lplotId(2, 3, 6, 7), lplotId(4, 4, 5, 5),
    lplotId(3, 4, 5, 8), lplotId(2, 5, 6, 7),
  ];
}

function allPatternItemIds(): string[] {
  const items: [number, number, number][] = [
    [2, 2, 4],  [3, 3, 4],  [4, 4, 4],  [5, 5, 4],
    [6, 6, 4],  [7, 7, 4],  [8, 8, 4],  [9, 9, 4],
    [10, 10, 4],
    [0, 3, 5],  [0, 4, 5],  [0, 6, 4],
    [1, 3, 4],  [2, 4, 4],  [5, 3, 4],
    [10, 5, 4], [4, 6, 4],  [20, 10, 4],
    [15, 5, 4], [6, 4, 4],
  ];
  return items.map(([start, step, terms]) => apatId(start, step, terms));
}

export interface RangeFieldSpec {
  /** Caption shown above the min/max inputs, e.g. "First number". */
  caption: string;
  defLo: number;
  defHi: number;
  /** Absolute clamp bounds for the inputs. */
  min: number;
  max: number;
}

export interface SubModeSpec {
  value: string;
  label: string;
  example: string;
  desc: string;
}

export interface RangeVal { lo: number; hi: number }

export interface RangeSetupSpec {
  mode: SessionMode;
  title: string;
  icon: string;
  description: string;
  /** One or two ranges. Two = a separate range per operand. */
  ranges: RangeFieldSpec[];
  /** Optional sub-type chooser (fractions: equivalent vs compare). */
  subModes?: SubModeSpec[];
  /** Live preview string under the ranges. */
  example: (vals: RangeVal[], subMode: string) => string;
  /** Build the final SessionConfig from the chosen values. */
  buildConfig: (vals: RangeVal[], subMode: string, count: number) => SessionConfig;
}

function gradeFactorMax(grade: GradeLevel): number {
  return grade === 3 ? 10 : 12;
}
function gradeRoundHi(grade: GradeLevel): number {
  return grade === 3 ? 999 : grade === 4 ? 9999 : 99999;
}
function gradeFactorsHi(grade: GradeLevel): number {
  return grade === 3 ? 30 : grade === 4 ? 60 : 100;
}
function gradeDecimalHi(grade: GradeLevel): number {
  return grade <= 4 ? 10 : 20;
}

/** Build the setup spec for a given operation, using the student's grade for defaults. */
export function specFor(op: PracticeOp, grade: GradeLevel): RangeSetupSpec {
  switch (op) {
    case 'multiplication':
      return {
        mode: 'multiplication',
        title: 'Multiplication', icon: '✖️',
        description: 'Pick a number range for each factor.',
        ranges: [
          { caption: 'First number',  defLo: 2, defHi: 12, min: 0, max: 1000 },
          { caption: 'Second number', defLo: 2, defHi: 12, min: 0, max: 1000 },
        ],
        example: v => `Example: ${v[0].hi} × ${v[1].hi} = ${v[0].hi * v[1].hi}`,
        buildConfig: (v, _s, count) => ({
          mode: 'multiplication', sessionLength: count,
          operandMin: v[0].lo, operandMax: v[0].hi,
          operand2Min: v[1].lo, operand2Max: v[1].hi,
        }),
      };

    case 'division':
      return {
        mode: 'division',
        title: 'Division', icon: '➗',
        description: 'Whole-number division (no remainders). Choose the dividend and divisor ranges.',
        ranges: [
          { caption: 'Dividend (big number)', defLo: 10, defHi: 100, min: 0, max: 100000 },
          { caption: 'Divisor',               defLo: 2,  defHi: 12,  min: 1, max: 1000 },
        ],
        example: v => `Dividend ${v[0].lo}–${v[0].hi} ÷ divisor ${v[1].lo}–${v[1].hi}`,
        buildConfig: (v, _s, count) => ({
          mode: 'division', sessionLength: count,
          operandMin: v[0].lo, operandMax: v[0].hi,
          operand2Min: v[1].lo, operand2Max: v[1].hi,
        }),
      };

    case 'addition':
      return {
        mode: 'addition',
        title: 'Addition', icon: '➕',
        description: 'Pick a number range for each number you add.',
        ranges: [
          { caption: 'First number',  defLo: 0, defHi: 20, min: 0, max: 100000 },
          { caption: 'Second number', defLo: 0, defHi: 20, min: 0, max: 100000 },
        ],
        example: v => `Example: ${v[0].hi} + ${v[1].hi} = ${v[0].hi + v[1].hi}`,
        buildConfig: (v, _s, count) => ({
          mode: 'addition', sessionLength: count,
          operandMin: v[0].lo, operandMax: v[0].hi,
          operand2Min: v[1].lo, operand2Max: v[1].hi,
        }),
      };

    case 'subtraction':
      return {
        mode: 'subtraction',
        title: 'Subtraction', icon: '➖',
        description: 'Pick a number range for each number. Answers are never negative.',
        ranges: [
          { caption: 'First number',  defLo: 0, defHi: 20, min: 0, max: 100000 },
          { caption: 'Second number', defLo: 0, defHi: 20, min: 0, max: 100000 },
        ],
        example: v => {
          const big = Math.max(v[0].hi, v[1].hi), small = Math.min(v[0].lo, v[1].lo);
          return `Example: ${big} − ${small} = ${big - small}`;
        },
        buildConfig: (v, _s, count) => ({
          mode: 'subtraction', sessionLength: count,
          operandMin: v[0].lo, operandMax: v[0].hi,
          operand2Min: v[1].lo, operand2Max: v[1].hi,
        }),
      };

    case 'fraction':
      return {
        mode: 'fraction',
        title: 'Fractions', icon: '🍕',
        description: 'Choose what to practice and the numerator / denominator ranges.',
        subModes: [
          { value: 'equivalent', label: 'Equivalent', example: '2/3 = ?/6', desc: 'Fill in the missing number.' },
          { value: 'compare',    label: 'Compare',    example: '2/3 ▢ 3/4', desc: 'Choose ‹, =, or ›.' },
        ],
        ranges: [
          { caption: 'Numerator (top)',     defLo: 1, defHi: 8,  min: 0, max: 50 },
          { caption: 'Denominator (bottom)', defLo: 2, defHi: 12, min: 2, max: 50 },
        ],
        example: (v, s) => s === 'compare'
          ? `Example: ${v[0].lo}/${v[1].hi} ▢ ${v[0].hi}/${v[1].lo}`
          : `Example: ${v[0].lo}/${v[1].lo} = ?/…`,
        buildConfig: (v, s, count) => ({
          mode: 'fraction', sessionLength: count,
          fractionMode: (s === 'compare' ? 'compare' : 'equivalent'),
          operandMin: v[0].lo, operandMax: v[0].hi,
          operand2Min: v[1].lo, operand2Max: v[1].hi,
        }),
      };

    case 'word':
      return {
        mode: 'word_problem',
        title: 'Word Problems', icon: '📖',
        description: 'Read the story and type the number answer. Pick the size of the numbers used.',
        ranges: [
          { caption: 'Numbers in the story', defLo: 2, defHi: gradeFactorMax(grade), min: 0, max: 100 },
        ],
        example: v => `Numbers from ${v[0].lo} to ${v[0].hi}`,
        buildConfig: (v, _s, count) => ({
          mode: 'word_problem', sessionLength: count, grade,
          operandMin: v[0].lo, operandMax: v[0].hi,
        }),
      };

    case 'rounding':
      return {
        mode: 'rounding',
        title: 'Rounding', icon: '🔵',
        description: 'Round to the nearest ten, hundred, or thousand. Pick how big the numbers are.',
        ranges: [
          { caption: 'Numbers to round', defLo: 11, defHi: gradeRoundHi(grade), min: 11, max: 1000000 },
        ],
        example: v => `Round numbers from ${v[0].lo} to ${v[0].hi}`,
        buildConfig: (v, _s, count) => ({
          mode: 'rounding', sessionLength: count, grade,
          operandMin: v[0].lo, operandMax: v[0].hi,
        }),
      };

    case 'factors':
      return {
        mode: 'factors',
        title: 'Primes & Factors', icon: '🔢',
        description: 'Prime or composite? Is one number a factor of another? Pick the number range.',
        ranges: [
          { caption: 'Numbers to test', defLo: 2, defHi: gradeFactorsHi(grade), min: 2, max: 1000 },
        ],
        example: v => `Numbers from ${v[0].lo} to ${v[0].hi}`,
        buildConfig: (v, _s, count) => ({
          mode: 'factors', sessionLength: count, grade,
          operandMin: v[0].lo, operandMax: v[0].hi,
        }),
      };

    case 'decimals':
      return {
        mode: 'decimals',
        title: 'Decimals', icon: '🔟',
        description: 'Add and subtract decimals. Pick the largest value used.',
        ranges: [
          { caption: 'Value range', defLo: 0, defHi: gradeDecimalHi(grade), min: 0, max: 1000 },
        ],
        example: v => `Values from ${v[0].lo} to ${v[0].hi}`,
        buildConfig: (v, _s, count) => ({
          mode: 'decimals', sessionLength: count, grade,
          operandMin: v[0].lo, operandMax: v[0].hi,
        }),
      };

    case 'area':
      return {
        mode: 'area' as SessionMode,
        title: 'Area & Perimeter', icon: '📐',
        description: 'Practice area with unit squares, rectangles, rectilinear figures, and perimeter.',
        ranges: [],
        example: () => 'Area, perimeter, and comparison items',
        buildConfig: (_v, _s, count) => ({
          mode: 'area' as SessionMode,
          specificItemIds: allAreaItemIds(),
          sessionLength: count,
        }),
      };

    case 'geometry':
      return {
        mode: 'geometry' as SessionMode,
        title: 'Geometry', icon: '🔷',
        description: 'Identify shapes by their properties: sides, angles, and categories.',
        ranges: [],
        example: () => 'Shape names, sides, and attributes',
        buildConfig: (_v, _s, count) => ({
          mode: 'geometry' as SessionMode,
          specificItemIds: geoItemIds(),
          sessionLength: count,
        }),
      };

    case 'measurement':
      return {
        mode: 'measurement' as SessionMode,
        title: 'Measurement', icon: '⏰',
        description: 'Tell time to the minute, find elapsed time, and solve mass/volume word problems.',
        ranges: [],
        example: () => 'Clock, elapsed time, and measurement word problems',
        buildConfig: (_v, _s, count) => ({
          mode: 'measurement' as SessionMode,
          specificItemIds: allMeasurementItemIds(),
          sessionLength: count,
        }),
      };

    case 'data':
      return {
        mode: 'measurement' as SessionMode,
        title: 'Data & Graphs', icon: '📊',
        description: 'Read scaled bar graphs and line plots.',
        ranges: [],
        example: () => 'Scaled bar graphs and line plots',
        buildConfig: (_v, _s, count) => ({
          mode: 'measurement' as SessionMode,
          specificItemIds: allDataItemIds(),
          sessionLength: count,
        }),
      };

    case 'pattern':
      return {
        mode: 'multiplication' as SessionMode,
        title: 'Patterns', icon: '🔁',
        description: 'Find the next number in arithmetic sequences.',
        ranges: [],
        example: () => 'Arithmetic sequence patterns',
        buildConfig: (_v, _s, count) => ({
          mode: 'multiplication' as SessionMode,
          specificItemIds: allPatternItemIds(),
          sessionLength: count,
        }),
      };
  }
}
