import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../features/settings/SettingsPage';
import type { StudentProfile } from '../types/math';
import type { SyncStatus } from '../features/sync/driveSync';

const { exportUserDataMock } = vi.hoisted(() => ({ exportUserDataMock: vi.fn() }));

vi.mock('../features/export/userDataExport', () => ({ exportUserData: exportUserDataMock }));
vi.mock('../features/sync/driveSync', () => ({ getDriveFileInfo: vi.fn(async () => null) }));
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

function renderSettings({
  signedIn = false,
  syncStatus = 'idle',
  syncError = null,
}: { signedIn?: boolean; syncStatus?: SyncStatus; syncError?: string | null } = {}) {
  return render(
    <SettingsPage
      profile={profile}
      onUpdateProfile={() => {}}
      onBack={() => {}}
      onSwitchStudent={() => {}}
      auth={signedIn
        ? { signedIn: true, token: 'token', profile: { sub: 'parent-1', email: 'parent@example.com', name: 'Parent' } }
        : { signedIn: false, token: null, profile: null }}
      syncStatus={syncStatus}
      lastSyncedAt={null}
      syncError={syncError}
      onSignIn={() => {}}
      onSignOut={() => {}}
      onManualSync={() => {}}
    />,
  );
}

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client');
  exportUserDataMock.mockReset();
  exportUserDataMock.mockResolvedValue({ ok: true, filename: 'mathfan-user-data-20260713-120000.json', format: 'json', delivery: 'download' });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('Settings Export User Data', () => {
  it('is enabled while signed out and invokes both local formats', async () => {
    renderSettings();
    const button = screen.getByRole('button', { name: 'Export User Data' });
    expect(button).toBeEnabled();
    expect(screen.getByText(/does not sync with Google Drive first/i)).toBeVisible();
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export as JSON' }));
    await waitFor(() => expect(exportUserDataMock).toHaveBeenCalledWith('json'));

    fireEvent.click(screen.getByRole('button', { name: 'Export User Data' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export as ZIP' }));
    await waitFor(() => expect(exportUserDataMock).toHaveBeenCalledWith('zip'));
  });

  it('places export between Sync Now and Sign Out for signed-in users', () => {
    renderSettings({ signedIn: true });
    const exportButton = screen.getByRole('button', { name: 'Export User Data' });
    const actions = exportButton.parentElement?.parentElement;
    expect(actions).not.toBeNull();
    expect(within(actions!).getAllByRole('button').map(button => button.textContent)).toEqual([
      '↻ Sync Now', 'Export User Data', 'Sign Out',
    ]);
  });

  it('disables duplicate exports while generation is active', async () => {
    let finish!: (value: { ok: boolean; filename: string }) => void;
    exportUserDataMock.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Export User Data' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export as JSON' }));
    expect(screen.getByRole('button', { name: 'Exporting…' })).toBeDisabled();
    finish({ ok: true, filename: 'data.json' });
    await screen.findByText('Exported data.json');
  });

  it('shows readable failures and allows retry', async () => {
    exportUserDataMock.mockResolvedValueOnce({ ok: false, error: 'Could not read local data.' });
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Export User Data' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export as ZIP' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not read local data.');
    expect(screen.getByRole('button', { name: 'Export User Data' })).toBeEnabled();
  });

  it('keeps export enabled during sync errors and shows the local-freshness warning', async () => {
    renderSettings({ syncStatus: 'error', syncError: 'Drive unavailable' });
    const button = screen.getByRole('button', { name: 'Export User Data' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export as JSON' }));
    expect(await screen.findByText(/Google Drive sync is currently failing/i)).toBeVisible();
  });

  it('closes the accessible format menu with Escape and outside click', () => {
    renderSettings();
    const button = screen.getByRole('button', { name: 'Export User Data' });
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(button);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
