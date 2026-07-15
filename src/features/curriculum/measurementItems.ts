import type { PracticeItem } from '../../types/math';
import type { ArithmeticGeneratorContext as TemplateGeneratorContext } from './regrouping';
import type { ClockTime, MeasurementDataSpec, MeasurementSchema } from './measurementTypes';
import { formatQuantity } from './language';

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(n: number): string { return n.toString().padStart(2, '0'); }
function fmtTime(h: number, m: number): string { return `${h}:${pad(m)}`; }
function wrapM(m: number): number { return ((m % 60) + 60) % 60; }
function wrapH(h: number): number { return ((h - 1 + 12) % 12) + 1; }

export function minutesSinceMidnight(time: ClockTime): number { return time.hour * 60 + time.minute; }
export function elapsedMinutes(start: ClockTime, end: ClockTime): number { return minutesSinceMidnight(end) - minutesSinceMidnight(start); }
export function buildElapsedTimeJumps(start: ClockTime, end: ClockTime): Array<{ from: ClockTime; to: ClockTime; minutes: number }> {
  const jumps: Array<{ from: ClockTime; to: ClockTime; minutes: number }> = [];
  let cursor = { ...start };
  const endMinutes = minutesSinceMidnight(end);
  while (minutesSinceMidnight(cursor) < endMinutes) {
    const current = minutesSinceMidnight(cursor);
    const toHour = 60 - cursor.minute;
    const jump = cursor.minute !== 0 && current + toHour <= endMinutes ? toHour : Math.min(60, endMinutes - current);
    const nextTotal = current + jump;
    const to = { hour: Math.floor(nextTotal / 60), minute: nextTotal % 60 };
    jumps.push({ from: cursor, to, minutes: jump }); cursor = to;
  }
  return jumps;
}

function measurementCardKey(schema: MeasurementSchema): string { return `template:g3-measurement:${schema}`; }

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
    measurementSpec: { kind: 'clock_read', time: { hour: h, minute: m }, minuteIncrement: m % 15 === 0 ? 15 : m % 5 === 0 ? 5 : 1 },
    cardKey: measurementCardKey(m % 5 === 0 ? 'clock_to_5_minutes' : 'clock_to_minute'),
  };
}

// ── Elapsed time items ─────────────────────────────────────────────────────────

export function etimeId(h1: number, m1: number, h2: number, m2: number): string {
  return `ETIME_${h1}_${m1}_${h2}_${m2}`;
}

export function makeElapsedTimeItem(h1: number, m1: number, h2: number, m2: number): PracticeItem {
  const start = { hour: h1, minute: m1 }, end = { hour: h2, minute: m2 };
  const elapsed = elapsedMinutes(start, end);
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
    measurementSpec: { kind: 'elapsed_time', start, end, crossesHour: h1 !== h2, durationMinutes: elapsed },
    cardKey: measurementCardKey(h1 === h2 ? 'elapsed_same_hour' : 'elapsed_cross_hour'),
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
  const unitCode = schema.endsWith('kg') ? 'kg' : schema.endsWith('ml') ? 'mL' : schema.endsWith('g') ? 'g' : 'L';
  const isAdd = schema.startsWith('add');
  const prompt = isAdd
    ? `A container holds ${formatQuantity(a, unit.replace(/s$/, ''))}. Another holds ${formatQuantity(b, unit.replace(/s$/, ''))}. How many ${unit} in all?`
    : `A tank has ${formatQuantity(a, unit.replace(/s$/, ''))}. You remove ${formatQuantity(b, unit.replace(/s$/, ''))}. How many ${unit} remain?`;
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
    measurementSpec: { kind: 'measurement_context', unit: unitCode, operation: isAdd ? 'add' : 'subtract', values: [a, b] },
    cardKey: measurementCardKey(isAdd ? 'measurement_add' : 'measurement_subtract'),
  };
}

// ── Bar graph items ────────────────────────────────────────────────────────────

export function bargId(scale: number, bars: number): string {
  return `BARG_${scale}_${bars}`;
}

export function makeBarGraphItem(scale: number, bars: number): PracticeItem {
  const spec: MeasurementDataSpec = { kind: 'bar_graph', title: 'Books Read', categories: ['Mia', 'Leo', 'Ava'], values: [bars * scale, Math.max(scale, (bars - 1) * scale), (bars + 1) * scale], scale, question: 'read_value', requestedIndex: 0 };
  return {
    id: bargId(scale, bars),
    skillId: 'SKILL_BAR_GRAPH',
    itemType: 'bar_graph_read',
    prompt: `Use the bar graph. How many books did Mia read?`,
    answer: scale * bars,
    answerInput: 'numeric',
    tags: ['bar_graph', 'data', `scale_${scale}`],
    difficulty: 0.5,
    factA: scale,
    factB: bars,
    measurementSpec: spec,
    cardKey: measurementCardKey('bar_read_value'),
  };
}

// ── Line plot items ────────────────────────────────────────────────────────────

export function lplotId(v1: number, v2: number, v3: number, v4: number): string {
  return `LPLOT_${v1}_${v2}_${v3}_${v4}`;
}

export function makeLinePlotItem(v1: number, v2: number, v3: number, v4: number): PracticeItem {
  const values = [v1, v2, v3, v4];
  return {
    id: lplotId(v1, v2, v3, v4),
    skillId: 'SKILL_LINE_PLOT',
    itemType: 'line_plot_read',
    prompt: `Use the line plot. What is the total measurement in inches?`,
    answer: v1 + v2 + v3 + v4,
    answerInput: 'numeric',
    tags: ['line_plot', 'data', 'addition'],
    difficulty: 0.45,
    factA: v1,
    factB: v2,
    measurementSpec: { kind: 'line_plot', unit: 'inch', denominator: 1, valuesInTicks: values, question: 'total_measurement' },
    cardKey: measurementCardKey('line_plot_count'),
  };
}

export function generateMeasurementItem(schema: MeasurementSchema, context: TemplateGeneratorContext = {}): PracticeItem {
  const rng = context.rng ?? Math.random;
  const n = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  if (schema.startsWith('clock_')) return makeTimeItem(n(1, 12), schema === 'clock_to_5_minutes' ? n(0, 11) * 5 : n(0, 59));
  if (schema.startsWith('elapsed_')) {
    const h = n(8, 12), m = n(0, 11) * 5, duration = schema === 'elapsed_cross_hour' ? n(2, 8) * 10 : n(1, 5) * 5;
    const total = h * 60 + m + duration;
    return makeElapsedTimeItem(h, m, Math.floor(total / 60), total % 60);
  }
  if (schema.startsWith('bar_')) {
    const scale = n(1, 5), item = makeBarGraphItem(scale, n(2, 7));
    const spec = item.measurementSpec! as Extract<MeasurementDataSpec, { kind: 'bar_graph' }>;
    if (schema === 'bar_compare') { spec.question = 'compare'; spec.comparedIndices = [0, 1]; item.prompt = 'Use the bar graph. How many more books did Mia read than Leo?'; item.answer = spec.values[0] - spec.values[1]; }
    if (schema === 'bar_total') { spec.question = 'total'; spec.comparedIndices = [0, 1]; item.prompt = 'Use the bar graph. How many books did Mia and Leo read in all?'; item.answer = spec.values[0] + spec.values[1]; }
    if (schema === 'bar_missing') { spec.question = 'missing'; spec.requestedIndex = 2; item.prompt = 'The Ava bar is missing. What value should it show?'; item.answer = spec.values[2]; }
    item.id = `MEAS_${schema}_${scale}_${spec.values.join('-')}`; item.cardKey = measurementCardKey(schema); return item;
  }
  if (schema.startsWith('line_plot_')) {
    const denominator = schema === 'line_plot_fractional' ? (rng() < .5 ? 2 : 4) : 1;
    const ticks = Array.from({ length: 6 }, () => n(4, 10));
    const item = makeLinePlotItem(ticks[0], ticks[1], ticks[2], ticks[3]);
    item.id = `MEAS_${schema}_${denominator}_${ticks.join('-')}`;
    item.measurementSpec = { kind: 'line_plot', unit: 'inch', denominator, valuesInTicks: ticks, question: schema === 'line_plot_range' ? 'range' : 'count_at_value', targetTick: ticks[0] };
    item.prompt = schema === 'line_plot_range' ? 'Use the line plot. What is the difference between the longest and shortest measurements?' : `Use the line plot. How many measurements are at ${ticks[0]}/${denominator} inches?`;
    item.answer = schema === 'line_plot_range' ? (Math.max(...ticks) - Math.min(...ticks)) / denominator : ticks.filter(tick => tick === ticks[0]).length;
    item.cardKey = measurementCardKey(schema); return item;
  }
  const unitSchema: MeasSchema = schema === 'measurement_subtract' ? 'subg' : 'addg';
  const item = makeMeasurementWordProblem(unitSchema, n(2, 20), n(1, 10)); item.cardKey = measurementCardKey(schema); return item;
}
