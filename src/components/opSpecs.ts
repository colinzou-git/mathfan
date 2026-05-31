import type { SessionConfig, SessionMode, GradeLevel } from '../types/math';
import type { PracticeOp } from '../features/dashboard/StudentDashboard';

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
          { caption: 'Dividend (big number)', defLo: 10, defHi: 100, min: 2, max: 100000 },
          { caption: 'Divisor',               defLo: 2,  defHi: 12,  min: 2, max: 1000 },
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
          { caption: 'Numerator (top)',     defLo: 1, defHi: 8,  min: 1, max: 50 },
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
          { caption: 'Numbers in the story', defLo: 2, defHi: gradeFactorMax(grade), min: 2, max: 100 },
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
  }
}
