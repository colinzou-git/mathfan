/**
 * Rebuild derived cache tables from the canonical mathAnswerEvents log.
 *
 * These functions are used:
 *   - After a sync merge (to recompute from the union of events from multiple devices)
 *   - To verify or repair data consistency
 *
 * They only overwrite records for items/facts that have events — items without events
 * are left untouched so pre-event legacy data is preserved.
 */
import { db } from '../../db/dexie';
import type { MathAnswerEvent } from './learningEvents';
import { applyReview, createInitialState } from '../scheduler/scheduler';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { deriveMasteryFromEvents } from '../multiplication/masteryEngine';
import type { MultiplicationFactKey } from '../multiplication/types';

/**
 * Recompute multFactStats for a student from quiz-mode mathAnswerEvents.
 * Overwrites only facts that have at least one event.
 * Only first-attempt events (isRetry=false) are fed into the mastery score.
 */
export async function rebuildMultFactStatsFromEvents(studentId: string): Promise<void> {
  const events = await db.mathAnswerEvents
    .where('studentId').equals(studentId)
    .and(e => e.mode === 'quiz')
    .toArray();

  if (events.length === 0) return;

  const byFact = new Map<MultiplicationFactKey, MathAnswerEvent[]>();
  for (const e of events) {
    if (!e.itemId.startsWith('MUL_')) continue;
    const key = e.itemId.slice(4) as MultiplicationFactKey;
    const arr = byFact.get(key) ?? [];
    arr.push(e);
    byFact.set(key, arr);
  }

  for (const [key, factEvents] of byFact) {
    const stats = deriveMasteryFromEvents(studentId, key, factEvents);
    await db.multFactStats.put(stats);
  }
}

/**
 * Recompute itemStates for a student from practice-mode mathAnswerEvents.
 * Replays all practice events (including retries) through applyReview in chronological order.
 * Overwrites only items that have at least one event — items without events are left untouched.
 */
export async function rebuildItemStatesFromEvents(studentId: string): Promise<void> {
  const events = await db.mathAnswerEvents
    .where('studentId').equals(studentId)
    .and(e => e.mode === 'practice')
    .toArray();

  if (events.length === 0) return;

  events.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const byItem = new Map<string, MathAnswerEvent[]>();
  for (const e of events) {
    const arr = byItem.get(e.itemId) ?? [];
    arr.push(e);
    byItem.set(e.itemId, arr);
  }

  for (const [itemId, itemEvents] of byItem) {
    const item = makeItemFromId(itemId);
    if (!item) continue; // can't reconstruct item metadata — skip

    let state = createInitialState(studentId, item);
    for (const event of itemEvents) {
      state = applyReview(
        state,
        event.reviewGrade ?? 'good',
        event.latencyMs,
        String(event.studentAnswer ?? ''),
        new Date(event.createdAt),
      );
    }
    await db.itemStates.put(state);
  }
}
