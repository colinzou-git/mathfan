import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { StudentProfile } from '../types/math';

const { runMigrationMock } = vi.hoisted(() => ({ runMigrationMock: vi.fn() }));

const mockProfile: StudentProfile = {
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

vi.mock('../db/repositories', () => ({
  studentRepo: {
    getAll: vi.fn(async () => [mockProfile]),
    save: vi.fn(),
  },
  sessionRepo: {
    deleteEmpty: vi.fn(async () => 0),
  },
  mathAnswerEventRepo: {
    getAll: vi.fn(async () => []),
  },
}));

vi.mock('../features/sync/useSync', () => ({
  initAuth: vi.fn(),
  useSync: () => ({
    auth: { signedIn: false },
    syncStatus: 'idle',
    lastSyncedAt: null,
    syncError: null,
    handleSignIn: vi.fn(),
    handleSignOut: vi.fn(),
    manualSync: vi.fn(),
  }),
}));

vi.mock('../features/auth/googleAuth', () => ({
  currentState: () => ({ signedIn: false }),
  hasPersistedGrant: () => false,
}));

vi.mock('../features/sync/driveSync', () => ({
  pushLocal: vi.fn(),
  pullAndMerge: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../features/theme/themes', () => ({
  applyTheme: vi.fn(),
}));

vi.mock('../features/audio/speech', () => ({
  preloadVoices: vi.fn(),
  stopSpeech: vi.fn(),
}));

vi.mock('../features/migrations/cardStateMigration', () => ({ runCardStateMigration: runMigrationMock }));

vi.mock('../features/dashboard/ProfileSetup', () => ({
  ProfileSetup: () => <div>Profile Setup</div>,
}));

vi.mock('../features/dashboard/StudentDashboard', () => ({
  StudentDashboard: ({ onOpenGoals, onOpenMasteryMap }: { onOpenGoals: () => void; onOpenMasteryMap: () => void }) => (
    <div>
      <button onClick={onOpenGoals}>Open Goals</button>
      <button onClick={onOpenMasteryMap}>Open Math Map</button>
    </div>
  ),
}));

vi.mock('../features/goals/GoalsPage', () => ({
  GoalsPage: ({ onStartEvaluation }: { onStartEvaluation: () => void }) => (
    <div>
      <h1>Goals Screen</h1>
      <button onClick={onStartEvaluation}>Evaluation</button>
    </div>
  ),
}));

vi.mock('../features/goals/GoalEvaluationSession', () => ({
  GoalEvaluationSession: () => <h1>Goal Evaluation Screen</h1>,
}));

vi.mock('../features/mastery/Grade3MasteryMapPage', () => ({
  Grade3MasteryMapPage: ({ onStartDiagnostic }: { onStartDiagnostic: () => void }) => (
    <div>
      <h1>Math Map Screen</h1>
      <button onClick={onStartDiagnostic}>Quick Check</button>
    </div>
  ),
}));

vi.mock('../features/diagnosis/DiagnosticSession', () => ({
  DiagnosticSession: () => <h1>Diagnostic Screen</h1>,
}));

vi.mock('../features/settings/SettingsPage', () => ({ SettingsPage: () => <div /> }));
vi.mock('../features/stats/StatsPage', () => ({ StatsPage: () => <div /> }));
vi.mock('../features/stats/TodayAchievementDetail', () => ({ TodayAchievementDetail: () => <div /> }));
vi.mock('../features/multiplication/MultiplicationQuizPage', () => ({ MultiplicationQuizPage: () => <div /> }));
vi.mock('../features/practice/PracticeScreen', () => ({ PracticeScreen: () => <div /> }));
vi.mock('../components/SessionSetup', () => ({ SessionSetup: () => <div /> }));
vi.mock('../components/RangeSetup', () => ({ RangeSetup: () => <div /> }));

import App from '../App';

beforeEach(() => {
  vi.clearAllMocks();
  runMigrationMock.mockResolvedValue({ status: 'completed', runId: 'migration-run' });
});

afterEach(() => {
  cleanup();
});

describe('App goal evaluation navigation', () => {
  it('blocks dashboard bootstrap when card migration fails', async () => {
    runMigrationMock.mockResolvedValueOnce({ status: 'failed', runId: 'failed-run', error: 'Legacy row could not be preserved.' });
    render(<App />);
    expect(await screen.findByRole('heading', { name: /practice history needs attention/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Legacy row could not be preserved.');
    expect(screen.queryByRole('button', { name: /open goals/i })).not.toBeInTheDocument();
  });

  it('opens the distinct goal-evaluation screen from Goals Evaluation', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /open goals/i }));
    fireEvent.click(screen.getByRole('button', { name: /evaluation/i }));

    expect(await screen.findByText(/Goal Evaluation Screen/i)).toBeInTheDocument();
    expect(screen.queryByText(/Diagnostic Screen/i)).not.toBeInTheDocument();
  });

  it('keeps Math Map Quick Check on the existing diagnostic screen', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /open math map/i }));
    fireEvent.click(screen.getByRole('button', { name: /quick check/i }));

    await waitFor(() => expect(screen.getByText(/Diagnostic Screen/i)).toBeInTheDocument());
    expect(screen.queryByText(/Goal Evaluation Screen/i)).not.toBeInTheDocument();
  });
});
