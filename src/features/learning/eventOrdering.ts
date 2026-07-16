import type { MathAnswerEvent } from './learningEvents';

export function validEventTimeMs(event: MathAnswerEvent): number | null {
  const value = Date.parse(event.createdAt);
  return Number.isFinite(value) ? value : null;
}

/** Valid timestamps sort oldest→newest; invalid timestamps sort last by stable event ID. */
export function compareEventsChronologically(a: MathAnswerEvent, b: MathAnswerEvent): number {
  const aTime = validEventTimeMs(a);
  const bTime = validEventTimeMs(b);
  if (aTime === null && bTime === null) return a.id.localeCompare(b.id);
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  return aTime - bTime || a.id.localeCompare(b.id);
}

export function chronologicalEvents(events: readonly MathAnswerEvent[]): MathAnswerEvent[] {
  return events.filter(event => validEventTimeMs(event) !== null).slice().sort(compareEventsChronologically);
}
