import type { MasteryLevel, PracticeItem, ReviewGrade, StudentItemState } from '../../types/math';
import type { FluencyBand } from '../fluency/fluencyEngine';
import type { RatingReason } from '../practice/answerChecker';
import type { ResponsePolicyKind } from '../scheduler/responsePolicy';
import { describeLearningCard } from '../scheduler/cardModel';
import { currentRetrievability } from '../scheduler/fsrsAdapter';

export const SCHEDULING_TELEMETRY_VERSION = 1 as const;
export const CARD_MODEL_VERSION = 'canonical-card-v1';
export const RESPONSE_POLICY_VERSION = 'task-aware-v1';
export const ADAPTIVE_SELECTOR_VERSION = 'adaptive-selector-v1';
export const DAILY_LESSON_PLANNER_VERSION = 'daily-lesson-v1';
export const GOAL_PORTFOLIO_VERSION = 'goal-portfolio-v1';

export type SelectionOrigin = 'due_retrieval' | 'weak_skill' | 'new_learning' | 'focus_skill'
  | 'transfer' | 'goal' | 'diagnostic' | 'manual' | 'quiz' | 'related_evidence';

export interface SelectionContext {
  origin: SelectionOrigin;
  plannerVersion?: string;
  rationaleCodes: string[];
  priorityScore?: number;
  lessonPlanId?: string;
  lessonSegment?: 'retrieval' | 'focus' | 'transfer';
}

export interface SchedulingStateSnapshot {
  dueAt?: string;
  lastSeenAt?: string;
  stabilityDays: number;
  fsrsDifficulty?: number;
  reps?: number;
  lapses?: number;
  masteryLevel: MasteryLevel;
  scheduledDays?: number;
  elapsedDays?: number;
  overdueDays?: number;
  retrievability?: number;
}

type ParameterValue = string | number | boolean | string[] | number[];
export interface ItemInstanceTelemetry {
  promptVersion?: string;
  displayedChoices?: Array<string | number>;
  visualKind?: string;
  representationId?: string;
  difficulty: number;
  parameters?: Record<string, ParameterValue>;
}

export interface SchedulingTelemetry {
  version: 1;
  learnerKey?: string;
  cardKey: string;
  cardKind: 'atomic_fact' | 'template';
  schemaId: string;
  itemInstanceId: string;
  presentationIndex: number;
  attemptNo: number;
  schedulingEligible: boolean;
  schedulingReason?: 'first_card_evidence' | 'same_evaluation_template_repeat';
  evidenceKind: 'direct' | 'related';
  supportLevel: 'independent' | 'hint' | 'worked_example' | 'retry';
  selection: SelectionContext;
  before?: SchedulingStateSnapshot;
  after?: SchedulingStateSnapshot;
  rating: { reviewGrade: ReviewGrade; ratingReason?: RatingReason; responsePolicy?: ResponsePolicyKind; fluencyBand?: FluencyBand };
  instance: ItemInstanceTelemetry;
}

export interface ResponseTelemetryEvidence {
  reviewGrade: ReviewGrade;
  ratingReason?: RatingReason;
  responsePolicy?: ResponsePolicyKind;
  fluencyBand?: FluencyBand;
  hintUsed: boolean;
  isRetry: boolean;
  evidenceKind?: 'direct' | 'related';
  schedulingEligible: boolean;
}

export function snapshotSchedulingState(state: StudentItemState, now: Date): SchedulingStateSnapshot {
  const elapsedDays = state.lastSeenAt ? Math.max(0, Math.floor((now.getTime() - new Date(state.lastSeenAt).getTime()) / 86_400_000)) : undefined;
  const overdueDays = state.nextDueAt ? Math.max(0, Math.floor((now.getTime() - new Date(state.nextDueAt).getTime()) / 86_400_000)) : undefined;
  return {
    dueAt: state.nextDueAt, lastSeenAt: state.lastSeenAt, stabilityDays: state.stabilityDays,
    fsrsDifficulty: state.fsrsDifficulty, reps: state.reps, lapses: state.lapses,
    masteryLevel: state.masteryLevel, scheduledDays: state.fsrsScheduledDays, elapsedDays, overdueDays,
    retrievability: currentRetrievability(state, now) ?? undefined,
  };
}

function flattenParameters(value: unknown, prefix = '', out: Record<string, ParameterValue> = {}): Record<string, ParameterValue> {
  if (!value || typeof value !== 'object') return out;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof nested === 'string' || typeof nested === 'number' || typeof nested === 'boolean') out[name] = nested;
    else if (Array.isArray(nested) && nested.length <= 40 && nested.every(v => typeof v === 'string' || typeof v === 'number')) out[name] = nested as string[] | number[];
    else if (nested && typeof nested === 'object') flattenParameters(nested, name, out);
  }
  return out;
}

export function telemetryForItem(item: PracticeItem): ItemInstanceTelemetry {
  const structured = item.fractionSpec ?? item.arithmeticSpec ?? item.divisionSpec ?? item.measurementSpec
    ?? item.wordProblemSpec ?? item.reasoningSpec ?? item.visualSpec;
  const parameters = structured ? flattenParameters(structured) : undefined;
  return {
    promptVersion: 'curriculum-v1', displayedChoices: item.choices ? [...item.choices] : undefined,
    visualKind: item.visualSpec?.kind ?? item.visualModelType, representationId: item.schemaId,
    difficulty: item.difficulty, parameters: parameters && Object.keys(parameters).length ? parameters : undefined,
  };
}

export function buildSchedulingTelemetry(args: {
  item: PracticeItem; stateBefore?: StudentItemState; stateAfter?: StudentItemState;
  response: ResponseTelemetryEvidence; selection: SelectionContext;
  presentationIndex: number; attemptNo: number; now: Date; learnerKey?: string;
  schedulingReason?: SchedulingTelemetry['schedulingReason'];
}): SchedulingTelemetry {
  const card = describeLearningCard(args.item);
  return {
    version: SCHEDULING_TELEMETRY_VERSION, learnerKey: args.learnerKey, cardKey: card.cardKey,
    cardKind: card.kind, schemaId: card.schemaId, itemInstanceId: args.item.instanceKey ?? args.item.id,
    presentationIndex: args.presentationIndex, attemptNo: args.attemptNo,
    schedulingEligible: args.response.schedulingEligible, schedulingReason: args.schedulingReason,
    evidenceKind: args.response.evidenceKind ?? 'direct',
    supportLevel: args.response.isRetry ? 'retry' : args.response.hintUsed ? 'hint' : 'independent',
    selection: args.selection, before: args.stateBefore ? snapshotSchedulingState(args.stateBefore, args.now) : undefined,
    after: args.stateAfter ? snapshotSchedulingState(args.stateAfter, args.now) : undefined,
    rating: { reviewGrade: args.response.reviewGrade, ratingReason: args.response.ratingReason,
      responsePolicy: args.response.responsePolicy, fluencyBand: args.response.fluencyBand },
    instance: telemetryForItem(args.item),
  };
}
