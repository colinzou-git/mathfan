import { describe, expect, it } from 'vitest';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import { auditEventLog, validateAnswerEvent } from '../features/learning/eventValidation';
import { buildSchedulingTelemetry, snapshotSchedulingState, telemetryForItem } from '../features/learning/schedulingTelemetry';
import { buildSchedulingCalibrationReport } from '../features/analytics/schedulingCalibration';
import { buildLearningQualityReport } from '../features/analytics/learningQuality';
import type { PracticeItem, StudentItemState } from '../types/math';

const item: PracticeItem = { id: 'MUL_3x4', skillId: 'mul', itemType: 'multiplication_fact', prompt: '3 × 4', answer: 12, choices: [12, 7], tags: [], difficulty: .2, factA: 3, factB: 4 };
const before: StudentItemState = { studentId: 's', cardKey: 'fact:mul:3x4', skillId: 'mul', attemptCount: 2, correctCount: 1, lastCorrect: true, lastLatencyMs: 1000, medianLatencyMs: 1000, ease: 2.5, stabilityDays: 4, difficulty: .2, fsrsDifficulty: 5, reps: 2, lapses: 0, masteryLevel: 'learning', lastSeenAt: '2026-01-01T00:00:00.000Z', nextDueAt: '2026-01-05T00:00:00.000Z', mistakePatterns: [] };
const after = { ...before, stabilityDays: 8, reps: 3, lastSeenAt: '2026-01-06T00:00:00.000Z', nextDueAt: '2026-01-14T00:00:00.000Z' };

function event(id: string, retrievability = .7): MathAnswerEvent {
  const telemetry = buildSchedulingTelemetry({ item, stateBefore: before, stateAfter: after,
    response: { reviewGrade: 'good', hintUsed: false, isRetry: false, schedulingEligible: true },
    selection: { origin: 'due_retrieval', rationaleCodes: ['overdue'] }, presentationIndex: 1, attemptNo: 1, now: new Date('2026-01-06T00:00:00Z') });
  telemetry.before!.retrievability = retrievability;
  return { id, studentId: 's', sessionId: id, itemId: item.id, mode: 'practice', promptShown: item.prompt, correctAnswer: 12, studentAnswer: 12, isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 1000, createdAt: `2026-01-06T00:00:0${id.length}Z`, schedulingTelemetry: telemetry };
}

describe('scheduling telemetry', () => {
  it('captures immutable before and after state around a review', () => {
    const telemetry = event('a').schedulingTelemetry!;
    expect(telemetry.before?.stabilityDays).toBe(4);
    expect(telemetry.after?.stabilityDays).toBe(8);
    expect(telemetry.selection.rationaleCodes).toEqual(['overdue']);
    expect(telemetry.instance.displayedChoices).toEqual([12, 7]);
  });

  it('serializes bounded structured item parameters', () => {
    expect(telemetryForItem({ ...item, arithmeticSpec: { operation: 'addition', a: 38, b: 27, mode: 'compute', structure: { operation: 'addition', digits: 2, regrouping: 'ones_only', columnActions: [{ place: 'ones', action: 'compose' }] } } }).parameters).toMatchObject({ a: 38, b: 27 });
  });

  it('keeps legacy events valid and catches invalid retry and duplicate scheduling evidence', () => {
    const legacy = { ...event('legacy'), schedulingTelemetry: undefined };
    expect(validateAnswerEvent(legacy)).toEqual([]);
    const retry = event('retry'); retry.isRetry = true; retry.schedulingTelemetry!.attemptNo = 2;
    expect(validateAnswerEvent(retry).map(issue => issue.code)).toContain('scheduling_eligible_retry');
    const duplicate = { ...event('b'), sessionId: 'a' };
    expect(auditEventLog([event('a'), duplicate]).issues.map(issue => issue.code)).toContain('repeated_session_schedule');
  });

  it('builds calibrated buckets and excludes retries, related, and repeated evidence', () => {
    const included = Array.from({ length: 5 }, (_, index) => event(`e${index}`, .7));
    const retry = event('retry', .7); retry.isRetry = true; retry.schedulingTelemetry!.attemptNo = 2;
    const report = buildSchedulingCalibrationReport([...included, retry]);
    expect(report.overall.find(bucket => bucket.predictedRange[0] === .6)).toMatchObject({ observationCount: 5, predictedMean: .7, observedAccuracy: 1, sufficientData: true });
    expect(report.excludedCounts.retry).toBe(1);
  });

  it('reports separate learning-quality dimensions', () => {
    const report = buildLearningQualityReport([event('a')]);
    expect(report.directFirstAttemptAccuracy).toBe(1);
    expect(report.selectionDistribution.due_retrieval).toBe(1);
  });

  it('computes elapsed and overdue days without mutating state', () => {
    expect(snapshotSchedulingState(before, new Date('2026-01-06T00:00:00Z'))).toMatchObject({ elapsedDays: 5, overdueDays: 1 });
    expect(before.stabilityDays).toBe(4);
  });

  it('keeps a realistic multi-year telemetry history bounded', () => {
    const history = Array.from({ length: 10_000 }, (_, index) => event(`history-${index}`, .7));
    expect(JSON.stringify(history).length).toBeLessThan(20_000_000);
    expect(buildSchedulingCalibrationReport(history).overall).toHaveLength(5);
  });
});
