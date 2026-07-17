import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/dexie';
import { recordPracticeAnswer, type PracticeAnswerPayload } from '../features/learning/recordAnswer';
import { makeItemFromId } from '../features/curriculum/makeItemFromId';
import { applyReview, createInitialState } from '../features/scheduler/scheduler';

const studentId = 'practice-persistence-student';

function recoveryPayload(): PracticeAnswerPayload {
  const item = makeItemFromId('MUL_7x8')!;
  const answeredAt = '2026-07-16T08:00:01.000Z';
  const before = applyReview(
    createInitialState(studentId, item), 'again', 1000, '63',
    new Date('2026-07-16T08:00:00.000Z'), { isCorrect: false },
  );
  const after = applyReview(before, 'hard', 1000, '56', new Date(answeredAt), { isCorrect: true });
  return {
    event: {
      id: 'recovery-event', studentId, sessionId: 'practice-session', itemId: item.id,
      cardKey: 'fact:mul:7x8', presentationIndex: 1, mode: 'practice', promptShown: item.prompt,
      correctAnswer: item.answer, studentAnswer: 56, isCorrect: true, isRetry: true, hintUsed: true,
      latencyMs: 1000, reviewGrade: 'hard', ratingReason: 'supported_correct',
      schedulingEligible: true, schedulingApplied: true, schedulingKind: 'relearning_step',
      schedulingReason: 'same_presentation_relearning', relearningFromEventId: 'wrong-event', createdAt: answeredAt,
    },
    updatedState: after,
    attempt: {
      id: 'recovery-attempt', studentId, itemId: item.id, skillId: item.skillId,
      sessionId: 'practice-session', promptShown: item.prompt, correctAnswer: item.answer,
      studentAnswer: 56, isCorrect: true, latencyMs: 1000, reviewGrade: 'hard', createdAt: answeredAt,
    },
  };
}

beforeAll(async () => { if (!db.isOpen()) await db.open(); });
beforeEach(async () => { await Promise.all([db.mathAnswerEvents.clear(), db.attempts.clear(), db.itemStates.clear()]); });

describe('practice answer idempotency', () => {
  it('retries the same recovery payload without applying its state twice', async () => {
    const payload = recoveryPayload();
    await recordPracticeAnswer(payload);
    await recordPracticeAnswer(payload);
    expect(await db.mathAnswerEvents.count()).toBe(1);
    expect(await db.attempts.count()).toBe(1);
    expect((await db.itemStates.get([studentId, 'fact:mul:7x8']))?.reps).toBe(2);
  });

  it('rejects a conflicting recovery payload under the same ID', async () => {
    const payload = recoveryPayload();
    await recordPracticeAnswer(payload);
    await expect(recordPracticeAnswer({
      ...payload,
      event: { ...payload.event, relearningFromEventId: 'different-parent' },
    })).rejects.toThrow(/Conflicting canonical answer event identity/);
  });

  it('rejects an applied transition marked ineligible', async () => {
    const payload = recoveryPayload();
    await expect(recordPracticeAnswer({
      ...payload,
      event: { ...payload.event, schedulingEligible: false },
    })).rejects.toThrow('Applied scheduler transition must be eligible.');
    expect(await db.mathAnswerEvents.count()).toBe(0);
  });
});
