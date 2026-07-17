import { describe, expect, it } from 'vitest';
import { buildFluencyBaselineMap, deriveFluencyBaseline, classifyFluency, classifyFluencyEvidence, classifyLegacyFluencyEvidence, MAX_FLUENCY_SAMPLES, MIN_BASELINE_SAMPLES, summarizeFluencyEvidenceEligibility } from '../features/fluency/fluencyEngine';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { ResponsePolicy } from '../features/scheduler/responsePolicy';

function event(overrides: Partial<MathAnswerEvent> = {}): MathAnswerEvent {
  return {
    id: `e-${Math.random()}`, studentId: 's', sessionId: 'sess',
    itemId: 'MUL_7x8', cardKey: 'fact:mul:7x8', mode: 'practice',
    promptShown: '7x8', correctAnswer: 56, studentAnswer: 56,
    isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 1000,
    schedulingApplied: true, responsePolicy: 'atomic_fluency',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('deriveFluencyBaseline', () => {
  it('builds a map keyed by canonical card and omits insufficient families', () => {
    const events = [
      ...Array.from({ length: MIN_BASELINE_SAMPLES }, (_, i) => event({ latencyMs: 800 + i * 100 })),
      event({ cardKey: 'fact:mul:2x2', itemId: 'MUL_2x2' }),
    ];
    const map = buildFluencyBaselineMap(events);
    expect(map.get('fact:mul:7x8')?.sampleCount).toBe(MIN_BASELINE_SAMPLES);
    expect(map.has('fact:mul:2x2')).toBe(false);
  });

  it('returns null below the minimum sample count', () => {
    const events = Array.from({ length: MIN_BASELINE_SAMPLES - 1 }, (_, i) => event({ latencyMs: 1000 + i }));
    expect(deriveFluencyBaseline(events, 'fact:mul:7x8')).toBeNull();
  });

  it('returns a baseline once the minimum sample count is reached', () => {
    const events = Array.from({ length: MIN_BASELINE_SAMPLES }, (_, i) => event({ latencyMs: 1000 + i * 100 }));
    const baseline = deriveFluencyBaseline(events, 'fact:mul:7x8');
    expect(baseline).not.toBeNull();
    expect(baseline!.sampleCount).toBe(MIN_BASELINE_SAMPLES);
  });

  it('is card-family specific — does not mix in a different card\'s events', () => {
    const events = [
      ...Array.from({ length: MIN_BASELINE_SAMPLES }, (_, i) => event({ latencyMs: 1000 + i, cardKey: 'fact:mul:7x8' })),
      ...Array.from({ length: MIN_BASELINE_SAMPLES }, (_, i) => event({ latencyMs: 9000 + i, cardKey: 'fact:mul:2x2' })),
    ];
    const baseline = deriveFluencyBaseline(events, 'fact:mul:7x8');
    expect(baseline!.medianMs).toBeLessThan(2000);
  });

  it('excludes retries', () => {
    const events = [
      ...Array.from({ length: MIN_BASELINE_SAMPLES }, (_, i) => event({ latencyMs: 1000 + i })),
      ...Array.from({ length: MIN_BASELINE_SAMPLES }, () => event({ latencyMs: 99999, isRetry: true })),
    ];
    const baseline = deriveFluencyBaseline(events, 'fact:mul:7x8');
    expect(baseline!.medianMs).toBeLessThan(2000);
  });

  it('excludes synthetic related-evidence events', () => {
    const events = [
      ...Array.from({ length: MIN_BASELINE_SAMPLES }, (_, i) => event({ latencyMs: 1000 + i })),
      ...Array.from({ length: MIN_BASELINE_SAMPLES }, () => event({ latencyMs: 0, relatedEvidence: true, studentAnswer: null })),
    ];
    const baseline = deriveFluencyBaseline(events, 'fact:mul:7x8');
    expect(baseline!.medianMs).toBeGreaterThan(500);
  });

  it('excludes incorrect answers', () => {
    const events = [
      ...Array.from({ length: MIN_BASELINE_SAMPLES }, (_, i) => event({ latencyMs: 1000 + i })),
      ...Array.from({ length: MIN_BASELINE_SAMPLES }, () => event({ latencyMs: 50000, isCorrect: false })),
    ];
    const baseline = deriveFluencyBaseline(events, 'fact:mul:7x8');
    expect(baseline!.medianMs).toBeLessThan(2000);
  });

  it('excludes untimed assessment latency from personal fluency evidence', () => {
    const events = [
      ...Array.from({ length: MIN_BASELINE_SAMPLES }, (_, i) => event({ latencyMs: 1000 + i })),
      ...Array.from({ length: MIN_BASELINE_SAMPLES }, () => event({
        latencyMs: 50_000,
        mode: 'goal_evaluation',
        gradingContext: 'untimed_assessment',
      })),
    ];
    const baseline = deriveFluencyBaseline(events, 'fact:mul:7x8');
    expect(baseline!.sampleCount).toBe(MIN_BASELINE_SAMPLES);
    expect(baseline!.medianMs).toBeLessThan(2000);
  });

  it('excludes scheduler failures and modern events with a missing applied marker', () => {
    expect(classifyFluencyEvidence(event({ schedulingEligible: true, schedulingApplied: false })).reason)
      .toBe('scheduler_not_applied');
    expect(classifyFluencyEvidence(event({ schedulingApplied: undefined })).reason)
      .toBe('scheduler_not_applied');
  });

  it('admits a legacy event only with explicit successful versioned telemetry', () => {
    const legacy = event({ schedulingApplied: undefined, schedulingTelemetry: {
      version: 1, cardKey: 'fact:mul:7x8', cardKind: 'atomic_fact', schemaId: 'fact', itemInstanceId: 'MUL_7x8',
      presentationIndex: 1, attemptNo: 1, schedulingEligible: true, schedulingApplied: true,
      evidenceKind: 'direct', supportLevel: 'independent', selection: { origin: 'manual', rationaleCodes: ['manual'] },
      rating: { reviewGrade: 'good' }, instance: { difficulty: 0.5 },
    } });
    expect(classifyLegacyFluencyEvidence(legacy).eligible).toBe(true);
  });

  it('uses the deterministic latest 50 eligible samples after shuffled sync insertion', () => {
    const events = Array.from({ length: MAX_FLUENCY_SAMPLES + 10 }, (_, index) => event({
      id: `event-${String(index).padStart(2, '0')}`, latencyMs: 1000 + index,
      createdAt: `2026-01-01T00:${String(index).padStart(2, '0')}:00.000Z`,
    }));
    const ordered = deriveFluencyBaseline(events, 'fact:mul:7x8');
    const shuffled = deriveFluencyBaseline([...events].reverse(), 'fact:mul:7x8');
    expect(shuffled).toEqual(ordered);
    expect(ordered?.sampleCount).toBe(MAX_FLUENCY_SAMPLES);
    expect(ordered?.medianMs).toBe(1034.5);
  });

  it('reports audit counts from the same classifier used by baselines', () => {
    const summary = summarizeFluencyEvidenceEligibility([
      event(), event({ schedulingApplied: false }), event({ gradingContext: 'untimed_assessment' }),
    ]);
    expect(summary).toMatchObject({ eligible: 1, scheduler_not_applied: 1, untimed_assessment: 1 });
  });
});

describe('classifyFluency', () => {
  const atomicPolicy: ResponsePolicy = { kind: 'atomic_fluency', useLatencyForFsrs: true, easyMs: 1500, hardMs: 4000 };
  const conceptualPolicy: ResponsePolicy = { kind: 'conceptual', useLatencyForFsrs: false };

  it('is always not_applicable for a policy that does not use latency', () => {
    expect(classifyFluency(50000, conceptualPolicy)).toBe('not_applicable');
    expect(classifyFluency(1, conceptualPolicy)).toBe('not_applicable');
  });

  it('falls back to policy defaults with no baseline', () => {
    expect(classifyFluency(1000, atomicPolicy)).toBe('fast');
    expect(classifyFluency(2500, atomicPolicy)).toBe('expected');
    expect(classifyFluency(5000, atomicPolicy)).toBe('slow');
  });

  it('prefers a personal baseline over policy defaults when supplied', () => {
    const baseline = { cardFamily: 'fact:mul:7x8', sampleCount: 10, medianMs: 3000, p25Ms: 2500, p75Ms: 3500 };
    // 3000ms would be "expected" under policy defaults, but is "slow" relative to this baseline's p75.
    expect(classifyFluency(3600, atomicPolicy, baseline)).toBe('slow');
    expect(classifyFluency(2000, atomicPolicy, baseline)).toBe('fast');
  });
});
