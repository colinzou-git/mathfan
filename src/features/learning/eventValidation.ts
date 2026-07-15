import type { MathAnswerEvent } from './learningEvents';

export interface EventValidationIssue { code: string; severity: 'warning' | 'error'; eventId?: string; message: string }
export interface EventLogAudit { issues: EventValidationIssue[]; eventCount: number; errorCount: number; warningCount: number }

export function validateAnswerEvent(event: MathAnswerEvent): EventValidationIssue[] {
  const issues: EventValidationIssue[] = [];
  const add = (code: string, severity: 'warning' | 'error', message: string) => issues.push({ code, severity, eventId: event.id, message });
  const t = event.schedulingTelemetry;
  if (!t) return issues;
  if (!t.cardKey) add('missing_card_key', 'error', 'Versioned telemetry is missing its card key.');
  if (event.isRetry && t.schedulingEligible) add('scheduling_eligible_retry', 'error', 'A retry cannot update long-term scheduling.');
  if (event.relatedEvidence && t.evidenceKind === 'direct') add('related_marked_direct', 'error', 'Related evidence is marked as a direct answer.');
  if (t.after && !t.before) add('after_without_before', 'error', 'After-state exists without a before-state.');
  for (const [label, state] of [['before', t.before], ['after', t.after]] as const) {
    if (!state) continue;
    if (!Number.isFinite(state.stabilityDays) || state.stabilityDays < 0) add('invalid_stability', 'error', `${label} stability is invalid.`);
    if (state.fsrsDifficulty !== undefined && (state.fsrsDifficulty < 1 || state.fsrsDifficulty > 10)) add('invalid_difficulty', 'error', `${label} difficulty is outside 1–10.`);
    if (state.dueAt && state.lastSeenAt && new Date(state.dueAt).getTime() < new Date(state.lastSeenAt).getTime() && (state.scheduledDays ?? 0) > 0) add('invalid_chronology', 'warning', 'Due time precedes last-seen time.');
  }
  return issues;
}

export function auditEventLog(events: MathAnswerEvent[]): EventLogAudit {
  const issues = events.flatMap(validateAnswerEvent);
  const ids = new Set<string>();
  const writes = new Map<string, string>();
  const scheduled = new Set<string>();
  for (const event of events) {
    if (ids.has(event.id)) issues.push({ code: 'duplicate_id', severity: 'error', eventId: event.id, message: 'Duplicate event ID.' });
    ids.add(event.id);
    const signature = [event.studentId, event.sessionId, event.itemId, event.studentAnswer, event.createdAt].join('|');
    if (writes.has(signature)) issues.push({ code: 'near_duplicate_write', severity: 'warning', eventId: event.id, message: `Near-identical write duplicates ${writes.get(signature)}.` });
    else writes.set(signature, event.id);
    const t = event.schedulingTelemetry;
    if (t?.schedulingEligible) {
      const key = `${event.sessionId}|${t.cardKey}`;
      if (scheduled.has(key)) issues.push({ code: 'repeated_session_schedule', severity: 'error', eventId: event.id, message: 'Card scheduled more than once in a session.' });
      scheduled.add(key);
    }
  }
  return { issues, eventCount: events.length, errorCount: issues.filter(i => i.severity === 'error').length, warningCount: issues.filter(i => i.severity === 'warning').length };
}
