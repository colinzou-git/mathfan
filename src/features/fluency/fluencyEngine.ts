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

export type FluencyBaselineMap = Map<string, StudentFluencyBaseline>;
export type FluencyEvidenceReason = 'eligible' | 'incorrect' | 'retry' | 'hinted' | 'related'
  | 'non_atomic' | 'untimed_assessment' | 'scheduling_ineligible' | 'scheduler_not_applied' | 'invalid_latency' | 'missing_card_key';

export interface FluencyEvidenceDecision {
  eligible: boolean;
  reason: FluencyEvidenceReason;
  cardKey?: string;
  latencyMs?: number;
}

/** Require at least this many qualifying samples before trusting a personal baseline over policy defaults. */
export const MIN_BASELINE_SAMPLES = 5;
export const MAX_FLUENCY_SAMPLES = 50;

/** Authoritative rule for modern, durably scheduled personal-fluency evidence. */
export function classifyFluencyEvidence(event: MathAnswerEvent): FluencyEvidenceDecision {
  if (!event.isCorrect) return { eligible: false, reason: 'incorrect' };
  if (event.isRetry) return { eligible: false, reason: 'retry' };
  if (event.hintUsed || event.schedulingTelemetry?.supportLevel === 'hint') return { eligible: false, reason: 'hinted' };
  if (event.relatedEvidence) return { eligible: false, reason: 'related' };
  if (event.responsePolicy !== 'atomic_fluency') return { eligible: false, reason: 'non_atomic' };
  if (event.gradingContext === 'untimed_assessment') return { eligible: false, reason: 'untimed_assessment' };
  if (event.schedulingEligible === false) return { eligible: false, reason: 'scheduling_ineligible' };
  if (event.schedulingApplied !== true) return { eligible: false, reason: 'scheduler_not_applied' };
  if (!Number.isFinite(event.latencyMs) || event.latencyMs <= 0) return { eligible: false, reason: 'invalid_latency' };
  const cardKey = event.cardKey;
  if (!cardKey) return { eligible: false, reason: 'missing_card_key' };
  return { eligible: true, reason: 'eligible', cardKey, latencyMs: event.latencyMs };
}

/**
 * Compatibility is deliberately proof-based: an older top-level event may be
 * admitted only when its versioned telemetry explicitly records a successful
 * scheduler write. A wholly missing applied marker is never inferred as success.
 */
export function classifyLegacyFluencyEvidence(event: MathAnswerEvent): FluencyEvidenceDecision {
  return classifyFluencyEvidence(event.schedulingApplied === undefined
    && event.schedulingTelemetry?.schedulingApplied === true
    ? { ...event, schedulingApplied: true }
    : event);
}

function compareEvents(a: MathAnswerEvent, b: MathAnswerEvent): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

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
  const latencies = [...events].sort(compareEvents)
    .map(classifyLegacyFluencyEvidence)
    .filter((decision): decision is FluencyEvidenceDecision & { eligible: true; cardKey: string; latencyMs: number } => decision.eligible)
    .filter(decision => decision.cardKey === cardFamily)
    .slice(-MAX_FLUENCY_SAMPLES)
    .map(decision => decision.latencyMs)
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

/** Builds established personal baselines for every canonical card represented in the events. */
export function buildFluencyBaselineMap(events: MathAnswerEvent[]): FluencyBaselineMap {
  const cardFamilies = new Set(events.map(classifyLegacyFluencyEvidence)
    .filter(decision => decision.eligible && decision.cardKey)
    .map(decision => decision.cardKey!));
  const baselines: FluencyBaselineMap = new Map();
  for (const cardFamily of cardFamilies) {
    const baseline = deriveFluencyBaseline(events, cardFamily);
    if (baseline) baselines.set(cardFamily, baseline);
  }
  return baselines;
}

export function summarizeFluencyEvidenceEligibility(events: readonly MathAnswerEvent[]): Record<FluencyEvidenceReason, number> {
  const result = Object.fromEntries((['eligible', 'incorrect', 'retry', 'hinted', 'related', 'non_atomic',
    'untimed_assessment', 'scheduling_ineligible', 'scheduler_not_applied', 'invalid_latency', 'missing_card_key'] as FluencyEvidenceReason[])
    .map(reason => [reason, 0])) as Record<FluencyEvidenceReason, number>;
  for (const event of events) result[classifyLegacyFluencyEvidence(event).reason] += 1;
  return result;
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
