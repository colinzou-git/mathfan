import { itemStateRepo, mathAnswerEventRepo, sessionRepo } from '../../db/repositories';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { deriveCardKey } from '../scheduler/cardModel';
import { applyRelatedEvidence, RELATED_EVIDENCE_GRADE } from '../scheduler/scheduler';
import { buildSchedulingTelemetry } from '../learning/schedulingTelemetry';
import { recordRelatedEvidenceWrites, type RelatedEvidenceWrite } from '../learning/recordAnswer';
import { computeRelatedEvidence, relatedEvidenceEventId } from './relatedEvidence';

/** Rebuild retryable derived work from durable direct events; no in-memory ledger is required. */
export async function reconstructPendingRelatedEvidence(studentId: string, sessionId: string): Promise<RelatedEvidenceWrite[]> {
  const [events, states] = await Promise.all([
    mathAnswerEventRepo.getForSession(sessionId),
    itemStateRepo.getForStudent(studentId),
  ]);
  const stateMap = new Map(states.map(state => [state.cardKey, state]));
  const directCards = new Set(events.filter(event => !event.relatedEvidence && event.schedulingApplied).flatMap(event => {
    if (event.cardKey) return [event.cardKey];
    const item = makeItemFromId(event.itemId);
    return item ? [deriveCardKey(item)] : [];
  }));
  const relatedCards = new Set(events.filter(event => event.relatedEvidence && event.schedulingApplied).map(event => event.cardKey).filter((key): key is string => Boolean(key)));
  const candidates = new Map<string, { relatedItemId: string; sourceItemId: string; createdAt: string }>();
  for (const event of [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (event.relatedEvidence || !event.isCorrect || event.isRetry || event.hintUsed || event.schedulingEligible === false) continue;
    const sourceItem = makeItemFromId(event.itemId);
    if (!sourceItem) continue;
    for (const related of computeRelatedEvidence(sourceItem, stateMap, new Date(event.createdAt))) {
      if (directCards.has(related.cardKey) || relatedCards.has(related.cardKey) || candidates.has(related.cardKey)) continue;
      candidates.set(related.cardKey, { relatedItemId: related.relatedItemId, sourceItemId: event.itemId, createdAt: event.createdAt });
    }
  }
  const writes: RelatedEvidenceWrite[] = [];
  for (const [cardKey, candidate] of candidates) {
    const before = stateMap.get(cardKey);
    const item = makeItemFromId(candidate.relatedItemId);
    if (!before || !item) continue;
    const now = new Date(candidate.createdAt);
    const after = applyRelatedEvidence(before, now);
    writes.push({ state: after, event: {
      id: relatedEvidenceEventId(sessionId, cardKey), studentId, sessionId, itemId: candidate.relatedItemId,
      cardKey, mode: 'practice', promptShown: item.prompt, correctAnswer: item.answer, studentAnswer: null,
      isCorrect: true, isRetry: false, hintUsed: false, latencyMs: 0, reviewGrade: RELATED_EVIDENCE_GRADE,
      factStatusBefore: before.masteryLevel, factStatusAfter: after.masteryLevel, relatedEvidence: true,
      evidenceSourceItemId: candidate.sourceItemId, schedulingEligible: true, schedulingApplied: true,
      selectionOrigin: 'related_evidence', selectionRationaleCodes: ['reconstructed_single_related_evidence'],
      lessonRationale: 'Retry of one deferred indirect nudge when no direct review occurred.',
      schedulingTelemetry: buildSchedulingTelemetry({
        item, stateBefore: before, stateAfter: after,
        response: { reviewGrade: RELATED_EVIDENCE_GRADE, hintUsed: false, isRetry: false, evidenceKind: 'related', schedulingEligible: true, schedulingApplied: true },
        selection: { origin: 'related_evidence', rationaleCodes: ['reconstructed_single_related_evidence'] },
        presentationIndex: 1, attemptNo: 1, now,
      }), createdAt: candidate.createdAt,
    } });
  }
  return writes;
}

/** Repairs only recent sessions explicitly marked pending/error. Repeated calls are idempotent. */
export async function retryRecentRelatedEvidenceRepairs(studentId: string): Promise<void> {
  const sessions = await sessionRepo.getRecent(studentId, 10);
  for (const session of sessions.filter(value => value.relatedEvidenceStatus === 'pending' || value.relatedEvidenceStatus === 'error')) {
    try {
      const writes = await reconstructPendingRelatedEvidence(studentId, session.id);
      if (writes.length) await recordRelatedEvidenceWrites(writes);
      await sessionRepo.save({ ...session, relatedEvidenceStatus: 'complete', relatedEvidenceError: undefined, relatedEvidenceLastAttemptAt: new Date().toISOString() });
    } catch (error) {
      await sessionRepo.save({ ...session, relatedEvidenceStatus: 'error', relatedEvidenceError: error instanceof Error ? error.message : 'Schedule repair failed.', relatedEvidenceLastAttemptAt: new Date().toISOString() }).catch(() => undefined);
    }
  }
}
