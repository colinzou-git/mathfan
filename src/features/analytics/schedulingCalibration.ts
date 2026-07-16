import type { MathAnswerEvent } from '../learning/learningEvents';

export interface CalibrationBucket { predictedRange: [number, number]; observationCount: number; predictedMean: number; observedAccuracy: number; calibrationError: number; sufficientData: boolean }
export interface SchedulingCalibrationReport { overall: CalibrationBucket[]; byCardFamily: Record<string, CalibrationBucket[]>; byIntervalBand: Record<string, CalibrationBucket[]>; excludedCounts: Record<string, number> }
const RANGES: Array<[number, number]> = [[0, .2], [.2, .4], [.4, .6], [.6, .8], [.8, 1.000001]];
const MIN_SAMPLES = 5;

function buckets(events: MathAnswerEvent[]): CalibrationBucket[] {
  return RANGES.map(([lo, hi]) => {
    const selected = events.filter(e => { const r = e.schedulingTelemetry?.before?.retrievability; return r !== undefined && r >= lo && r < hi; });
    const predictedMean = selected.length ? selected.reduce((s, e) => s + (e.schedulingTelemetry!.before!.retrievability!), 0) / selected.length : 0;
    const observedAccuracy = selected.length ? selected.filter(e => e.isCorrect).length / selected.length : 0;
    return { predictedRange: [lo, Math.min(1, hi)], observationCount: selected.length, predictedMean, observedAccuracy, calibrationError: observedAccuracy - predictedMean, sufficientData: selected.length >= MIN_SAMPLES };
  });
}

export function buildSchedulingCalibrationReport(events: MathAnswerEvent[]): SchedulingCalibrationReport {
  const excludedCounts: Record<string, number> = { legacy: 0, retry: 0, related: 0, unsupported: 0, ineligible: 0, schedulerFailure: 0, repeated: 0 };
  const seen = new Set<string>();
  const included = events.filter(event => {
    const t = event.schedulingTelemetry;
    if (!t?.before || t.before.retrievability === undefined) { excludedCounts.legacy++; return false; }
    if (event.isRetry || t.attemptNo !== 1) { excludedCounts.retry++; return false; }
    if (event.relatedEvidence || t.evidenceKind !== 'direct') { excludedCounts.related++; return false; }
    if (t.supportLevel !== 'independent') { excludedCounts.unsupported++; return false; }
    if (!t.schedulingEligible) { excludedCounts.ineligible++; return false; }
    if (event.schedulingApplied === false || !t.schedulingApplied) { excludedCounts.schedulerFailure++; return false; }
    const key = `${event.sessionId}|${t.cardKey}`;
    if (seen.has(key)) { excludedCounts.repeated++; return false; }
    seen.add(key); return true;
  });
  const group = (key: (event: MathAnswerEvent) => string) => Object.fromEntries([...new Set(included.map(key))].map(value => [value, buckets(included.filter(e => key(e) === value))]));
  return {
    overall: buckets(included),
    byCardFamily: group(e => e.schedulingTelemetry!.schemaId),
    byIntervalBand: group(e => { const days = e.schedulingTelemetry!.before!.elapsedDays ?? 0; return days < 2 ? '0–1 days' : days < 8 ? '2–7 days' : '8+ days'; }),
    excludedCounts,
  };
}
