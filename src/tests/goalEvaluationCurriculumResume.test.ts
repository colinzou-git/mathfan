import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/dexie';
import {
  createGoalEvaluation,
  loadLatestResumableGoalEvaluation,
  persistNextGoalEvaluationQuestion,
} from '../features/goals/goalEvaluationPersistence';
import type { AdaptiveGoalEvaluationSelection } from '../features/goals/goalEvaluationEngine';
import type { GoalEvaluation } from '../features/goals/types';
import type { GradeLevel, StudentProfile } from '../types/math';

const settings = {
  audioEnabled: false,
  speechRate: 1,
  dailyGoalMinutes: 12,
  sessionLength: 10 as const,
  autoAdvance: false,
  theme: 'indigo' as const,
  allowTimedMode: false,
  competitionModeEnabled: false,
  parentModeEnabled: false,
};

function profile(gradeLevel: GradeLevel): StudentProfile {
  return {
    id: 'student',
    displayName: 'Student',
    gradeLevel,
    timezone: 'America/Los_Angeles',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-10-18T12:00:00.000Z',
    settings,
  };
}

function legacyEvaluation(overrides: Partial<GoalEvaluation> = {}): GoalEvaluation {
  return {
    id: 'evaluation',
    studentId: 'student',
    status: 'in_progress',
    source: 'evaluation',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    currentQuestionIndex: 0,
    plannedQuestionCount: 30,
    itemIds: [],
    targetSkillIds: [],
    answers: [],
    selectionRevision: 0,
    ...overrides,
  };
}

function selection(): AdaptiveGoalEvaluationSelection {
  return {
    questionNumber: 1,
    phase: 'screening',
    item: {
      id: 'MUL_7x8',
      skillId: 'mul',
      itemType: 'multiplication_fact',
      prompt: '7 × 8',
      answer: 56,
      tags: [],
      difficulty: 1,
    },
    skillId: 'mul',
    domain: 'multiplication',
    evidence: [],
    topCandidates: [],
    rationale: 'stable rationale',
    cardKey: 'fact:mul:7x8',
    schedulingEligible: true,
    schedulingReason: 'first_card_evidence',
  };
}

describe('Goal evaluation curriculum resume compatibility', () => {
  beforeEach(async () => {
    if (!db.isOpen()) await db.open();
    await Promise.all([db.students.clear(), db.goalEvaluations.clear()]);
  });

  it('does not resume or extend a Grade 3 evaluation after the learner changes to Grade 4', async () => {
    await db.students.put(profile(3));
    const grade3 = await createGoalEvaluation('student', '2026-10-18T12:00:00.000Z');
    expect(grade3).toMatchObject({
      gradeLevel: 3,
      curriculumId: 'california-g3',
      curriculumVersion: 1,
    });

    await db.students.put(profile(4));
    expect(await loadLatestResumableGoalEvaluation('student')).toBeNull();
    await expect(persistNextGoalEvaluationQuestion({
      evaluationId: grade3.id,
      expectedAnswerCount: 0,
      expectedSelectionRevision: 0,
      selectedAt: '2026-10-18T12:05:00.000Z',
      selection: selection(),
    })).rejects.toThrow(/curriculum/i);

    const grade4 = await createGoalEvaluation('student', '2026-10-18T12:10:00.000Z');
    expect(grade4).toMatchObject({
      gradeLevel: 4,
      curriculumId: 'california-g4-foundation',
      curriculumVersion: 1,
    });
    expect((await loadLatestResumableGoalEvaluation('student'))?.id).toBe(grade4.id);
  });

  it('does not resume a Grade 4 evaluation after the learner changes back to Grade 3', async () => {
    await db.students.put(profile(4));
    const grade4 = await createGoalEvaluation('student', '2026-10-18T12:00:00.000Z');

    await db.students.put(profile(3));
    expect(await loadLatestResumableGoalEvaluation('student')).toBeNull();
    await expect(persistNextGoalEvaluationQuestion({
      evaluationId: grade4.id,
      expectedAnswerCount: 0,
      expectedSelectionRevision: 0,
      selectedAt: '2026-10-18T12:05:00.000Z',
      selection: selection(),
    })).rejects.toThrow(/curriculum/i);
  });

  it('keeps metadata-free legacy evaluations resumable for Grade 3 only', async () => {
    await db.goalEvaluations.put(legacyEvaluation());

    await db.students.put(profile(4));
    expect(await loadLatestResumableGoalEvaluation('student')).toBeNull();

    await db.students.put(profile(3));
    expect((await loadLatestResumableGoalEvaluation('student'))?.id).toBe('evaluation');
  });
});
