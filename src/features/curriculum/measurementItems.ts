import type { PracticeItem } from '../../types/math';
import type { ArithmeticGeneratorContext as TemplateGeneratorContext } from './regrouping';
import type { ClockTime, MeasurementDataSpec, MeasurementSchema } from './measurementTypes';
import { formatQuantity } from './language';
import type { Rng } from '../../utils/rng';

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(n: number): string { return n.toString().padStart(2, '0'); }
function fmtTime(h: number, m: number): string { return `${h}:${pad(m)}`; }
function wrapM(m: number): number { return ((m % 60) + 60) % 60; }
function wrapH(h: number): number { return ((h - 1 + 12) % 12) + 1; }

export function minutesSinceMidnight(time: ClockTime): number { return time.hour * 60 + time.minute; }
/**
 * Elapsed minutes on a 12-hour classroom clock. When the displayed end time is
 * not later than the start, it is interpreted as the next 12-hour cycle.
 */
export function elapsedMinutes(start: ClockTime, end: ClockTime): number {
  const startMinutes = minutesSinceMidnight(start);
  let endMinutes = minutesSinceMidnight(end);
  if (endMinutes <= startMinutes) endMinutes += 12 * 60;
  return endMinutes - startMinutes;
}
export function buildElapsedTimeJumps(start: ClockTime, end: ClockTime): Array<{ from: ClockTime; to: ClockTime; minutes: number }> {
  const jumps: Array<{ from: ClockTime; to: ClockTime; minutes: number }> = [];
  let cursorMinutes = minutesSinceMidnight(start);
  let endMinutes = minutesSinceMidnight(end);
  if (endMinutes <= cursorMinutes) endMinutes += 12 * 60;
  while (cursorMinutes < endMinutes) {
    const cursor = { hour: wrapH(Math.floor(cursorMinutes / 60)), minute: cursorMinutes % 60 };
    const toHour = 60 - cursor.minute;
    const current = cursorMinutes;
    const jump = cursor.minute !== 0 && current + toHour <= endMinutes ? toHour : Math.min(60, endMinutes - current);
    const nextTotal = current + jump;
    const to = { hour: wrapH(Math.floor(nextTotal / 60)), minute: nextTotal % 60 };
    jumps.push({ from: cursor, to, minutes: jump });
    cursorMinutes = nextTotal;
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
  const crossesHour = m1 + elapsed >= 60;
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
    measurementSpec: { kind: 'elapsed_time', start, end, crossesHour, durationMinutes: elapsed },
    cardKey: measurementCardKey(crossesHour ? 'elapsed_cross_hour' : 'elapsed_same_hour'),
  };
}

export interface ElapsedTimeConstraints {
  schema: 'elapsed_same_hour' | 'elapsed_cross_hour';
  startHourMin?: number;
  startHourMax?: number;
  minuteIncrement: 1 | 5 | 15;
  durationMin: number;
  durationMax: number;
}

/** Generates from monotonic minutes, then normalizes display hours to 1–12. */
export function generateElapsedTimeSpec(
  constraints: ElapsedTimeConstraints,
  rng: Rng,
): Extract<MeasurementDataSpec, { kind: 'elapsed_time' }> {
  const startHourMin = constraints.startHourMin ?? 8;
  const startHourMax = constraints.startHourMax ?? 12;
  const candidates: Array<{ startAbsolute: number; duration: number }> = [];
  for (let hour = startHourMin; hour <= startHourMax; hour++) {
    for (let minute = 0; minute < 60; minute += constraints.minuteIncrement) {
      for (let duration = constraints.durationMin; duration <= constraints.durationMax; duration += constraints.minuteIncrement) {
        if (duration <= 0) continue;
        const startAbsolute = hour * 60 + minute;
        const endAbsolute = startAbsolute + duration;
        const crossesHour = Math.floor(startAbsolute / 60) !== Math.floor(endAbsolute / 60);
        if (crossesHour === (constraints.schema === 'elapsed_cross_hour')) {
          candidates.push({ startAbsolute, duration });
        }
      }
    }
  }
  if (candidates.length === 0) throw new Error(`No elapsed-time candidates satisfy ${constraints.schema}`);
  const chosen = candidates[Math.floor(rng() * candidates.length)];
  const endAbsolute = chosen.startAbsolute + chosen.duration;
  return {
    kind: 'elapsed_time',
    start: { hour: wrapH(Math.floor(chosen.startAbsolute / 60)), minute: chosen.startAbsolute % 60 },
    end: { hour: wrapH(Math.floor(endAbsolute / 60)), minute: endAbsolute % 60 },
    crossesHour: constraints.schema === 'elapsed_cross_hour',
    durationMinutes: chosen.duration,
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

export function generateMeasurementContextValues(
  operation: 'add' | 'subtract',
  rng: Rng,
): [number, number] {
  const n = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const first = n(2, 20);
  const second = n(1, operation === 'subtract' ? first : 10);
  return [first, second];
}

/** Returns generator invariant violations; an empty array means the item is consistent. */
export function validateMeasurementItem(item: PracticeItem): string[] {
  const errors: string[] = [];
  const spec = item.measurementSpec;
  if (!spec) return ['missing measurementSpec'];
  if (spec.kind === 'elapsed_time') {
    const duration = elapsedMinutes(spec.start, spec.end);
    const schema = spec.crossesHour ? 'elapsed_cross_hour' : 'elapsed_same_hour';
    if (duration !== spec.durationMinutes || duration !== item.answer) errors.push('elapsed duration/answer mismatch');
    if (duration <= 0) errors.push('elapsed duration must be positive');
    if (spec.start.hour < 1 || spec.start.hour > 12 || spec.end.hour < 1 || spec.end.hour > 12) errors.push('display hour outside 1–12');
    if (spec.crossesHour !== (spec.start.minute + duration >= 60)) errors.push('elapsed hour-crossing mismatch');
    if (!item.prompt.includes(fmtTime(spec.start.hour, spec.start.minute))
      || !item.prompt.includes(fmtTime(spec.end.hour, spec.end.minute))) errors.push('prompt time/spec mismatch');
    if (item.cardKey !== measurementCardKey(schema)) errors.push('elapsed card key mismatch');
  }
  if (spec.kind === 'measurement_context') {
    const expected = spec.operation === 'add' ? spec.values[0] + spec.values[1] : spec.values[0] - spec.values[1];
    if (expected !== item.answer) errors.push('measurement answer mismatch');
    if (spec.operation === 'subtract' && expected < 0) errors.push('negative Grade 3 subtraction');
  }
  return errors;
}

function assertValidMeasurementItem(item: PracticeItem): PracticeItem {
  const errors = validateMeasurementItem(item);
  if (errors.length > 0) throw new Error(`Invalid generated measurement item ${item.id}: ${errors.join('; ')}`);
  return item;
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
  if (schema.startsWith('clock_')) return assertValidMeasurementItem(makeTimeItem(n(1, 12), schema === 'clock_to_5_minutes' ? n(0, 11) * 5 : n(0, 59)));
  if (schema === 'elapsed_same_hour' || schema === 'elapsed_cross_hour') {
    const spec = generateElapsedTimeSpec({
      schema,
      minuteIncrement: 5,
      durationMin: 5,
      durationMax: schema === 'elapsed_cross_hour' ? 80 : 45,
    }, rng);
    return assertValidMeasurementItem(makeElapsedTimeItem(spec.start.hour, spec.start.minute, spec.end.hour, spec.end.minute));
  }
  if (schema.startsWith('bar_')) {
    const scale = n(1, 5), item = makeBarGraphItem(scale, n(2, 7));
    const spec = item.measurementSpec! as Extract<MeasurementDataSpec, { kind: 'bar_graph' }>;
    if (schema === 'bar_compare') { spec.question = 'compare'; spec.comparedIndices = [0, 1]; item.prompt = 'Use the bar graph. How many more books did Mia read than Leo?'; item.answer = spec.values[0] - spec.values[1]; }
    if (schema === 'bar_total') { spec.question = 'total'; spec.comparedIndices = [0, 1]; item.prompt = 'Use the bar graph. How many books did Mia and Leo read in all?'; item.answer = spec.values[0] + spec.values[1]; }
    if (schema === 'bar_missing') { spec.question = 'missing'; spec.requestedIndex = 2; item.prompt = 'The Ava bar is missing. What value should it show?'; item.answer = spec.values[2]; }
    item.id = `MEAS_${schema}_${scale}_${spec.values.join('-')}`; item.cardKey = measurementCardKey(schema); return assertValidMeasurementItem(item);
  }
  if (schema.startsWith('line_plot_')) {
    const denominator = schema === 'line_plot_fractional' ? (rng() < .5 ? 2 : 4) : 1;
    const ticks = Array.from({ length: 6 }, () => n(4, 10));
    const item = makeLinePlotItem(ticks[0], ticks[1], ticks[2], ticks[3]);
    item.id = `MEAS_${schema}_${denominator}_${ticks.join('-')}`;
    item.measurementSpec = { kind: 'line_plot', unit: 'inch', denominator, valuesInTicks: ticks, question: schema === 'line_plot_range' ? 'range' : 'count_at_value', targetTick: ticks[0] };
    item.prompt = schema === 'line_plot_range' ? 'Use the line plot. What is the difference between the longest and shortest measurements?' : `Use the line plot. How many measurements are at ${ticks[0]}/${denominator} inches?`;
    item.answer = schema === 'line_plot_range' ? (Math.max(...ticks) - Math.min(...ticks)) / denominator : ticks.filter(tick => tick === ticks[0]).length;
    item.cardKey = measurementCardKey(schema); return assertValidMeasurementItem(item);
  }
  const unitSchema: MeasSchema = schema === 'measurement_subtract' ? 'subg' : 'addg';
  const [a, b] = generateMeasurementContextValues(schema === 'measurement_subtract' ? 'subtract' : 'add', rng);
  const item = makeMeasurementWordProblem(unitSchema, a, b); item.cardKey = measurementCardKey(schema); return assertValidMeasurementItem(item);
}
