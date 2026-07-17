import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentProfile } from '../types/math';

const speechMocks = vi.hoisted(() => ({
  speak: vi.fn(),
  unlock: vi.fn(),
}));

vi.mock('../features/audio/speech', () => ({
  speak: speechMocks.speak,
  unlockSpeechFromUserGesture: speechMocks.unlock,
}));

vi.mock('../db/repositories', () => ({
  attemptRepo: { getAll: vi.fn(async () => []) },
}));

import { SettingsPage } from '../features/settings/SettingsPage';

const profile: StudentProfile = {
  id: 'student-1',
  displayName: 'Alex',
  gradeLevel: 3,
  timezone: 'UTC',
  createdAt: '2026-01-01T00:00:00.000Z',
  settings: {
    audioEnabled: true,
    speechRate: 1.2,
    dailyGoalMinutes: 10,
    sessionLength: 10,
    autoAdvance: true,
    theme: 'indigo',
    allowTimedMode: false,
    competitionModeEnabled: false,
    parentModeEnabled: false,
  },
};

function renderSettings() {
  return render(
    <SettingsPage
      profile={profile}
      onUpdateProfile={async () => undefined}
      onBack={() => {}}
      onSwitchStudent={() => {}}
      auth={{ signedIn: false, token: null, profile: null }}
      syncStatus="idle"
      lastSyncedAt={null}
      syncError={null}
      onSignIn={() => {}}
      onSignOut={() => {}}
      onManualSync={() => {}}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  speechMocks.speak.mockResolvedValue({ status: 'ended' });
});

afterEach(cleanup);

describe('Settings Test Sound', () => {
  it('unlocks and requests speech synchronously from the click handler', async () => {
    speechMocks.speak.mockImplementation(() => new Promise(() => {}));
    renderSettings();
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(speechMocks.unlock).toHaveBeenCalledOnce();
    expect(speechMocks.speak).toHaveBeenCalledWith('MathFan sound is on.', 1.2);
    expect(speechMocks.unlock.mock.invocationCallOrder[0]).toBeLessThan(
      speechMocks.speak.mock.invocationCallOrder[0],
    );
    expect(screen.getByRole('status')).toHaveTextContent('Playing…');
  });

  it.each([
    ['ended', 'Sound played'],
    ['not_started', 'Speech could not start'],
    ['error', 'Speech failed'],
    ['unavailable', 'Speech is unavailable in this browser'],
  ] as const)('reports the %s result', async (status, message) => {
    speechMocks.speak.mockResolvedValue({ status });
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
  });
});
