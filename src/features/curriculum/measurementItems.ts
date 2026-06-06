import type { PracticeItem } from '../../types/math';

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(n: number): string { return n.toString().padStart(2, '0'); }
function fmtTime(h: number, m: number): string { return `${h}:${pad(m)}`; }
function wrapM(m: number): number { return ((m % 60) + 60) % 60; }
function wrapH(h: number): number { return ((h - 1 + 12) % 12) + 1; }

// ── Clock / time-to-minute items ───────────────────────────────────────────────

export function clckId(h: number, m: number): string {
  return `CLCK_${h}_${m}`;
}

export function makeTimeItem(h: number, m: number): PracticeItem {
  const correct = fmtTime(h, m);
  const d1 = fmtTime(h, wrapM(m - 5));
  const d2 = fmtTime(h, wrapM(m + 5));
  const d3 = fmtTime(wrapH(h - 1), m);

  // Deterministic position for correct answer (avoid always being index 0 or last)
  const pos = (h + Math.floor(m / 5)) % 4;
  const distractors = [d1, d2, d3];
  distractors.splice(pos, 0, correct);
  const choices = distractors.slice(0, 4);

  return {
    id: clckId(h, m),
    skillId: 'SKILL_TIME',
    itemType: 'time_to_minute',
    prompt: `What time does the clock show?`,
    answer: correct,
    answerInput: 'choice',
    choices,
    tags: ['time', 'analog_clock'],
    difficulty: 0.45,
    factA: h,
    factB: m,
  };
}

// ── Elapsed time items ─────────────────────────────────────────────────────────

export function etimeId(h1: number, m1: number, h2: number, m2: number): string {
  return `ETIME_${h1}_${m1}_${h2}_${m2}`;
}

export function makeElapsedTimeItem(h1: number, m1: number, h2: number, m2: number): PracticeItem {
  const elapsed = (h2 * 60 + m2) - (h1 * 60 + m1);
  return {
    id: etimeId(h1, m1, h2, m2),
    skillId: 'SKILL_ELAPSED_TIME',
    itemType: 'elapsed_time',
    prompt: `A class starts at ${fmtTime(h1, m1)} and ends at ${fmtTime(h2, m2)}. How many minutes is this?`,
    answer: elapsed,
    answerInput: 'numeric',
    tags: ['elapsed_time', 'measurement'],
    difficulty: 0.55,
    factA: h1 * 60 + m1,
    factB: elapsed,
  };
}

// ── Measurement word problems ──────────────────────────────────────────────────

export type MeasSchema = 'addg' | 'subg' | 'addl' | 'subl' | 'addkg' | 'subkg' | 'addml' | 'subml';

const MEAS_UNIT: Record<MeasSchema, string> = {
  addg: 'grams', subg: 'grams',
  addl: 'liters', subl: 'liters',
  addkg: 'kilograms', subkg: 'kilograms',
  addml: 'milliliters', subml: 'milliliters',
};

export function mwrdId(schema: MeasSchema, a: number, b: number): string {
  return `MWRD_${schema}_${a}_${b}`;
}

export function makeMeasurementWordProblem(schema: MeasSchema, a: number, b: number): PracticeItem {
  const unit = MEAS_UNIT[schema];
  const isAdd = schema.startsWith('add');
  const prompt = isAdd
    ? `A container holds ${a} ${unit}. Another holds ${b} ${unit}. How many ${unit} in all?`
    : `A tank has ${a} ${unit}. You remove ${b} ${unit}. How many ${unit} remain?`;
  const answer = isAdd ? a + b : a - b;
  return {
    id: mwrdId(schema, a, b),
    skillId: 'SKILL_MEASUREMENT_WORD',
    itemType: 'measurement_word',
    prompt,
    answer,
    answerInput: 'numeric',
    tags: ['measurement', 'word_problem', unit, isAdd ? 'addition' : 'subtraction'],
    difficulty: 0.5,
    factA: a,
    factB: b,
  };
}

// ── Bar graph items ────────────────────────────────────────────────────────────

export function bargId(scale: number, bars: number): string {
  return `BARG_${scale}_${bars}`;
}

export function makeBarGraphItem(scale: number, bars: number): PracticeItem {
  return {
    id: bargId(scale, bars),
    skillId: 'SKILL_BAR_GRAPH',
    itemType: 'bar_graph_read',
    prompt: `A bar graph uses a scale of ${scale}. A bar is ${bars} units tall. How many does it represent?`,
    answer: scale * bars,
    answerInput: 'numeric',
    tags: ['bar_graph', 'data', `scale_${scale}`],
    difficulty: 0.5,
    factA: scale,
    factB: bars,
  };
}

// ── Line plot items ────────────────────────────────────────────────────────────

export function lplotId(v1: number, v2: number, v3: number, v4: number): string {
  return `LPLOT_${v1}_${v2}_${v3}_${v4}`;
}

export function makeLinePlotItem(v1: number, v2: number, v3: number, v4: number): PracticeItem {
  return {
    id: lplotId(v1, v2, v3, v4),
    skillId: 'SKILL_LINE_PLOT',
    itemType: 'line_plot_read',
    prompt: `A line plot shows these measurements: ${v1}, ${v2}, ${v3}, and ${v4} inches. What is the total?`,
    answer: v1 + v2 + v3 + v4,
    answerInput: 'numeric',
    tags: ['line_plot', 'data', 'addition'],
    difficulty: 0.45,
    factA: v1,
    factB: v2,
  };
}
