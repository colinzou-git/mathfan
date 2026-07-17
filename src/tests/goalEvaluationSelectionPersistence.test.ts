import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/dexie';
import { loadLatestResumableGoalEvaluation, persistNextGoalEvaluationQuestion } from '../features/goals/goalEvaluationPersistence';
import type { AdaptiveGoalEvaluationSelection } from '../features/goals/goalEvaluationEngine';
import type { GoalEvaluation } from '../features/goals/types';

const evaluation = (): GoalEvaluation => ({
  id: 'evaluation', studentId: 'student', status: 'in_progress', source: 'evaluation', createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z', currentQuestionIndex: 0, plannedQuestionCount: 30, itemIds: [],
  targetSkillIds: [], answers: [], selectionRevision: 0,
});

const selection = (id = 'MUL_7x8'): AdaptiveGoalEvaluationSelection => ({
  questionNumber: 1, phase: 'screening', item: { id, skillId: 'mul', itemType: 'multiplication_fact', prompt: '7x8', answer: 56, tags: [], difficulty: 1 },
  skillId: 'mul', domain: 'multiplication', evidence: [], topCandidates: [], rationale: 'stable rationale',
  cardKey: id === 'MUL_6x9' ? 'fact:mul:6x9' : 'fact:mul:7x8', schedulingEligible: true, schedulingReason: 'first_card_evidence',
});

beforeEach(async () => { await db.goalEvaluations.clear(); await db.goalEvaluations.put(evaluation()); });

describe('persistNextGoalEvaluationQuestion', () => {
  it('persists one versioned selection and increments its revision', async () => {
    const saved = await persistNextGoalEvaluationQuestion({ evaluationId: 'evaluation', expectedAnswerCount: 0,
      expectedSelectionRevision: 0, selectedAt: '2026-01-02T00:00:00Z', selection: selection() });
    expect(saved.selectionRevision).toBe(1);
    expect(saved.currentSelection).toMatchObject({ version: 1, questionIndex: 0, selectedAt: '2026-01-02T00:00:00Z',
      item: { id: 'MUL_7x8' }, rationale: 'stable rationale' });
  });

  it('returns the first committed question before stale CAS checks', async () => {
    const first = await persistNextGoalEvaluationQuestion({ evaluationId: 'evaluation', expectedAnswerCount: 0,
      expectedSelectionRevision: 0, selectedAt: '2026-01-02T00:00:00Z', selection: selection() });
    const second = await persistNextGoalEvaluationQuestion({ evaluationId: 'evaluation', expectedAnswerCount: 99,
      expectedSelectionRevision: 99, selectedAt: '2026-01-03T00:00:00Z', selection: selection('MUL_6x9') });
    expect(second).toEqual(first);
  });

  it('increments selectionRevision monotonically for later questions', async () => {
    const first = await persistNextGoalEvaluationQuestion({ evaluationId: 'evaluation', expectedAnswerCount: 0,
      expectedSelectionRevision: 0, selectedAt: '2026-01-02T00:00:00Z', selection: selection() });
    await db.goalEvaluations.put({ ...first, currentSelection: undefined, currentQuestionIndex: 1,
      answers: [{ eventId: 'event', itemId: 'MUL_7x8', answeredAt: '2026-01-02T00:01:00Z', isCorrect: true }] });
    const second = await persistNextGoalEvaluationQuestion({ evaluationId: 'evaluation', expectedAnswerCount: 1,
      expectedSelectionRevision: 1, selectedAt: '2026-01-03T00:00:00Z', selection: selection('MUL_6x9') });
    expect(second.selectionRevision).toBe(2);
    expect(second.currentSelection?.questionIndex).toBe(1);
  });

  it('discards incomplete legacy pending fields on local load', async () => {
    await db.goalEvaluations.put({ ...evaluation(), currentItemId: 'MUL_7x8', currentItem: selection().item } as GoalEvaluation);
    const loaded = await loadLatestResumableGoalEvaluation('student');
    expect(loaded?.currentSelection).toBeUndefined();
    expect(loaded).not.toHaveProperty('currentItem');
    expect(loaded).not.toHaveProperty('currentItemId');
  });
});
