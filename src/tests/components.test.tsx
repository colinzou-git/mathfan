import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { TutorChat } from '../features/ai/TutorChat';
import { SessionSummary } from '../components/SessionSummary';
import { NumPad } from '../components/NumPad';
import { SkillDetailPanel } from '../features/mastery/SkillDetailPanel';
import { ParentNextActionCard } from '../features/mastery/ParentNextActionCard';
import { Grade3MasteryMapPage } from '../features/mastery/Grade3MasteryMapPage';
import { mathAnswerEventRepo, itemStateRepo } from '../db/repositories';
import type { MasterySkillNode } from '../features/mastery/grade3MasteryMap';
import type { TodayPlan } from '../features/mastery/todayPlanEngine';
import type { SessionConfig, StudentProfile } from '../types/math';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TutorChat', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

  it('renders the not-configured state when no AI key is set', () => {
    render(
      <TutorChat
        context={{ prompt: '7 × 8', answer: 56, itemType: 'multiplication_fact' }}
        onClose={() => {}}
        onOpenSettings={() => {}}
      />
    );
    expect(screen.getByText(/isn't set up/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open settings/i })).toBeInTheDocument();
  });
});

describe('SessionSummary', () => {
  it('shows first-try accuracy (not completion %) and a missed-facts list', () => {
    render(
      <SessionSummary
        completedCount={10}
        correctCount={10}
        firstTryCount={7}
        correctedCount={2}
        repeatedCount={1}
        slowFirstTryCount={1}
        attemptCount={14}
        latencies={[1200, 1500]}
        fastestMs={1200}
        missedFacts={['7 × 8', '6 × 9']}
        onDone={() => {}}
      />
    );
    expect(screen.getByText(/Session Complete/i)).toBeInTheDocument();
    // 7 of 10 solved on the first try → 70%, even though all 10 were eventually correct.
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText(/Practice these next time/i)).toBeInTheDocument();
    expect(screen.getByText('7 × 8')).toBeInTheDocument();
  });
});

describe('NumPad', () => {
  it('shows a decimal key only when allowDecimal is set', () => {
    const { rerender } = render(<NumPad value="" onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Decimal point' })).toBeNull();
    rerender(<NumPad value="" onChange={() => {}} onSubmit={() => {}} allowDecimal />);
    expect(screen.getByRole('button', { name: 'Decimal point' })).toBeInTheDocument();
  });
});

// ── SkillDetailPanel ─────────────────────────────────────────────────────────

const testSkill: MasterySkillNode = {
  id: 'g3-mul-tables-basic',
  domain: 'multiplication',
  title: 'Times Tables 1–5',
  description: 'Fluently multiply within 25.',
  prerequisites: [],
  californiaStandardIds: ['3.OA.C.7'],
};

describe('SkillDetailPanel', () => {
  it('calls onPracticeSkill with the skill ID when Practice button is clicked', () => {
    const onPracticeSkill = vi.fn();
    render(
      <SkillDetailPanel
        skill={testSkill}
        onClose={() => {}}
        onPracticeSkill={onPracticeSkill}
        onReviewDue={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /practice this skill/i }));
    expect(onPracticeSkill).toHaveBeenCalledWith('g3-mul-tables-basic');
  });

  it('does not show the Review button when there are no due items', () => {
    render(
      <SkillDetailPanel
        skill={testSkill}
        summary={{ skillId: 'g3-mul-tables-basic', studentId: 's1', status: 'needs_practice', attemptCount: 5, correctCount: 3, accuracy: 0.6, dueItemCount: 0, itemCount: 5, mistakePatterns: [] }}
        onClose={() => {}}
        onPracticeSkill={() => {}}
        onReviewDue={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: /review due/i })).toBeNull();
  });

  it('calls onReviewDue with the skill ID when Review button is clicked', () => {
    const onReviewDue = vi.fn();
    render(
      <SkillDetailPanel
        skill={testSkill}
        summary={{ skillId: 'g3-mul-tables-basic', studentId: 's1', status: 'review_due', attemptCount: 10, correctCount: 9, accuracy: 0.9, dueItemCount: 3, itemCount: 10, mistakePatterns: [] }}
        onClose={() => {}}
        onPracticeSkill={() => {}}
        onReviewDue={onReviewDue}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /review due/i }));
    expect(onReviewDue).toHaveBeenCalledWith('g3-mul-tables-basic');
  });
});

// ── ParentNextActionCard ──────────────────────────────────────────────────────

const focusConfig: SessionConfig = { mode: 'multiplication', sessionLength: 10 };
const reviewConfig: SessionConfig = { mode: 'daily_review', sessionLength: 5 };

describe('ParentNextActionCard', () => {
  it('calls onStartPractice with focus config when focus button is clicked', () => {
    const onStartPractice = vi.fn();
    const plan: TodayPlan = {
      warmup: null,
      focusSkillId: 'g3-mul-tables-basic',
      focus: focusConfig,
      review: null,
      estimatedMinutes: 5,
    };
    render(
      <ParentNextActionCard
        summaries={[]}
        todayPlan={plan}
        studentName="Alex"
        onStartPractice={onStartPractice}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /times tables 1/i }));
    expect(onStartPractice).toHaveBeenCalledWith(focusConfig);
  });

  it('calls onStartPractice with review config when review button is clicked', () => {
    const onStartPractice = vi.fn();
    const plan: TodayPlan = {
      warmup: null,
      focusSkillId: null,
      focus: null,
      review: reviewConfig,
      estimatedMinutes: 3,
    };
    render(
      <ParentNextActionCard
        summaries={[]}
        todayPlan={plan}
        studentName="Alex"
        onStartPractice={onStartPractice}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /review 5 items/i }));
    expect(onStartPractice).toHaveBeenCalledWith(reviewConfig);
  });

  it('shows a disabled focus button when focus is null', () => {
    const plan: TodayPlan = {
      warmup: null,
      focusSkillId: null,
      focus: null,
      review: reviewConfig,
      estimatedMinutes: 3,
    };
    render(
      <ParentNextActionCard
        summaries={[]}
        todayPlan={plan}
        studentName="Alex"
        onStartPractice={() => {}}
      />
    );
    const noFocusBtn = screen.getByRole('button', { name: /no focus needed/i });
    expect(noFocusBtn).toBeDisabled();
  });
});

describe('Grade3MasteryMapPage', () => {
  it('shows a new-user suggestion and starts focused practice', async () => {
    vi.spyOn(mathAnswerEventRepo, 'getAll').mockResolvedValue([]);
    vi.spyOn(itemStateRepo, 'getForStudent').mockResolvedValue([]);
    const onStartPractice = vi.fn();
    const profile: StudentProfile = {
      id: 'new-student',
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

    render(
      <Grade3MasteryMapPage
        profile={profile}
        onBack={() => {}}
        onStartPractice={onStartPractice}
        onStartDiagnostic={() => {}}
      />,
    );

    expect(await screen.findByText(/Today's suggestion/i)).toBeInTheDocument();
    const focusButton = screen.getAllByRole('button')
      .find(button => !button.hasAttribute('disabled') && !/back|quick check/i.test(button.textContent ?? ''));
    expect(focusButton).toBeDefined();
    fireEvent.click(focusButton!);

    await waitFor(() => expect(onStartPractice).toHaveBeenCalledTimes(1));
    expect(onStartPractice.mock.calls[0][0].specificItemIds?.length).toBeGreaterThan(0);
  });
});
