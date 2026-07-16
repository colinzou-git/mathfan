export interface BarGraphGeometry {
  maxValue: number;
  tickValues: number[];
  barHeightsPct: number[];
}

/** Deterministic zero-based geometry for scaled elementary bar graphs. */
export function buildBarGraphGeometry(values: number[], scale: number): BarGraphGeometry {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Bar graph scale must be positive');
  const safeValues = values.map(value => Number.isFinite(value) ? Math.max(0, value) : 0);
  const highestValue = Math.max(0, ...safeValues);
  const maxValue = Math.max(scale, Math.ceil(highestValue / scale) * scale);
  const tickValues = Array.from({ length: Math.round(maxValue / scale) + 1 }, (_, index) => index * scale);
  return {
    maxValue,
    tickValues,
    barHeightsPct: safeValues.map(value => value / maxValue * 100),
  };
}
