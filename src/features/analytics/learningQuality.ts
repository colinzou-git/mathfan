import type { MathAnswerEvent } from '../learning/learningEvents';
import { auditEventLog } from '../learning/eventValidation';

export interface LearningQualityReport {
  directFirstAttemptAccuracy: number | null;
  supportedCorrectionRate: number | null;
  distinctInstancesByTemplate: Record<string, number>;
  representationDiversity: number;
  sameSessionRepeatCount: number;
  focusToTransfer: { focusCorrect: number; transferCorrect: number };
  selectionDistribution: Record<string, number>;
  dataQualityWarningCount: number;
}

export function buildLearningQualityReport(events: MathAnswerEvent[]): LearningQualityReport {
  const direct = events.filter(e => e.schedulingTelemetry?.evidenceKind === 'direct' && e.schedulingTelemetry.attemptNo === 1);
  const supported = events.filter(e => e.schedulingTelemetry?.supportLevel !== 'independent' && e.schedulingTelemetry?.evidenceKind === 'direct');
  const templates: Record<string, Set<string>> = {};
  const selections: Record<string, number> = {};
  const representations = new Set<string>();
  for (const event of events) {
    const t = event.schedulingTelemetry; if (!t) continue;
    (templates[t.schemaId] ??= new Set()).add(t.itemInstanceId);
    selections[t.selection.origin] = (selections[t.selection.origin] ?? 0) + 1;
    if (t.instance.representationId || t.instance.visualKind) representations.add(t.instance.representationId ?? t.instance.visualKind!);
  }
  const ratio = (set: MathAnswerEvent[]) => set.length ? set.filter(e => e.isCorrect).length / set.length : null;
  return {
    directFirstAttemptAccuracy: ratio(direct), supportedCorrectionRate: ratio(supported),
    distinctInstancesByTemplate: Object.fromEntries(Object.entries(templates).map(([k, v]) => [k, v.size])),
    representationDiversity: representations.size,
    sameSessionRepeatCount: events.filter(e => e.ratingReason === 'same_session_repeat').length,
    focusToTransfer: { focusCorrect: direct.filter(e => e.lessonSegment === 'focus' && e.isCorrect).length, transferCorrect: direct.filter(e => e.lessonSegment === 'transfer' && e.isCorrect).length },
    selectionDistribution: selections, dataQualityWarningCount: auditEventLog(events).issues.length,
  };
}
