import { describe, expect, it } from 'vitest';
import { buildBarGraphGeometry } from '../features/visuals/barGraphGeometry';

describe('buildBarGraphGeometry', () => {
  it.each([
    [1, [0, 1, 2, 3]],
    [2, [0, 2, 4, 6]],
    [5, [0, 5, 10, 15]],
    [10, [0, 10, 20, 30]],
  ])('builds exact scale-%s ticks', (scale, ticks) => {
    expect(buildBarGraphGeometry([scale, scale * 2, scale * 3], scale).tickValues).toEqual(ticks);
  });

  it('rounds the maximum up to the next exact tick', () => {
    expect(buildBarGraphGeometry([3, 12], 5)).toMatchObject({ maxValue: 15, tickValues: [0, 5, 10, 15] });
  });

  it('aligns bar height percentages exactly to the zero-based axis', () => {
    const heights = buildBarGraphGeometry([5, 10, 15], 5).barHeightsPct;
    expect(heights[0]).toBeCloseTo(100 / 3);
    expect(heights[1]).toBeCloseTo(200 / 3);
    expect(heights[2]).toBe(100);
  });
});
