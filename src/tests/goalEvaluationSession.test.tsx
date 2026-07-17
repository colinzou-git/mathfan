import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GoalEvaluationSession } from '../features/goals/GoalEvaluationSession';
import type { GoalEvaluation } from '../features/goals/types';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { StudentItemState } from '../types/math';
import { recordGoalEvaluationAnswer } from '../features/goals/goalEvaluationPersistence';
import { goalEvaluationRepo } from '../db/repositories';
import { pushLocal } from '../features/sync/driveSync';

const mockData = vi.hoisted(() => {
  const items = Array.from({ length: 30 }, (_, index) => ({
    id: `EVAL_ITEM_${index + 1}`,
    skillId: 'g3-mul-meaning',
    itemType: 'addition_fact' as const,
    prompt: `Question ${index + 1}: enter 17`,
    answer: 17,
    answerInput: 'numeric' as const,
    tags: ['evaluation'],
    difficulty: 0.3,
    cardKey: index < 2 ? 'template:shared-evaluation-card' : `template:evaluation-card-${index + 1}`,
  }));
  return {
    items,
    now: '2026-06-17T16:00:00.000Z',
    idCounter: 0,
    resumeEvaluation: null as GoalEvaluation | null,
    events: [] as MathAnswerEvent[],
    itemStates: [] as StudentItemState[],
    signedIn: false,
  };
});

vi.mock('../features/goals/goalEvaluationEngine', () => ({
  ADAPTIVE_GOAL_EVALUATION_QUESTION_COUNT: 30,
  buildAdaptiveGoalEvaluationResult: () => ({
    evidence: [],
    topGoalCandidates: [{ skillId: 'g3-mul-meaning', domain: 'multiplication', score: 1, mean: 0.5, uncertainty: 0.2, reason: 'strengthen' }],
    strengths: [{ skillId: 'g3-add-within-1000', domain: 'addition_subtraction', score: 0.5, mean: 0.85, uncertainty: 0.1, reason: 'confirm' }],
    skillsToStrengthen: [{ skillId: 'g3-mul-meaning', domain: 'multiplication', score: 1, mean: 0.5, uncertainty: 0.2, reason: 'strengthen' }],
    skillsReadyToLearnNext: [],
  }),
  selectNextAdaptiveGoalEvaluationItem: (args: { responses: unknown[]; scheduledCardKeys?: string[] }) => {
    const item = mockData.items[args.responses.length];
    if (!item) return null;
    const schedulingEligible = !args.scheduledCardKeys?.includes(item.cardKey);
    return {
      questionNumber: args.responses.length + 1,
      phase: args.responses.length < 10 ? 'screening' : args.responses.length < 24 ? 'adaptive_probe' : 'confirmation',
      item,
      skillId: 'g3-mul-meaning',
      domain: 'multiplication',
      evidence: [],
      topCandidates: [],
      rationale: 'test',
      cardKey: item.cardKey,
      schedulingEligible,
      schedulingReason: schedulingEligible ? 'first_card_evidence' : 'same_evaluation_template_repeat',
    };
  },
}));

vi.mock('../features/goals/goalEvaluationPersistence', () => ({
  loadLatestResumableGoalEvaluation: vi.fn(async () => mockData.resumeEvaluation),
  createGoalEvaluation: vi.fn(async (studentId: string, now: string) => ({
    id: 'eval-new',
    studentId,
    status: 'in_progress',
    source: 'evaluation',
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    seed: 123,
    currentQuestionIndex: 0,
    plannedQuestionCount: 30,
    itemIds: [],
    targetSkillIds: [],
    answers: [],
    answerEvents: [],
    scheduledCardKeys: [],
  })),
  recordGoalEvaluationAnswer: vi.fn(async () => undefined),
}));

vi.mock('../db/repositories', () => ({
  itemStateRepo: {
    getForStudent: vi.fn(async () => mockData.itemStates),
    get: vi.fn(async () => undefined),
  },
  mathAnswerEventRepo: {
    getAll: vi.fn(async () => mockData.events),
  },
  goalEvaluationRepo: {
    cancel: vi.fn(async () => undefined),
  },
}));

vi.mock('../features/time/clock', () => ({
  appNow: () => new Date(mockData.now),
}));

vi.mock('../utils/id', () => ({
  generateId: () => `id-${++mockData.idCounter}`,
}));

vi.mock('../features/auth/googleAuth', () => ({
  currentState: () => ({ signedIn: mockData.signedIn }),
}));

vi.mock('../features/sync/driveSync', () => ({
  pushLocal: vi.fn(async () => ({ ok: true })),
}));

function evaluation(overrides: Partial<GoalEvaluation> = {}): GoalEvaluation {
  return {
    id: 'eval-existing',
    studentId: 'student-1',
    status: 'in_progress',
    source: 'evaluation',
    createdAt: mockData.now,
    updatedAt: mockData.now,
    startedAt: mockData.now,
    seed: 123,
    currentQuestionIndex: 0,
    plannedQuestionCount: 30,
    itemIds: [],
    targetSkillIds: [],
    answers: [],
    answerEvents: [],
    scheduledCardKeys: [],
    ...overrides,
  };
}

function renderEvaluation(props: Partial<Parameters<typeof GoalEvaluationSession>[0]> = {}) {
  const callbacks = {
    onCancel: vi.fn(),
    onReturnToGoals: vi.fn(),
    onSelectGoalSkills: vi.fn(),
    onGoToDailyReview: vi.fn(),
    ...props,
  };
  render(
    <GoalEvaluationSession
      studentId="student-1"
      onCancel={callbacks.onCancel}
      onReturnToGoals={callbacks.onReturnToGoals}
      onSelectGoalSkills={callbacks.onSelectGoalSkills}
      onGoToDailyReview={callbacks.onGoToDailyReview}
    />,
  );
  return callbacks;
}

async function startEvaluation() {
  fireEvent.click(await screen.findByRole('button', { name: /^start$/i }));
  expect(await screen.findByText(/Question 1: enter 17/i)).toBeInTheDocument();
}

async function answerCurrent(value = '17') {
  await waitFor(() => expect(screen.getAllByRole('button', { name: /check/i }).length).toBeGreaterThan(0));
  for (const digit of value) {
    fireEvent.click(await screen.findByRole('button', { name: digit }));
  }
  const checks = await screen.findAllByRole('button', { name: /check/i });
  fireEvent.click(checks.at(-1)!);
}

beforeEach(() => {
  mockData.idCounter = 0;
  mockData.resumeEvaluation = null;
  mockData.events = [];
  mockData.itemStates = [];
  mockData.signedIn = false;
  vi.clearAllMocks();
  vi.mocked(recordGoalEvaluationAnswer).mockResolvedValue(undefined as never);
});

afterEach(() => {
  cleanup();
});

describe('untimed grading', () => {
  it('persists evaluation latency without using it to strengthen or weaken the review grade', async () => {
    renderEvaluation();
    await startEvaluation();
    await answerCurrent();
    await waitFor(() => expect(recordGoalEvaluationAnswer).toHaveBeenCalledTimes(1));

    const write = vi.mocked(recordGoalEvaluationAnswer).mock.calls[0][0];
    expect(write.event.latencyMs).toBeGreaterThan(0);
    expect(write.event).toMatchObject({
      reviewGrade: 'good',
      ratingReason: 'untimed_assessment_correct',
      gradingContext: 'untimed_assessment',
    });
    expect(write.event.schedulingTelemetry?.rating).toMatchObject({
      reviewGrade: 'good',
      ratingReason: 'untimed_assessment_correct',
      gradingContext: 'untimed_assessment',
      fluencyBaselineSource: 'not_applicable',
    });
  });
});

describe('GoalEvaluationSession', () => {
  it('starts and cancels with confirmation', async () => {
    const callbacks = renderEvaluation();
    await startEvaluation();

    fireEvent.click(screen.getByRole('button', { name: /cancel evaluation/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /cancel evaluation/i }).at(-1)!);

    await waitFor(() => expect(goalEvaluationRepo.cancel).toHaveBeenCalledWith('eval-new', mockData.now));
    expect(callbacks.onCancel).toHaveBeenCalledTimes(1);
  });

  it('records one canonical answer and blocks duplicate submissions during feedback', async () => {
    renderEvaluation();
    await startEvaluation();
    await answerCurrent();

    await waitFor(() => expect(recordGoalEvaluationAnswer).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: /check/i })).not.toBeInTheDocument();

    const [{ event, attempt, updatedState, evaluation: saved }] = vi.mocked(recordGoalEvaluationAnswer).mock.calls[0];
    expect(event.mode).toBe('goal_evaluation');
    expect(event.isRetry).toBe(false);
    expect(event.hintUsed).toBe(false);
    expect(event.relatedEvidence).toBeUndefined();
    expect(event.schedulingEligible).toBe(true);
    expect(event.schedulingReason).toBe('first_card_evidence');
    expect(attempt.id).toBeDefined();
    expect(updatedState?.attemptCount).toBe(1);
    expect(saved.answers).toHaveLength(1);
    expect(saved.scheduledCardKeys).toEqual(['template:shared-evaluation-card']);
  });

  it('records repeated template evidence without applying a second scheduler update', async () => {
    renderEvaluation();
    await startEvaluation();
    await answerCurrent();
    await waitFor(() => expect(recordGoalEvaluationAnswer).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: /continue/i }));
    await answerCurrent();
    await waitFor(() => expect(recordGoalEvaluationAnswer).toHaveBeenCalledTimes(2));

    const first = vi.mocked(recordGoalEvaluationAnswer).mock.calls[0][0];
    const second = vi.mocked(recordGoalEvaluationAnswer).mock.calls[1][0];
    expect(first.updatedState).toBeDefined();
    expect(second.updatedState).toBeUndefined();
    expect(second.event).toMatchObject({
      schedulingEligible: false,
      schedulingReason: 'same_evaluation_template_repeat',
    });
    expect(second.event.schedulingTelemetry).toMatchObject({
      schedulingEligible: false,
      schedulingReason: 'same_evaluation_template_repeat',
    });
    expect(second.evaluation.answers).toHaveLength(2);
    expect(second.evaluation.scheduledCardKeys).toEqual(['template:shared-evaluation-card']);
  });

  it('does not show hints, retries, or the correct answer after a wrong answer', async () => {
    renderEvaluation();
    await startEvaluation();
    await answerCurrent('16');

    expect(await screen.findByText(/Nice try. Keep going./i)).toBeInTheDocument();
    expect(screen.queryByText(/hint/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/try again/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/answer is 17/i)).not.toBeInTheDocument();
  });

  it('keeps slow correct answers correct instead of grading them again', async () => {
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(6000);

    renderEvaluation();
    await startEvaluation();
    await answerCurrent();

    await waitFor(() => expect(recordGoalEvaluationAnswer).toHaveBeenCalledTimes(1));
    const [{ event }] = vi.mocked(recordGoalEvaluationAnswer).mock.calls[0];
    expect(event.isCorrect).toBe(true);
    expect(event.reviewGrade).not.toBe('again');
  });

  it('save failure blocks advance and retry uses the same event identity', async () => {
    vi.mocked(recordGoalEvaluationAnswer)
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockResolvedValueOnce(undefined as never);

    renderEvaluation();
    await startEvaluation();
    await answerCurrent();

    expect(await screen.findByRole('alert')).toHaveTextContent(/db unavailable/i);
    expect(screen.getByText(/Question 1: enter 17/i)).toBeInTheDocument();
    const firstEventId = vi.mocked(recordGoalEvaluationAnswer).mock.calls[0][0].event.id;

    fireEvent.click(screen.getByRole('button', { name: /retry save/i }));
    await waitFor(() => expect(recordGoalEvaluationAnswer).toHaveBeenCalledTimes(2));
    expect(vi.mocked(recordGoalEvaluationAnswer).mock.calls[1][0].event.id).toBe(firstEventId);
  });

  it('resumes at the correct next question and does not offer resume for completed evaluations', async () => {
    mockData.resumeEvaluation = evaluation({
      currentQuestionIndex: 1,
      itemIds: ['EVAL_ITEM_1'],
      answers: [{
        eventId: 'event-1',
        attemptId: 'attempt-1',
        itemId: 'EVAL_ITEM_1',
        skillId: 'g3-mul-meaning',
        answeredAt: mockData.now,
        isCorrect: true,
        studentAnswer: 17,
        latencyMs: 1000,
        reviewGrade: 'good',
      }],
      scheduledCardKeys: ['template:shared-evaluation-card'],
    });

    renderEvaluation();
    fireEvent.click(await screen.findByRole('button', { name: /resume question 2/i }));

    expect(await screen.findByText(/Question 2: enter 17/i)).toBeInTheDocument();

    cleanup();
    mockData.resumeEvaluation = null;
    renderEvaluation();
    expect(await screen.findByRole('button', { name: /^start$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('completes exactly 30 questions, separates result sections, and can go to Daily Review', async () => {
    mockData.itemStates = [{
      studentId: 'student-1',
      cardKey: 'fact:mul:2x3',
      lastItemId: 'MUL_2x3',
      skillId: 'g3-mul-meaning',
      attemptCount: 3,
      correctCount: 1,
      lastCorrect: false,
      lastLatencyMs: 3000,
      medianLatencyMs: 3000,
      ease: 2.5,
      stabilityDays: 0,
      difficulty: 0.2,
      masteryLevel: 'learning',
      nextDueAt: '2026-06-16T00:00:00.000Z',
      mistakePatterns: [],
    }];
    mockData.signedIn = true;
    const callbacks = renderEvaluation();
    await startEvaluation();

    for (let i = 0; i < 30; i++) {
      await answerCurrent();
      await waitFor(() => expect(recordGoalEvaluationAnswer).toHaveBeenCalledTimes(i + 1));
      if (i < 29) {
        fireEvent.click(await screen.findByRole('button', { name: /continue/i }));
        await waitFor(() => expect(screen.getAllByRole('button', { name: /check/i }).length).toBeGreaterThan(0));
      }
    }

    expect(await screen.findByText(/Evaluation Results/i)).toBeInTheDocument();
    expect(screen.getByText(/Strengths/i)).toBeInTheDocument();
    expect(screen.getByText(/New or Unfinished Learning for Goals/i)).toBeInTheDocument();
    expect(screen.getByText(/Review in Daily Review/i)).toBeInTheDocument();
    expect(screen.getByText(/Scheduled practice will appear under Daily Review/i)).toBeInTheDocument();
    expect(screen.getAllByText(/learning units?/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/evidence questions?/i).length).toBeGreaterThan(0);
    expect(pushLocal).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /go to daily review/i }));
    expect(callbacks.onGoToDailyReview).toHaveBeenCalledTimes(1);
  }, 20000);

  it('selects a new-learning recommendation without creating a goal', async () => {
    const callbacks = renderEvaluation();
    await startEvaluation();

    for (let i = 0; i < 30; i++) {
      await answerCurrent();
      await waitFor(() => expect(recordGoalEvaluationAnswer).toHaveBeenCalledTimes(i + 1));
      if (i < 29) {
        fireEvent.click(await screen.findByRole('button', { name: /continue/i }));
        await waitFor(() => expect(screen.getAllByRole('button', { name: /check/i }).length).toBeGreaterThan(0));
      }
    }

    fireEvent.click(await screen.findByRole('button', { name: /continue to add goal review/i }));
    expect(callbacks.onSelectGoalSkills).toHaveBeenCalledWith(['g3-mul-meaning']);
  }, 20000);
});
