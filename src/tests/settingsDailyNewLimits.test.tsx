import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../features/settings/SettingsPage';
import type { StudentProfile } from '../types/math';

vi.mock('../db/repositories', () => ({
  attemptRepo: { getAll: vi.fn(async () => []) },
  studentRepo: { save: vi.fn(async () => undefined) },
}));

const profile: StudentProfile = {
  id: 'student-1', displayName: 'Alex', gradeLevel: 3, timezone: 'UTC', createdAt: '2026-01-01T00:00:00.000Z',
  settings: {
    audioEnabled: false, speechRate: 1, dailyGoalMinutes: 10, sessionLength: 10, autoAdvance: true,
    theme: 'indigo', allowTimedMode: false, competitionModeEnabled: false, parentModeEnabled: false,
  },
};

afterEach(cleanup);

describe('SettingsPage Daily New goal limits', () => {
  it('shows defaults, validates, and saves global limits', async () => {
    const onUpdateProfile = vi.fn();
    render(<SettingsPage profile={profile} onUpdateProfile={onUpdateProfile} onBack={() => {}} onSwitchStudent={() => {}}
      auth={{ signedIn: false, token: null, profile: null }} syncStatus="idle" lastSyncedAt={null} syncError={null}
      onSignIn={() => {}} onSignOut={() => {}} onManualSync={() => {}} />);

    const min = screen.getByLabelText(/Default min questions per skill per day/i);
    const max = screen.getByLabelText(/Default max questions per skill per day/i);
    expect(min).toHaveValue(5);
    expect(max).toHaveValue(12);
    expect(screen.getByLabelText(/Max planned goal-new questions per day/i)).toHaveValue(80);

    fireEvent.change(min, { target: { value: '4' } });
    fireEvent.change(max, { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Daily New limits/i }));
    await waitFor(() => expect(onUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({ dailyNewGoalQuestionLimits: {
        minQuestionsPerSkillTile: 4, maxQuestionsPerSkillTile: 9, maxPlannedQuestionsPerDay: 80,
      } }),
    })));
  });
});
