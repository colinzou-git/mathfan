import type { MathAnswerEvent } from '../learning/learningEvents';
import type { ResponsePolicy } from '../scheduler/responsePolicy';

export type FluencyBand = 'fast' | 'expected' | 'slow' | 'not_applicable';

export interface StudentFluencyBaseline {
  cardFamily: string;
  sampleCount: number;
  medianMs: number;
  p25Ms: number;
  p75Ms: number;
}

/** Require at least this many qualifying samples before trusting a personal baseline over policy defaults. */
export const MIN_BASELINE_SAMPLES = 5;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Derives a student-relative latency baseline for one card family from direct,
 * correct, first-attempt evidence only (excludes retries and synthetic
 * related-evidence nudges, which are not genuine independent-retrieval timing).
 * Returns null when there isn't enough data to trust a personal baseline yet.
 */
export function deriveFluencyBaseline(
  events: MathAnswerEvent[],
  cardFamily: string
): StudentFluencyBaseline | null {
  const latencies = events
    .filter(e => !e.isRetry && !e.relatedEvidence && e.isCorrect)
    .filter(e => (e.cardKey ?? e.itemId) === cardFamily)
    .map(e => e.latencyMs)
    .sort((a, b) => a - b);

  if (latencies.length < MIN_BASELINE_SAMPLES) return null;

  return {
    cardFamily,
    sampleCount: latencies.length,
    medianMs: percentile(latencies, 0.5),
    p25Ms: percentile(latencies, 0.25),
    p75Ms: percentile(latencies, 0.75),
  };
}

/** Classifies latency into a fluency band, preferring a personal baseline over policy defaults. */
export function classifyFluency(
  latencyMs: number,
  policy: ResponsePolicy,
  baseline?: StudentFluencyBaseline | null
): FluencyBand {
  if (!policy.useLatencyForFsrs) return 'not_applicable';

  const fastCutoff = baseline ? baseline.p25Ms : policy.easyMs;
  const slowCutoff = baseline ? baseline.p75Ms : policy.hardMs;

  if (slowCutoff !== undefined && latencyMs > slowCutoff) return 'slow';
  if (fastCutoff !== undefined && latencyMs <= fastCutoff) return 'fast';
  return 'expected';
}
