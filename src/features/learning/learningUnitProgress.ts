import type { PracticeItem, StudentItemState } from '../../types/math';
import type { MathAnswerEvent } from './learningEvents';
import { compareEventsChronologically } from './eventOrdering';
import { describeLearningCard, deriveCardKeyFromEvent } from '../scheduler/cardModel';

export interface LearningUnitProgress {
  cardKey: string;
  schemaId: string;
  kind: 'atomic_fact' | 'template';
  directInstanceCount: number;
  distinctInstanceCount: number;
  representationIds: string[];
  delayedSuccessCount: number;
  status: 'new' | 'introduced' | 'learning' | 'maintenance';
}

export interface LearningUnitEvidenceRequirements {
  distinctInstances: number;
  representations: number;
  sessions: number;
  delayedSuccesses: number;
}

const DEFAULT_TEMPLATE_REQUIREMENTS: LearningUnitEvidenceRequirements = {
  distinctInstances: 3,
  representations: 1,
  sessions: 2,
  delayedSuccesses: 1,
};

export function learningUnitEvidenceRequirements(schemaId: string, kind: LearningUnitProgress['kind']): LearningUnitEvidenceRequirements {
  if (kind === 'atomic_fact') return { distinctInstances: 1, representations: 1, sessions: 1, delayedSuccesses: 0 };
  if (schemaId.includes('fraction') || schemaId.includes('compare_')) {
    return { distinctInstances: 3, representations: 2, sessions: 2, delayedSuccesses: 1 };
  }
  return DEFAULT_TEMPLATE_REQUIREMENTS;
}

function direct(event: MathAnswerEvent): boolean {
  return !event.isRetry && event.relatedEvidence !== true && event.schedulingKind !== 'relearning_step';
}

function representationId(event: MathAnswerEvent): string | undefined {
  return event.schedulingTelemetry?.instance.representationId
    ?? event.schedulingTelemetry?.instance.visualKind
    ?? event.schemaId;
}

export function deriveLearningUnitProgress(args: {
  items: PracticeItem[];
  events: MathAnswerEvent[];
  states: StudentItemState[];
}): Map<string, LearningUnitProgress> {
  const descriptors = new Map(args.items.map(item => {
    const descriptor = describeLearningCard(item);
    return [descriptor.cardKey, descriptor] as const;
  }));
  const eventsByCard = new Map<string, MathAnswerEvent[]>();
  for (const event of args.events.filter(direct)) {
    const cardKey = deriveCardKeyFromEvent(event);
    if (!cardKey) continue;
    const list = eventsByCard.get(cardKey) ?? [];
    list.push(event);
    eventsByCard.set(cardKey, list);
  }
  const statesByCard = new Map(args.states.map(state => [state.cardKey, state]));
  const cardKeys = new Set([...descriptors.keys(), ...eventsByCard.keys(), ...statesByCard.keys()]);
  const result = new Map<string, LearningUnitProgress>();

  for (const cardKey of cardKeys) {
    const descriptor = descriptors.get(cardKey);
    const state = statesByCard.get(cardKey);
    const events = (eventsByCard.get(cardKey) ?? []).sort(compareEventsChronologically);
    const kind = descriptor?.kind ?? (cardKey.startsWith('fact:') ? 'atomic_fact' : 'template');
    const schemaId = descriptor?.schemaId ?? events.at(-1)?.schemaId ?? cardKey;
    const instances = new Set(events.map(event => event.itemInstanceId ?? event.itemId));
    if (state?.lastItemId) instances.add(state.lastItemId);
    const representations = new Set(events.map(representationId).filter((value): value is string => Boolean(value)));
    if (representations.size === 0 && descriptor?.schemaId) representations.add(descriptor.schemaId);
    const sessions = new Set(events.map(event => event.sessionId));
    const firstSession = events[0]?.sessionId;
    const delayedSuccessCount = events.filter(event => event.isCorrect && event.sessionId !== firstSession).length;
    const directInstanceCount = Math.max(events.length, state?.attemptCount ?? 0);
    const requirements = learningUnitEvidenceRequirements(schemaId, kind);
    const maintenanceEvidence = instances.size >= requirements.distinctInstances
      && representations.size >= requirements.representations
      && sessions.size >= requirements.sessions
      && delayedSuccessCount >= requirements.delayedSuccesses;
    const strongState = state?.masteryLevel === 'strong' || state?.masteryLevel === 'mastered';
    const status: LearningUnitProgress['status'] = directInstanceCount === 0
      ? 'new'
      : strongState && maintenanceEvidence
        ? 'maintenance'
        : directInstanceCount === 1
          ? 'introduced'
          : 'learning';
    result.set(cardKey, {
      cardKey,
      schemaId,
      kind,
      directInstanceCount,
      distinctInstanceCount: instances.size,
      representationIds: [...representations].sort(),
      delayedSuccessCount,
      status,
    });
  }
  return result;
}

export function remainingLearningUnitEvidence(progress: LearningUnitProgress): number {
  if (progress.status === 'maintenance') return 0;
  const requirements = learningUnitEvidenceRequirements(progress.schemaId, progress.kind);
  return Math.max(1, requirements.distinctInstances - progress.distinctInstanceCount);
}
