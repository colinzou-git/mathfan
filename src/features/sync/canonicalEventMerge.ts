import type { MathAnswerEvent } from '../learning/learningEvents';

const sortedUnique = (values?: string[]): string[] | undefined => values ? [...new Set(values)].sort() : undefined;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableValue(child)]));
}

function stableSchedulingTelemetry(event: MathAnswerEvent): unknown {
  if (!event.schedulingTelemetry) return undefined;
  return stableValue({
    ...event.schedulingTelemetry,
    selection: {
      ...event.schedulingTelemetry.selection,
      rationaleCodes: sortedUnique(event.schedulingTelemetry.selection?.rationaleCodes) ?? [],
    },
  });
}

export interface CanonicalEventFingerprint {
  id: string;
  studentId: string;
  sessionId: string;
  itemId: string;
  itemInstanceId?: string;
  cardKey?: string;
  schemaId?: string;
  mode: MathAnswerEvent['mode'];
  studentAnswer: string | number | null;
  correctAnswer: string | number;
  isCorrect: boolean;
  isRetry: boolean;
  hintUsed: boolean;
  latencyMs: number;
  reviewGrade?: MathAnswerEvent['reviewGrade'];
  ratingReason?: MathAnswerEvent['ratingReason'];
  gradingContext?: MathAnswerEvent['gradingContext'];
  responsePolicy?: MathAnswerEvent['responsePolicy'];
  fluencyBand?: MathAnswerEvent['fluencyBand'];
  presentationIndex?: number;
  schedulingEligible?: boolean;
  schedulingApplied?: boolean;
  schedulingKind?: MathAnswerEvent['schedulingKind'];
  schedulingReason?: MathAnswerEvent['schedulingReason'];
  relearningFromEventId?: string;
  schedulerErrorCode?: MathAnswerEvent['schedulerErrorCode'];
  relatedEvidence?: boolean;
  evidenceSourceItemId?: string;
  origin?: MathAnswerEvent['origin'];
  goalId?: string;
  goalTargetId?: string;
  goalIds?: string[];
  goalTargetIds?: string[];
  goalLearningKind?: MathAnswerEvent['goalLearningKind'];
  lessonPlanId?: string;
  lessonSegment?: MathAnswerEvent['lessonSegment'];
  selectionOrigin?: MathAnswerEvent['selectionOrigin'];
  selectionRationaleCodes?: string[];
  selectionPlannerVersion?: string;
  factStatusBefore?: MathAnswerEvent['factStatusBefore'];
  factStatusAfter?: MathAnswerEvent['factStatusAfter'];
  detectedMisconceptions?: string[];
  confirmedMisconceptions?: string[];
  createdAt: string;
}

export function canonicalEventFingerprintObject(event: MathAnswerEvent): CanonicalEventFingerprint {
  return {
    id: event.id, studentId: event.studentId, sessionId: event.sessionId, itemId: event.itemId,
    itemInstanceId: event.itemInstanceId, cardKey: event.cardKey, schemaId: event.schemaId, mode: event.mode,
    studentAnswer: event.studentAnswer ?? null, correctAnswer: event.correctAnswer, isCorrect: event.isCorrect,
    isRetry: event.isRetry, hintUsed: event.hintUsed, latencyMs: event.latencyMs, reviewGrade: event.reviewGrade,
    ratingReason: event.ratingReason, gradingContext: event.gradingContext, responsePolicy: event.responsePolicy,
    fluencyBand: event.fluencyBand, presentationIndex: event.presentationIndex,
    schedulingEligible: event.schedulingEligible, schedulingApplied: event.schedulingApplied,
    schedulingKind: event.schedulingKind, schedulingReason: event.schedulingReason,
    relearningFromEventId: event.relearningFromEventId, schedulerErrorCode: event.schedulerErrorCode,
    relatedEvidence: event.relatedEvidence, evidenceSourceItemId: event.evidenceSourceItemId,
    origin: event.origin, goalId: event.goalId, goalTargetId: event.goalTargetId,
    goalIds: sortedUnique(event.goalIds), goalTargetIds: sortedUnique(event.goalTargetIds), goalLearningKind: event.goalLearningKind,
    lessonPlanId: event.lessonPlanId, lessonSegment: event.lessonSegment, selectionOrigin: event.selectionOrigin,
    selectionRationaleCodes: sortedUnique(event.selectionRationaleCodes), selectionPlannerVersion: event.selectionPlannerVersion,
    factStatusBefore: event.factStatusBefore, factStatusAfter: event.factStatusAfter,
    detectedMisconceptions: sortedUnique(event.detectedMisconceptions),
    confirmedMisconceptions: sortedUnique(event.confirmedMisconceptions), createdAt: event.createdAt,
  };
}

export function canonicalEventFingerprint(event: MathAnswerEvent): string {
  return JSON.stringify(canonicalEventFingerprintObject(event));
}

export interface CanonicalEventConflictDetails {
  eventId: string;
  differingFields: string[];
  localStudentId: string;
  remoteStudentId: string;
}

export class CanonicalEventConflictError extends Error {
  readonly code = 'canonical_event_conflict';
  readonly details: CanonicalEventConflictDetails;
  constructor(details: CanonicalEventConflictDetails) {
    super(`Conflicting canonical answer event: ${details.eventId}`);
    this.name = 'CanonicalEventConflictError';
    this.details = details;
  }
}

export function differingCanonicalEventFields(a: MathAnswerEvent, b: MathAnswerEvent): string[] {
  const left = canonicalEventFingerprintObject(a);
  const right = canonicalEventFingerprintObject(b);
  const differing = (Object.keys(left) as Array<keyof CanonicalEventFingerprint>)
    .filter(key => JSON.stringify(left[key]) !== JSON.stringify(right[key]))
    .map(String);
  if (a.schedulingTelemetry !== undefined && b.schedulingTelemetry !== undefined
    && JSON.stringify(stableSchedulingTelemetry(a)) !== JSON.stringify(stableSchedulingTelemetry(b))) {
    differing.push('schedulingTelemetry');
  }
  return differing;
}

export function assertEquivalentCanonicalEvents(a: MathAnswerEvent, b: MathAnswerEvent): void {
  const differingFields = differingCanonicalEventFields(a, b);
  if (differingFields.length) throw new CanonicalEventConflictError({
    eventId: a.id,
    differingFields,
    localStudentId: a.studentId,
    remoteStudentId: b.studentId,
  });
}

function mergeDefined(preferred: MathAnswerEvent, fallback: MathAnswerEvent): MathAnswerEvent {
  const result = { ...fallback } as Record<string, unknown>;
  for (const [key, value] of Object.entries(preferred)) if (value !== undefined) result[key] = value;
  return result as unknown as MathAnswerEvent;
}

export function mergeCanonicalEvents(local: MathAnswerEvent[], remote: MathAnswerEvent[]): MathAnswerEvent[] {
  const merged = new Map<string, MathAnswerEvent>();
  for (const event of [...local, ...remote]) {
    const existing = merged.get(event.id);
    if (!existing) { merged.set(event.id, event); continue; }
    assertEquivalentCanonicalEvents(existing, event);
    merged.set(event.id, mergeDefined(existing, event));
  }
  return [...merged.values()];
}

export function assertNoConflictingCanonicalEventIds(events: MathAnswerEvent[]): void {
  mergeCanonicalEvents(events, []);
}
