import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GoalsPage } from '../features/goals/GoalsPage';
import { StudentDashboard } from '../features/dashboard/StudentDashboard';
import type { GoalEvent, GoalSkillTarget, LearningGoal } from '../features/goals/types';
import type { MathAnswerEvent } from '../features/learning/learningEvents';
import type { StudentItemState, StudentProfile } from '../types/math';
import {
  itemStateRepo,
  mathAnswerEventRepo,
  sessionRepo,
} from '../db/repositories';

const fixedNow = '2026-06-17T16:00:00.000Z';

vi.mock('../features/time/clock', () => ({
  appNow: () => new Date(fixedNow),
}));

const store: {
  goals: LearningGoal[];
  events: MathAnswerEvent[];
  itemStates: StudentItemState[];
  goalEvents: GoalEvent[];
  rejectList: boolean;
  pendingList: Promise<LearningGoal[]> | null;
} = {
  goals: [],
  events: [],
  itemStates: [],
  goalEvents: [],
  rejectList: false,
  pendingList: null,
};

vi.mock('../db/repositories', () => ({
  learningGoalRepo: {
    list: vi.fn(async () => {
      if (store.pendingList) return store.pendingList;
      if (store.rejectList) throw new Error('db unavailable');
      return [...store.goals];
    }),
    create: vi.fn(async (goal: LearningGoal) => {
      store.goals.push(goal);
    }),
    update: vi.fn(async (id: string, changes: Partial<LearningGoal>, at: string) => {
      const index = store.goals.findIndex(goal => goal.id === id);
      if (index < 0) return undefined;
      store.goals[index] = { ...store.goals[index], ...changes, updatedAt: at };
      return store.goals[index];
    }),
  },
  goalEventRepo: {
    append: vi.fn(async (event: GoalEvent) => {
      store.goalEvents.push(event);
    }),
    getForStudent: vi.fn(async () => [...store.goalEvents]),
  },
  mathAnswerEventRepo: {
    getAll: vi.fn(async () => [...store.events]),
    getForDateRange: vi.fn(async () => []),
  },
  itemStateRepo: {
    getForStudent: vi.fn(async () => [...store.itemStates]),
  },
  sessionRepo: {
    getAll: vi.fn(async () => []),
  },
}));

function profile(): StudentProfile {
  return {
    id: 'student-1',
    displayName: 'Alex',
    gradeLevel: 3,
    timezone: 'America/Los_Angeles',
    createdAt: '2026-01-01T00:00:00.000Z',
    settings: {
      audioEnabled: false,
      speechRate: 1,
      dailyGoalMinutes: 10,
      sessionLength: 10,
      autoAdvance: true,
      theme: 'indigo',
      allowTimedMode: false,
      competitionModeEnabled: false,
      parentModeEnabled: false,
    },
  };
}

function target(overrides: Partial<GoalSkillTarget> = {}): GoalSkillTarget {
  return {
    id: 'target-1',
    skillId: 'g3-mul-meaning',
    reason: 'needs_evaluation',
    baseline: {
      capturedAt: '2026-06-17T15:00:00.000Z',
      status: 'new',
      attemptCount: 0,
      distinctItemCount: 0,
      recentAccuracy: 0,
      dueItemCount: 0,
      mistakePatterns: [],
      hintRate: 0,
    },
    targetAccuracy: 0.8,
    minFirstAttempts: 10,
    minDistinctItems: 4,
    minActiveDays: 2,
    maxHintRate: 0,
    misconceptionTargets: [],
    weight: 1,
    ...overrides,
  };
}

function goal(overrides: Partial<LearningGoal> = {}): LearningGoal {
  return {
    id: 'goal-1',
    studentId: 'student-1',
    title: 'Meaning of Multiplication',
    source: 'manual',
    status: 'active',
    durationDays: 7,
    startDate: '2026-06-17',
    targetDate: '2026-06-23',
    targets: [target()],
    createdAt: '2026-06-17T15:00:00.000Z',
    updatedAt: '2026-06-17T15:00:00.000Z',
    ...overrides,
  };
}

function renderGoals(onStartEvaluation = vi.fn()) {
  render(
    <GoalsPage
      profile={profile()}
      onBack={() => {}}
      onStartEvaluation={onStartEvaluation}
    />,
  );
  return onStartEvaluation;
}

async function openWizardToStep(step: 1 | 2 | 3) {
  fireEvent.click(await screen.findByRole('button', { name: /add goal/i }));
  if (step >= 2) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  if (step >= 3) {
    const card = screen.getAllByRole('button').find(button => /total .*day/i.test(button.textContent ?? ''));
    expect(card).toBeDefined();
    fireEvent.click(card!);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  }
}

beforeEach(() => {
  store.goals = [];
  store.events = [];
  store.itemStates = [];
  store.goalEvents = [];
  store.rejectList = false;
  store.pendingList = null;
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('dashboard Goals entry', () => {
  it('appears directly after the Grade 3 Math Map card and opens Goals', async () => {
    vi.mocked(mathAnswerEventRepo.getAll).mockResolvedValue([]);
    vi.mocked(itemStateRepo.getForStudent).mockResolvedValue([]);
    vi.mocked(sessionRepo.getAll).mockResolvedValue([]);
    const onOpenGoals = vi.fn();

    render(
      <StudentDashboard
        profile={profile()}
        onStartDailyReview={() => {}}
        onPickOperation={() => {}}
        onOpenStats={() => {}}
        onOpenSettings={() => {}}
        onStartQuiz={() => {}}
        onOpenAchievementDetail={() => {}}
        onOpenMasteryMap={() => {}}
        onOpenGoals={onOpenGoals}
      />,
    );

    const mapCard = await screen.findByText(/Grade 3 Math Map/i);
    const goalsCard = screen.getByRole('button', { name: /Goals/i });
    expect(mapCard.closest('button')?.nextElementSibling).toBe(goalsCard.closest('button'));

    fireEvent.click(goalsCard);
    expect(onOpenGoals).toHaveBeenCalledTimes(1);
  });
});

describe('GoalsPage', () => {
  it('shows loading, empty sections, and the evaluation callback', async () => {
    const evaluation = renderGoals();
    expect(screen.getByText(/Loading goals/i)).toBeInTheDocument();

    expect(await screen.findByText(/No active goals yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No paused goals/i)).toBeInTheDocument();
    expect(screen.getByText(/No goal history yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /evaluation/i }));
    expect(evaluation).toHaveBeenCalledTimes(1);
  });

  it('shows a persistence error state', async () => {
    store.rejectList = true;
    renderGoals();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i);
    expect(screen.getByText(/db unavailable/i)).toBeInTheDocument();
  });

  it('defaults duration to 7 days and supports 1 and 30 days', async () => {
    renderGoals();
    await openWizardToStep(1);

    const input = screen.getByRole('spinbutton', { name: /goal duration/i });
    expect(input).toHaveValue(7);

    fireEvent.click(screen.getByRole('button', { name: /^1 day$/i }));
    expect(input).toHaveValue(1);
    expect(screen.getByText(/Target date 2026-06-17/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^30 days$/i }));
    expect(input).toHaveValue(30);
    expect(screen.getByText(/Target date 2026-07-16/i)).toBeInTheDocument();
  });

  it('renders real recommendation cards and browse-all skills', async () => {
    renderGoals();
    await openWizardToStep(2);

    expect(screen.getByText(/Recommendations/i)).toBeInTheDocument();
    expect(screen.getAllByText(/total/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /browse all skills/i }));
    expect(screen.getByText(/Choose up to/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Meaning of Multiplication/i)).toBeInTheDocument();
  });

  it('creates multiple goals from recommendations', async () => {
    renderGoals();

    await openWizardToStep(3);
    fireEvent.click(screen.getByRole('button', { name: /save goal/i }));
    await waitFor(() => expect(store.goals).toHaveLength(1));

    await openWizardToStep(3);
    fireEvent.click(screen.getByRole('button', { name: /save goal/i }));
    await waitFor(() => expect(store.goals).toHaveLength(2));
    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('edits a goal without replacing an unchanged target baseline', async () => {
    const originalTarget = target({ id: 'keep-target' });
    store.goals = [goal({ targets: [originalTarget] })];
    renderGoals();

    fireEvent.click(await screen.findByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const title = screen.getByLabelText(/goal title/i);
    fireEvent.change(title, { target: { value: 'Updated multiplication goal' } });
    fireEvent.click(screen.getByRole('button', { name: /save goal/i }));

    await waitFor(() => expect(store.goals[0].title).toBe('Updated multiplication goal'));
    expect(store.goals[0].targets[0].baseline).toEqual(originalTarget.baseline);
  });

  it('pauses, resumes, ends, cancels, and keeps history', async () => {
    store.goals = [goal(), goal({ id: 'goal-2', title: 'Second goal' })];
    renderGoals();

    fireEvent.click(await screen.findAllByRole('button', { name: /pause/i }).then(buttons => buttons[0]));
    await waitFor(() => expect(store.goals[0].status).toBe('paused'));

    fireEvent.click(await screen.findByRole('button', { name: /resume/i }));
    await waitFor(() => expect(store.goals[0].status).toBe('active'));

    fireEvent.click((await screen.findAllByRole('button', { name: /^end$/i }))[0]);
    fireEvent.click(screen.getByRole('button', { name: /end goal/i }));
    await waitFor(() => expect(store.goals.some(item => item.status === 'ended')).toBe(true));

    fireEvent.click((await screen.findAllByRole('button', { name: /^cancel$/i }))[0]);
    fireEvent.click(screen.getByRole('button', { name: /cancel goal/i }));
    await waitFor(() => expect(store.goals.some(item => item.status === 'cancelled')).toBe(true));

    await waitFor(() => expect(screen.getAllByText(/Final evidence/i).length).toBeGreaterThan(0));
    expect(screen.getByText(/Second goal/i)).toBeInTheDocument();
  });
});
