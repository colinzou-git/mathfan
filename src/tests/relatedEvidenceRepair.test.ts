import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getForSession: vi.fn(), getForStudent: vi.fn(), getRecent: vi.fn(), sessionSave: vi.fn(), recordWrites: vi.fn(),
}));
vi.mock('../db/repositories', () => ({
  mathAnswerEventRepo: { getForSession: mocks.getForSession },
  itemStateRepo: { getForStudent: mocks.getForStudent },
  sessionRepo: { getRecent: mocks.getRecent, save: mocks.sessionSave },
}));
vi.mock('../features/learning/recordAnswer', () => ({ recordRelatedEvidenceWrites: mocks.recordWrites }));

import { reconstructPendingRelatedEvidence, retryRecentRelatedEvidenceRepairs } from '../features/adaptive/relatedEvidenceRepair';
import type { MathAnswerEvent } from '../features/learning/learningEvents';

const factState = {
  studentId: 'student-1', cardKey: 'fact:mul:3x4', lastItemId: 'MUL_3x4', skillId: 'mul',
  attemptCount: 3, correctCount: 2, lastCorrect: true, lastLatencyMs: 1000, medianLatencyMs: 1000,
  ease: 2.5, stabilityDays: 2, difficulty: .2, reps: 2, lapses: 0, masteryLevel: 'learning' as const,
  mistakePatterns: [], lastSeenAt: '2026-05-01T00:00:00Z', nextDueAt: '2026-05-02T00:00:00Z',
};
const parent: MathAnswerEvent = {
  id: 'parent-1', studentId: 'student-1', sessionId: 'session-1', itemId: 'AREA_RECT_3x4', mode: 'practice',
  promptShown: 'area', correctAnswer: 12, studentAnswer: 12, isCorrect: true, isRetry: false, hintUsed: false,
  latencyMs: 1000, schedulingEligible: true, schedulingApplied: true, createdAt: '2026-06-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getForStudent.mockResolvedValue([factState]);
  mocks.getForSession.mockResolvedValue([parent]);
  mocks.recordWrites.mockResolvedValue(undefined);
  mocks.sessionSave.mockResolvedValue(undefined);
});

describe('related evidence repair', () => {
  it('reconstructs one stable related event from durable qualifying parent events', async () => {
    mocks.getForSession.mockResolvedValue([parent, { ...parent, id: 'parent-2' }, { ...parent, id: 'hinted', hintUsed: true }]);
    const writes = await reconstructPendingRelatedEvidence('student-1', 'session-1');
    expect(writes).toHaveLength(1);
    expect(writes[0].event).toMatchObject({
      id: 'related:session-1:fact%3Amul%3A3x4', cardKey: 'fact:mul:3x4', relatedEvidence: true,
      evidenceSourceItemId: 'AREA_RECT_3x4', schedulingApplied: true,
    });
  });

  it('suppresses reconstruction when direct or existing related evidence already applied', async () => {
    const direct = { ...parent, id: 'direct', itemId: 'MUL_4x3', cardKey: 'fact:mul:3x4' };
    mocks.getForSession.mockResolvedValue([parent, direct]);
    expect(await reconstructPendingRelatedEvidence('student-1', 'session-1')).toEqual([]);
    mocks.getForSession.mockResolvedValue([parent, { ...parent, id: 'related', relatedEvidence: true, cardKey: 'fact:mul:3x4' }]);
    expect(await reconstructPendingRelatedEvidence('student-1', 'session-1')).toEqual([]);
  });

  it('repairs only recent failed sessions and marks them complete', async () => {
    mocks.getRecent.mockResolvedValue([
      { id: 'session-1', studentId: 'student-1', relatedEvidenceStatus: 'error' },
      { id: 'complete-session', studentId: 'student-1', relatedEvidenceStatus: 'complete' },
    ]);
    await retryRecentRelatedEvidenceRepairs('student-1');
    expect(mocks.recordWrites).toHaveBeenCalledOnce();
    expect(mocks.sessionSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'session-1', relatedEvidenceStatus: 'complete' }));
  });
});
