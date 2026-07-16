import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { selectSchemaBalancedItems } from '../features/adaptive/candidatePools';
import {
  buildElapsedTimeJumps, elapsedMinutes, generateElapsedTimeSpec, generateMeasurementItem, makeBarGraphItem,
  makeElapsedTimeItem, makeLinePlotItem, makeMeasurementWordProblem, minutesSinceMidnight,
  validateMeasurementItem,
} from '../features/curriculum/measurementItems';
import { articleFor, formatQuantity, pluralize } from '../features/curriculum/language';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { makeTwoStepWordProblem } from '../features/curriculum/twoStepItems';
import { makeWordProblem } from '../features/curriculum/wordProblemItems';
import { detectMistakes } from '../features/mastery/misconceptionEngine';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { getHint } from '../features/practice/hintEngine';
import { deriveCardKey } from '../features/scheduler/cardModel';
import { VisualModel } from '../features/visuals/VisualModel';
import { mulberry32 } from '../utils/rng';

afterEach(cleanup);

describe('authentic measurement and data instances', () => {
  it('calculates elapsed time and friendly hour jumps', () => {
    expect(minutesSinceMidnight({ hour: 9, minute: 45 })).toBe(585);
    expect(elapsedMinutes({ hour: 9, minute: 45 }, { hour: 10, minute: 25 })).toBe(40);
    expect(buildElapsedTimeJumps({ hour: 9, minute: 45 }, { hour: 10, minute: 25 })).toEqual([
      { from: { hour: 9, minute: 45 }, to: { hour: 10, minute: 0 }, minutes: 15 },
      { from: { hour: 10, minute: 0 }, to: { hour: 10, minute: 25 }, minutes: 25 },
    ]);
  });

  it('normalizes 12-hour rollover while preserving positive elapsed time', () => {
    const acrossNoon = makeElapsedTimeItem(11, 45, 12, 15);
    const afterTwelve = makeElapsedTimeItem(12, 45, 1, 15);
    expect(acrossNoon.answer).toBe(30);
    expect(afterTwelve.answer).toBe(30);
    expect(afterTwelve.measurementSpec).toMatchObject({
      start: { hour: 12, minute: 45 }, end: { hour: 1, minute: 15 },
      crossesHour: true, durationMinutes: 30,
    });
    expect(buildElapsedTimeJumps({ hour: 12, minute: 45 }, { hour: 1, minute: 15 })).toEqual([
      { from: { hour: 12, minute: 45 }, to: { hour: 1, minute: 0 }, minutes: 15 },
      { from: { hour: 1, minute: 0 }, to: { hour: 1, minute: 15 }, minutes: 15 },
    ]);
  });

  it.each(['elapsed_same_hour', 'elapsed_cross_hour'] as const)(
    'satisfies %s invariants and deterministic reconstruction across 1,000 seeds',
    schema => {
      for (let seed = 0; seed < 1000; seed++) {
        const item = generateMeasurementItem(schema, { rng: mulberry32(seed) });
        const repeated = generateMeasurementItem(schema, { rng: mulberry32(seed) });
        const rebuilt = makeItemFromId(item.id);
        expect(item).toEqual(repeated);
        expect(validateMeasurementItem(item)).toEqual([]);
        expect(rebuilt?.answer).toBe(item.answer);
        expect(rebuilt?.measurementSpec).toEqual(item.measurementSpec);
        expect(deriveCardKey(rebuilt!)).toBe(deriveCardKey(item));
        const spec = item.measurementSpec;
        if (!spec || spec.kind !== 'elapsed_time') throw new Error('Expected elapsed-time spec');
        expect(spec.durationMinutes).toBe(item.answer);
        expect(spec.durationMinutes).toBeGreaterThan(0);
        expect(spec.start.hour).toBeGreaterThanOrEqual(1);
        expect(spec.start.hour).toBeLessThanOrEqual(12);
        expect(spec.end.hour).toBeGreaterThanOrEqual(1);
        expect(spec.end.hour).toBeLessThanOrEqual(12);
        expect(spec.start.minute + spec.durationMinutes >= 60).toBe(schema === 'elapsed_cross_hour');
      }
    },
  );

  it('pure elapsed generator honors minute increments and named schemas', () => {
    const same = generateElapsedTimeSpec({
      schema: 'elapsed_same_hour', startHourMin: 12, startHourMax: 12,
      minuteIncrement: 15, durationMin: 15, durationMax: 45,
    }, mulberry32(2));
    const cross = generateElapsedTimeSpec({
      schema: 'elapsed_cross_hour', startHourMin: 12, startHourMax: 12,
      minuteIncrement: 15, durationMin: 15, durationMax: 45,
    }, mulberry32(2));
    expect(same.start.minute % 15).toBe(0);
    expect(same.start.minute + same.durationMinutes).toBeLessThan(60);
    expect(cross.start.minute + cross.durationMinutes).toBeGreaterThanOrEqual(60);
    expect(cross.end.hour).toBe(1);
  });

  it('keeps generated Grade 3 measurement subtraction nonnegative across 1,000 seeds', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const item = generateMeasurementItem('measurement_subtract', { rng: mulberry32(seed) });
      expect(Number(item.answer)).toBeGreaterThanOrEqual(0);
      expect(validateMeasurementItem(item)).toEqual([]);
      const rebuilt = makeItemFromId(item.id);
      expect(rebuilt?.answer).toBe(item.answer);
      expect(rebuilt?.measurementSpec).toEqual(item.measurementSpec);
      expect(deriveCardKey(rebuilt!)).toBe(deriveCardKey(item));
    }
  });

  it('renders a scaled bar graph without announcing the computed answer', () => {
    const item = makeBarGraphItem(5, 6);
    render(<VisualModel item={item} />);
    expect(screen.getByRole('figure', { name: /scale counts by 5 from 0/i })).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
    expect(item.answer).toBe(30);
    expect(item.prompt).not.toContain('30');
  });

  it('hides a missing bar value from accessible and visible content until reveal', () => {
    const item = generateMeasurementItem('bar_missing', { rng: mulberry32(91) });
    const hiddenValue = String(item.answer);
    const { rerender } = render(<VisualModel item={item} />);
    const hiddenFigure = screen.getByRole('figure');
    expect(hiddenFigure).toHaveAccessibleName(/Ava: missing/i);
    expect(hiddenFigure.getAttribute('aria-label')).not.toContain(`Ava: ${hiddenValue}`);
    expect(hiddenFigure).toHaveTextContent('?');

    rerender(<VisualModel item={item} revealAnswer />);
    expect(screen.getByRole('figure')).toHaveAccessibleName(new RegExp(`Ava: ${hiddenValue}`));
    expect(screen.getByRole('figure')).not.toHaveTextContent('?');
  });

  it.each(['bar_compare', 'bar_total'] as const)('%s names every source bar without announcing the computed answer', schema => {
    const item = generateMeasurementItem(schema, { rng: mulberry32(91) });
    render(<VisualModel item={item} />);
    const name = screen.getByRole('figure').getAttribute('aria-label') ?? '';
    const spec = item.measurementSpec!;
    if (spec.kind !== 'bar_graph') throw new Error('Expected bar graph');
    spec.categories.forEach((category, index) => expect(name).toContain(`${category}: ${spec.values[index]}`));
    if (!spec.values.includes(Number(item.answer))) expect(name).not.toContain(`: ${item.answer}.`);
  });

  it('renders repeated X marks at fractional integer ticks', () => {
    const item = generateMeasurementItem('line_plot_fractional', { rng: mulberry32(44) });
    render(<VisualModel item={item} />);
    expect(screen.getByRole('figure', { name: /line plot.*halves|line plot.*quarters/i })).toBeInTheDocument();
    const spec = item.measurementSpec!;
    expect(spec.kind).toBe('line_plot');
    if (spec.kind === 'line_plot') expect(screen.getAllByText('✕')).toHaveLength(spec.valuesInTicks.length);
  });

  it('renders elapsed-time reasoning without revealing jump lengths pre-answer', () => {
    const item = makeElapsedTimeItem(9, 45, 10, 25);
    render(<VisualModel item={item} />);
    expect(screen.getByRole('figure', { name: /elapsed time line from 9:45 to 10:25/i })).toHaveTextContent('jump');
    expect(screen.queryByText(/\+15 min/)).not.toBeInTheDocument();
  });

  it('generates deterministic stable template instances and reconstructs them', () => {
    for (const schema of ['bar_compare', 'bar_total', 'bar_missing', 'line_plot_range', 'line_plot_fractional'] as const) {
      const first = generateMeasurementItem(schema, { rng: mulberry32(91) });
      const second = generateMeasurementItem(schema, { rng: mulberry32(91) });
      expect(first).toEqual(second);
      expect(makeItemFromId(first.id)?.answer).toBe(first.answer);
      expect(deriveCardKey(first)).toBe(`template:g3-measurement:${schema}`);
    }
    expect(makeItemFromId('BARG_5_6')?.measurementSpec?.kind).toBe('bar_graph');
    expect(makeItemFromId('LPLOT_1_2_2_3')?.measurementSpec?.kind).toBe('line_plot');
  });
});

describe('measurement feedback, language, and balanced stories', () => {
  it('detects elapsed and graph-scale counterfactuals', () => {
    const elapsed = makeElapsedTimeItem(9, 45, 10, 25);
    expect(detectMistakes(elapsed, 20)).toContain('measurement:elapsed_subtracted_clock_digits');
    const graph = makeBarGraphItem(5, 6);
    expect(detectMistakes(graph, 6)).toContain('measurement:bar_height_read_without_scale');
  });

  it('gives timeline and scale-specific progressive hints', () => {
    const elapsed = makeElapsedTimeItem(9, 45, 10, 25);
    expect(getHint(elapsed, 2)?.text).toMatch(/time line/i);
    expect(getHint(elapsed, 3)?.text).toContain('15 minutes');
    expect(getHint(makeBarGraphItem(5, 6), 2)?.text).toContain('Each grid step represents 5');
  });

  it('handles singular grammar and structured one/two-step models', () => {
    expect(pluralize(1, 'row')).toBe('row');
    expect(pluralize(2, 'row')).toBe('rows');
    expect(articleFor('array')).toBe('an');
    expect(formatQuantity(1, 'liter')).toBe('1 liter');
    expect(makeMeasurementWordProblem('addl', 1, 2).prompt).toContain('1 liter');
    expect(makeWordProblem('eg', 3, 4).wordProblemSpec?.steps[0]).toEqual({ operation: 'multiply', a: 3, b: 4, result: 12 });
    const twoStep = makeTwoStepWordProblem('muls', 4, 5, 8);
    expect(twoStep.wordProblemSpec?.steps.map(step => step.result)).toEqual([20, 12]);
    expect(deriveCardKey(twoStep)).toBe('template:g3-word-problem:two-step-muls');
  });

  it('selects candidates to schema quotas deterministically', () => {
    const candidates = ['eg', 'eg', 'ar', 'ar', 'dv', 'dv'].map((schema, index) => ({ ...makeWordProblem(schema as 'eg' | 'ar' | 'dv', index + 2, 2), id: `${schema}-${index}`, schemaId: schema }));
    const selected = selectSchemaBalancedItems(candidates, 4, { eg: 1, ar: 1, dv: 1 }, mulberry32(8));
    expect(selected).toHaveLength(4);
    expect(new Set(selected.map(item => item.schemaId))).toEqual(new Set(['eg', 'ar', 'dv']));
  });

  it('plans only reconstructable authentic graph and line-plot evidence', () => {
    for (const skillId of ['g3-scaled-bar-graphs', 'g3-line-plots']) {
      const ids = planPracticeForSkill(skillId).specificItemIds!;
      expect(ids.every(id => makeItemFromId(id)?.measurementSpec != null)).toBe(true);
    }
    expect(makeLinePlotItem(1, 2, 2, 3).prompt).not.toContain('shows these measurements');
  });
});
