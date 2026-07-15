/** Pluralizes a unit word based on a count (issue #30: fixes prompts like "1 rows"). */
export function pluralizeUnit(value: number, singular: string, plural?: string): string {
  const word = value === 1 ? singular : (plural ?? `${singular}s`);
  return `${value} ${word}`;
}

/** Formats a measurement value with its unit, using correct pluralization. */
export function formatMeasurement(value: number, unit: string): string {
  return pluralizeUnit(value, unit);
}
