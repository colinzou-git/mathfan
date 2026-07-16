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
import { applyReview, applyRelatedEvidence, createInitialState } from '../scheduler/scheduler';
import { deriveCardKeyFromEvent } from '../scheduler/cardModel';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import {
  applyMisconceptionConfirmation,
  applyMisconceptionDetection,
  detectMistakes,
} from '../mastery/misconceptionEngine';
import { deriveMasteryFromEvents } from '../multiplication/masteryEngine';
import type { MultiplicationFactKey } from '../multiplication/types';
import { legacyClassifyByLatency } from '../practice/answerChecker';
import type { ReviewGrade } from '../../types/math';
import { compareEventsChronologically } from './eventOrdering';

export function shouldApplyEventToScheduler(event: MathAnswerEvent, scheduledBySessionCard: Set<string>): boolean {
  if (event.isRetry) return false;
  if (event.schedulingApplied === false || event.schedulingTelemetry?.schedulingApplied === false) return false;
  const explicit = event.schedulingTelemetry?.schedulingEligible ?? event.schedulingEligible;
  if (explicit === false) return false;
  const cardKey = deriveCardKeyFromEvent(event);
  if (!cardKey) return false;
  const key = `${event.sessionId}|${cardKey}`;
  if (explicit === undefined && scheduledBySessionCard.has(key)) return false;
  scheduledBySessionCard.add(key);
  return true;
}

/**
 * Derive the FSRS review grade from a stored event.
 * If reviewGrade was recorded, use it directly.
 * Otherwise, reconstruct from correctness and latency so that events written
 * before reviewGrade was added to the schema are still replayed correctly.
 */
function gradeFromEvent(event: MathAnswerEvent): ReviewGrade {
  if (event.reviewGrade) return event.reviewGrade;
  return legacyClassifyByLatency(event.isCorrect, event.latencyMs);
}

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
 * Recompute itemStates for a student from practice- and diagnostic-mode mathAnswerEvents.
 * Replays first-attempt events (isRetry=false) through applyReview in chronological order,
 * grouped by canonical card key (see features/scheduler/cardModel) rather than exact item id —
 * so e.g. MUL_7x8 and MUL_8x7 replay into one scheduled card, not two.
 * Both modes write FSRS itemState live (practice via recordPracticeAnswer, diagnostic via
 * recordDiagnosticAnswerWithRetry → recordPracticeAnswer), so both must be replayed here or
 * diagnostic-derived scheduler state is silently dropped after a sync merge/restore/repair.
 * Quiz events are excluded — they feed multFactStats, not the FSRS scheduler.
 * Retry events are skipped — they are preserved in the event log for stats/history but
 * must not affect the FSRS scheduler state, matching the live-practice behaviour in
 * usePracticeSession (which also calls applyReview only on the first attempt).
 *
 * mode: 'preserve-legacy' (default) — overwrites only cards that have events; cards without
 *   events are left untouched. Safe for sync/migration where pre-event legacy rows may exist.
 * mode: 'strict' — additionally deletes any itemStates rows for this student that have no
 *   corresponding events. Use for repair/debug/reset to bring the cache fully in sync with events.
 */
export async function rebuildItemStatesFromEvents(
  studentId: string,
  options: { mode: 'preserve-legacy' | 'strict' } = { mode: 'preserve-legacy' },
): Promise<void> {
  const events = await db.mathAnswerEvents
    .where('studentId').equals(studentId)
    .and(e => e.mode === 'practice' || e.mode === 'diagnostic' || e.mode === 'goal_evaluation')
    .toArray();

  if (events.length === 0) {
    if (options.mode === 'strict') {
      await db.itemStates.where('studentId').equals(studentId).delete();
    }
    return;
  }

  events.sort(compareEventsChronologically);

  const byCard = new Map<string, MathAnswerEvent[]>();
  for (const e of events) {
    const cardKey = deriveCardKeyFromEvent(e);
    if (!cardKey) continue; // no usable item id — can't derive a card
    const arr = byCard.get(cardKey) ?? [];
    arr.push(e);
    byCard.set(cardKey, arr);
  }

  const rebuilt = new Set<string>();
  const scheduledBySessionCard = new Set<string>();
  for (const [cardKey, cardEvents] of byCard) {
    // Reconstruct a representative item (any event's itemId) purely to seed
    // skillId/difficulty for createInitialState — all events in this group
    // share the same card, so any of them works.
    const seedItem = makeItemFromId(cardEvents[0].itemId);
    if (!seedItem) continue; // can't reconstruct item metadata — skip

    let state = createInitialState(studentId, seedItem);
    state = { ...state, cardKey };
    // Track whether the card has any DIRECT evidence. Related-evidence events
    // (indirect FSRS nudges) are reinforce-only: they apply only after a direct
    // attempt exists, and a card with nothing but related evidence is left
    // untouched — matching the live write path and preserving legacy rows.
    let sawDirect = false;
    for (const event of cardEvents) {
      if (event.relatedEvidence) {
        // Indirect nudge — FSRS-only, and only once the card has direct history.
        if (!sawDirect) continue;
        if (!shouldApplyEventToScheduler(event, scheduledBySessionCard)) continue;
        state = applyRelatedEvidence(state, new Date(event.createdAt));
        continue;
      }

      if (!shouldApplyEventToScheduler(event, scheduledBySessionCard)) continue;
      sawDirect = true;
      const eventItem = makeItemFromId(event.itemId) ?? seedItem;
      state = applyReview(
        state,
        gradeFromEvent(event),
        event.latencyMs,
        String(event.studentAnswer ?? ''),
        new Date(event.createdAt),
        { isCorrect: event.isCorrect },
      );
      state = { ...state, cardKey, lastItemId: event.itemId };

      // Live practice/diagnostic sessions merge misconception tags into itemState
      // on first wrong attempts (see usePracticeSession/DiagnosticSession). Replay
      // that derived-cache behaviour here so a rebuild doesn't drop mistakePatterns.
      if (!event.isCorrect) {
        const newTags = event.detectedMisconceptions
          ?? detectMistakes(eventItem, String(event.studentAnswer ?? ''));
        if (newTags.length > 0) {
          state = {
            ...state,
            mistakePatterns: Array.from(new Set([...(state.mistakePatterns ?? []), ...newTags])),
            misconceptionEvidence: applyMisconceptionDetection(
              state.misconceptionEvidence,
              newTags,
              { eventId: event.id, sessionId: event.sessionId, itemId: event.itemId, createdAt: event.createdAt },
              state.mistakePatterns,
            ),
          };
        }
      } else if (!event.hintUsed && !event.isRetry && event.schedulingEligible !== false) {
        const confirmation = applyMisconceptionConfirmation(
          state.misconceptionEvidence,
          eventItem,
          { eventId: event.id, sessionId: event.sessionId, itemId: event.itemId, createdAt: event.createdAt },
          state.mistakePatterns,
        );
        state = { ...state, misconceptionEvidence: confirmation.evidence };
      }
    }
    // A card reached only via related evidence has no direct state to rebuild —
    // skip it so we never fabricate a 'new' row or clobber legacy data.
    if (!sawDirect) continue;
    await db.itemStates.put(state);
    rebuilt.add(cardKey);
  }

  if (options.mode === 'strict') {
    await db.itemStates
      .where('studentId').equals(studentId)
      .and(s => !rebuilt.has(s.cardKey))
      .delete();
  }
}
