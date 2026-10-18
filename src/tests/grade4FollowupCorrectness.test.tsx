import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/dexie';
import { getCurriculumSkill } from '../features/curriculum/curriculumRegistry';
import { makeFoundationItem } from '../features/curriculum/foundationItems';
import { createGoalEvaluation, loadLatestResumableGoalEvaluation, persistNextGoalEvaluationQuestion } from '../features/goals/goalEvaluationPersistence';
import type { AdaptiveGoalEvaluationSelection } from '../features/goals/goalEvaluationEngine';
import type { GoalEvaluation } from '../features/goals/types';
import { planDailyLesson } from '../features/learningPlan/dailyLessonPlanner';
import { rankFocusSkills } from '../features/learningPlan/focusSkillSelector';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import { SkillDetailPanel } from '../features/mastery/SkillDetailPanel';
import type { StudentSkillSummary } from '../features/mastery/skillMasteryEngine';
import { planPracticeForSkill } from '../features/mastery/skillPracticePlanner';
import { planToday } from '../features/mastery/todayPlanEngine';
import { mulberry32 } from '../utils/rng';
import type { GradeLevel, PracticeItem, StudentProfile } from '../types/math';

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

function summary(skillId: string, overrides: Partial<StudentSkillSummary> = {}): StudentSkillSummary {
  return {
    skillId,
    studentId: 'student',
    status: 'new',
    attemptCount: 0,
    correctCount: 0,
    accuracy: 0,
    dueItemCount: 0,
    itemCount: 0,
    mistakePatterns: [],
    ...overrides,
  };
}

function answerEvent(item: PracticeItem, index: number, isCorrect: boolean): MathAnswerEvent {
  return {
    id: `event-${index}`,
    studentId: 'student',
    sessionId: `session-${index}`,
    itemId: item.id,
    cardKey: item.cardKey,
    schemaId: item.schemaId,
    mode: 'practice',
    promptShown: item.prompt,
    correctAnswer: item.answer,
    studentAnswer: isCorrect ? item.answer : 0,
    isCorrect,
    isRetry: false,
    hintUsed: false,
    latencyMs: 30000,
    createdAt: new Date(Date.UTC(2026, 8, 1 + index, 12)).toISOString(),
  };
}

function lessonSignature(events: MathAnswerEvent[]) {
  const skillId = 'g4-nbt-ten-times';
  const plan = planDailyLesson({
    studentId: 'student',
    gradeLevel: 4,
    now: '2026-09-20T12:00:00.000Z',
    timezone: 'America/Los_Angeles',
    settings,
    events,
    itemStates: [],
    skillSummaries: [summary(skillId, { status: 'strong', learningState: 'strong', attemptCount: 12, correctCount: 8, accuracy: 2 / 3 })],
    goals: [],
    rng: mulberry32(77),
  });
  return plan.items.map(entry => ({
    segment: entry.segment,
    cardKey: entry.cardKey,
    skillId: entry.item.skillId,
    band: entry.item.contentSpec?.domain === 'foundation' ? entry.item.contentSpec.data.band : undefined,
    form: entry.item.contentSpec?.domain === 'foundation' ? entry.item.contentSpec.data.form : undefined,
  }));
}

function evaluation(overrides: Partial<GoalEvaluation> = {}): GoalEvaluation {
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
    item: { id: 'MUL_7x8', skillId: 'mul', itemType: 'multiplication_fact', prompt: '7 × 8', answer: 56, tags: [], difficulty: 1 },
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

describe('Grade 4 follow-up correctness regressions', () => {
  beforeEach(async () => {
    if (!db.isOpen()) await db.open();
    await Promise.all([db.students.clear(), db.goalEvaluations.clear()]);
  });

  it('makes recent focus and difficulty decisions invariant to event storage order', () => {
    const skillId = 'g4-nbt-ten-times';
    const items = Array.from({ length: 12 }, (_, index) => makeFoundationItem(skillId, 'symbolic', 0, 700 + index));
    const events = items.map((item, index) => answerEvent(item, index, index >= 4));
    const reversed = [...events].reverse();
    const summaries = [summary(skillId, { status: 'strong', learningState: 'strong', attemptCount: 12, correctCount: 8, accuracy: 2 / 3 })];
    const skillGraph = [getCurriculumSkill(skillId)!];
    const rank = (history: MathAnswerEvent[]) => rankFocusSkills({
      studentId: 'student',
      now: '2026-09-20T12:00:00.000Z',
      summaries,
      goals: [],
      events: history,
      usableSkillIds: new Set([skillId]),
      skillGraph,
    })[0];

    expect(rank(reversed)).toEqual(rank(events));
    expect(lessonSignature(reversed)).toEqual(lessonSignature(events));
    expect(lessonSignature(events).some(entry => entry.band === 2)).toBe(true);
  });

  it('does not resume a Grade 3 evaluation after the learner changes to Grade 4', async () => {
    await db.students.put(profile(3));
    const createdGrade3 = await createGoalEvaluation('student', '2026-10-18T12:00:00.000Z');
    expect(createdGrade3).toMatchObject({ gradeLevel: 3, curriculumId: 'california-g3', curriculumVersion: 1 });

    await db.students.put(profile(4));
    expect(await loadLatestResumableGoalEvaluation('student')).toBeNull();
    await expect(persistNextGoalEvaluationQuestion({
      evaluationId: createdGrade3.id,
      expectedAnswerCount: 0,
      expectedSelectionRevision: 0,
      selectedAt: '2026-10-18T12:05:00.000Z',
      selection: selection(),
    })).rejects.toThrow(/curriculum/i);

    const createdGrade4 = await createGoalEvaluation('student', '2026-10-18T12:10:00.000Z');
    expect(createdGrade4).toMatchObject({ gradeLevel: 4, curriculumId: 'california-g4-foundation', curriculumVersion: 1 });
    expect((await loadLatestResumableGoalEvaluation('student'))?.id).toBe(createdGrade4.id);
  });

  it('treats legacy evaluations as Grade 3 only', async () => {
    await db.goalEvaluations.put(evaluation());
    await db.students.put(profile(4));
    expect(await loadLatestResumableGoalEvaluation('student')).toBeNull();

    await db.students.put(profile(3));
    expect((await loadLatestResumableGoalEvaluation('student'))?.id).toBe('evaluation');
  });

  it('uses mastered learning state for cross-grade prerequisites without making them focus candidates', () => {
    const grade4 = summary('g4-nbt-ten-times', { status: 'new' });
    const dueButMasteredGrade3 = summary('g3-round-nearest-10-100', {
      status: 'review_due',
      learningState: 'mastered',
      reviewState: 'due',
      dueItemCount: 1,
      attemptCount: 12,
      correctCount: 11,
      accuracy: 11 / 12,
    });
    const readyPlan = planToday({
      studentId: 'student',
      skillSummaries: [grade4],
      prerequisiteSummaries: [dueButMasteredGrade3],
      itemStates: [],
      now: new Date('2026-10-18T12:00:00.000Z'),
    });
    expect(readyPlan.focusSkillId).toBe('g4-nbt-ten-times');
    expect(readyPlan.focusPrereqAdvisory).toEqual([]);

    const weakPlan = planToday({
      studentId: 'student',
      skillSummaries: [grade4],
      prerequisiteSummaries: [{ ...dueButMasteredGrade3, learningState: 'needs_practice' }],
      itemStates: [],
      now: new Date('2026-10-18T12:00:00.000Z'),
    });
    expect(weakPlan.focusSkillId).toBe('g4-nbt-ten-times');
    expect(weakPlan.focusPrereqAdvisory?.length).toBe(1);
  });

  it('offers Quick refresh only for the actual unmet prerequisite and returns to the original skill', () => {
    const skill = getCurriculumSkill('g4-oa-factor-pairs')!;
    const onBridge = vi.fn();
    const props = {
      skill,
      onClose: vi.fn(),
      onPracticeSkill: vi.fn(),
      onReviewDue: vi.fn(),
      onBridge,
    };
    const view = render(<SkillDetailPanel
      {...props}
      unmetPrereqIds={['g3-mul-tables-advanced']}
      unmetPrereqNames={['Advanced multiplication facts']}
    />);

    fireEvent.click(screen.getByRole('button', { name: /Quick refresh/i }));
    expect(onBridge).toHaveBeenCalledTimes(1);
    const config = onBridge.mock.calls[0][0];
    const expected = planPracticeForSkill('g3-mul-tables-advanced', { sessionLength: 3 });
    const wrongFirstPrerequisite = planPracticeForSkill('g4-oa-factor-meaning', { sessionLength: 3 });
    expect(config.returnToSkillId).toBe('g4-oa-factor-pairs');
    expect(config.specificItemIds).toEqual(expected.specificItemIds?.slice(0, 3) ?? []);
    expect(config.specificItemIds).not.toEqual(wrongFirstPrerequisite.specificItemIds?.slice(0, 3) ?? []);

    view.unmount();
    render(<SkillDetailPanel {...props} unmetPrereqIds={[]} unmetPrereqNames={[]} />);
    expect(screen.queryByRole('button', { name: /Quick refresh/i })).toBeNull();
  });
});
