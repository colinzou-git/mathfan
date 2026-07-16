import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../features/settings/SettingsPage';
import type { PreparedUserDataExport, UserDataExportFormat } from '../features/export/userDataExport';
import type { SyncStatus } from '../features/sync/driveSync';
import type { StudentProfile } from '../types/math';

const {
  canShareExportArtifactMock,
  downloadPreparedExportMock,
  prepareUserDataExportMock,
  sharePreparedExportMock,
  normalizeSnapshotMock,
  mergeNormalizedSnapshotMock,
} = vi.hoisted(() => ({
  canShareExportArtifactMock: vi.fn(),
  downloadPreparedExportMock: vi.fn(),
  prepareUserDataExportMock: vi.fn(),
  sharePreparedExportMock: vi.fn(),
  normalizeSnapshotMock: vi.fn(),
  mergeNormalizedSnapshotMock: vi.fn(),
}));

vi.mock('../features/export/userDataExport', () => ({
  canShareExportArtifact: canShareExportArtifactMock,
  downloadPreparedExport: downloadPreparedExportMock,
  prepareUserDataExport: prepareUserDataExportMock,
  sharePreparedExport: sharePreparedExportMock,
}));
vi.mock('../features/sync/driveSync', () => ({ getDriveFileInfo: vi.fn(async () => null) }));
vi.mock('../features/sync/snapshot', () => ({
  normalizeSnapshot: normalizeSnapshotMock,
  mergeNormalizedSnapshot: mergeNormalizedSnapshotMock,
}));
vi.mock('../db/repositories', () => ({ attemptRepo: { getAll: vi.fn(async () => []) } }));

const profile: StudentProfile = {
  id: 'student-1', displayName: 'Alex', gradeLevel: 3, timezone: 'UTC', createdAt: '2026-01-01T00:00:00.000Z',
  settings: {
    audioEnabled: false, speechRate: 1, dailyGoalMinutes: 10, sessionLength: 10, autoAdvance: true,
    theme: 'indigo', allowTimedMode: false, competitionModeEnabled: false, parentModeEnabled: false,
  },
};

function artifact(format: UserDataExportFormat = 'json'): PreparedUserDataExport {
  const filename = `mathfan-user-data-20260713-120000.${format}`;
  const blob = new Blob(['data'], { type: format === 'json' ? 'application/json' : 'application/zip' });
  return { filename, format, blob, file: new File([blob], filename, { type: blob.type }) };
}

interface RenderOptions {
  signedIn?: boolean;
  syncStatus?: SyncStatus;
  syncError?: string | null;
  onUpdateProfile?: (updated: StudentProfile) => Promise<void>;
}

function settingsElement({
  signedIn = false,
  syncStatus = 'idle',
  syncError = null,
  onUpdateProfile = async () => undefined,
}: RenderOptions = {}) {
  return (
    <SettingsPage
      profile={profile}
      onUpdateProfile={onUpdateProfile}
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
    />
  );
}

function renderSettings(options: RenderOptions = {}) {
  return render(settingsElement(options));
}

async function chooseFormat(format: UserDataExportFormat) {
  fireEvent.click(screen.getByRole('button', { name: 'Export User Data' }));
  fireEvent.click(screen.getByRole('menuitem', { name: `Export as ${format.toUpperCase()}` }));
}

beforeEach(() => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client');
  vi.clearAllMocks();
  canShareExportArtifactMock.mockReturnValue(false);
  prepareUserDataExportMock.mockImplementation(async (format: UserDataExportFormat) => ({ ok: true, artifact: artifact(format) }));
  downloadPreparedExportMock.mockImplementation((prepared: PreparedUserDataExport) => ({
    ok: true, filename: prepared.filename, format: prepared.format, delivery: 'download',
  }));
  sharePreparedExportMock.mockResolvedValue({ status: 'shared' });
  normalizeSnapshotMock.mockReturnValue({ snapshot: { snapshotVersion: 3 }, problems: [], warnings: [] });
  mergeNormalizedSnapshotMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('Settings Export User Data', () => {
  it('normalizes a downloaded backup before merging and reports record warnings', async () => {
    normalizeSnapshotMock.mockReturnValue({
      snapshot: { snapshotVersion: 3 },
      problems: [],
      warnings: [{ table: 'itemStates', recordId: 'REMOVED_ITEM', code: 'legacy', message: 'Legacy cache row was skipped.' }],
    });
    renderSettings();
    const file = new File([JSON.stringify({ exportMetadata: {}, snapshot: { snapshotVersion: 1 } })], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Choose MathFan backup'), { target: { files: [file] } });

    await waitFor(() => expect(normalizeSnapshotMock).toHaveBeenCalledWith({ snapshotVersion: 1 }));
    expect(mergeNormalizedSnapshotMock).toHaveBeenCalledWith({ snapshotVersion: 3 });
    expect(await screen.findByText(/Backup imported successfully/i)).toBeVisible();
    expect(screen.getByText(/itemStates record REMOVED_ITEM: Legacy cache row was skipped/i)).toBeVisible();
  });

  it('does not write anything when backup normalization reports a structural record error', async () => {
    normalizeSnapshotMock.mockReturnValue({
      problems: [{ table: 'itemStates', recordId: '7', code: 'missing_owner', message: 'Item state is missing studentId.' }],
      warnings: [],
    });
    renderSettings();
    const file = new File([JSON.stringify({ snapshotVersion: 1 })], 'broken.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Choose MathFan backup'), { target: { files: [file] } });

    expect(await screen.findByText(/current progress was not changed/i)).toBeVisible();
    expect(screen.getByText(/itemStates record 7: Item state is missing studentId/i)).toBeVisible();
    expect(mergeNormalizedSnapshotMock).not.toHaveBeenCalled();
  });

  it('is enabled while signed out and immediately downloads both formats in normal browsers', async () => {
    renderSettings();
    const button = screen.getByRole('button', { name: 'Export User Data' });
    expect(button).toBeEnabled();
    expect(screen.getByText(/does not sync with Google Drive first/i)).toBeVisible();
    expect(button).toHaveAttribute('aria-haspopup', 'menu');

    await chooseFormat('json');
    await waitFor(() => expect(prepareUserDataExportMock).toHaveBeenCalledWith('json'));
    expect(downloadPreparedExportMock).toHaveBeenCalledWith(expect.objectContaining({ format: 'json' }));

    await chooseFormat('zip');
    await waitFor(() => expect(prepareUserDataExportMock).toHaveBeenCalledWith('zip'));
    expect(downloadPreparedExportMock).toHaveBeenCalledWith(expect.objectContaining({ format: 'zip' }));
  });

  it('places export between Sync Now and Sign Out for signed-in users', () => {
    renderSettings({ signedIn: true });
    const exportButton = screen.getByRole('button', { name: 'Export User Data' });
    const actions = exportButton.parentElement?.parentElement;
    expect(within(actions!).getAllByRole('button').map(button => button.textContent)).toEqual([
      '↻ Sync Now', 'Export User Data', 'Sign Out',
    ]);
  });

  it('disables export during sync, closes an open menu, and restores it afterward', async () => {
    const view = renderSettings();
    const button = screen.getByRole('button', { name: 'Export User Data' });
    fireEvent.click(button);
    expect(screen.getByRole('menu')).toBeVisible();

    view.rerender(settingsElement({ syncStatus: 'syncing' }));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Export User Data' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Export User Data' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(prepareUserDataExportMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Finish the current sync before exporting/i)).toBeVisible();

    view.rerender(settingsElement({ syncStatus: 'idle' }));
    expect(screen.getByRole('button', { name: 'Export User Data' })).toBeEnabled();
  });

  it('disables duplicate exports while generation is active', async () => {
    let finish!: (value: { ok: true; artifact: PreparedUserDataExport }) => void;
    prepareUserDataExportMock.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    renderSettings();
    await chooseFormat('json');
    expect(screen.getByRole('button', { name: 'Exporting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Sign in with Google/ })).toBeDisabled();
    finish({ ok: true, artifact: artifact() });
    await screen.findByText(/Exported mathfan-user-data/);
  });

  it('keeps export enabled during sync errors and shows the local-freshness warning', async () => {
    renderSettings({ syncStatus: 'error', syncError: 'Drive unavailable' });
    await chooseFormat('json');
    expect(await screen.findByText(/Google Drive sync is currently failing/i)).toBeVisible();
  });

  it('uses a two-step prepared-artifact flow in standalone share-capable mode', async () => {
    canShareExportArtifactMock.mockReturnValue(true);
    renderSettings();
    await chooseFormat('zip');

    expect(await screen.findByRole('button', { name: 'Share or Save File' })).toBeVisible();
    expect(downloadPreparedExportMock).not.toHaveBeenCalled();
    expect(sharePreparedExportMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Share or Save File' }));
    await waitFor(() => expect(sharePreparedExportMock).toHaveBeenCalledWith(expect.objectContaining({ format: 'zip' })));
    expect(await screen.findByText(/Exported mathfan-user-data/)).toBeVisible();
  });

  it('retains a prepared artifact after dismissed sharing and supports retry without rebuilding', async () => {
    canShareExportArtifactMock.mockReturnValue(true);
    sharePreparedExportMock
      .mockResolvedValueOnce({ status: 'dismissed' })
      .mockResolvedValueOnce({ status: 'shared' });
    renderSettings();
    await chooseFormat('json');
    const shareButton = await screen.findByRole('button', { name: 'Share or Save File' });
    fireEvent.click(shareButton);
    expect(await screen.findByText(/Sharing was not completed/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Download Instead' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Share or Save File' }));
    await screen.findByText(/Exported mathfan-user-data/);
    expect(prepareUserDataExportMock).toHaveBeenCalledTimes(1);
    expect(sharePreparedExportMock).toHaveBeenCalledTimes(2);
  });

  it('downloads the same prepared artifact on request and Cancel discards it', async () => {
    canShareExportArtifactMock.mockReturnValue(true);
    renderSettings();
    await chooseFormat('json');
    const readyText = await screen.findByText(/Your export is ready/);
    fireEvent.click(screen.getByRole('button', { name: 'Download Instead' }));
    expect(downloadPreparedExportMock).toHaveBeenCalledWith(expect.objectContaining({ format: 'json' }));
    expect(await screen.findByText(/Exported mathfan-user-data/)).toBeVisible();

    await chooseFormat('zip');
    await screen.findByText(/Your export is ready/);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(readyText).not.toBeInTheDocument();
  });

  it('waits for pending Settings writes before preparing an export', async () => {
    let finishWrite!: () => void;
    const onUpdateProfile = vi.fn(() => new Promise<void>(resolve => { finishWrite = resolve; }));
    renderSettings({ onUpdateProfile });
    fireEvent.change(screen.getByLabelText('Default questions per session'), { target: { value: '25' } });
    await waitFor(() => expect(onUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({ sessionLength: 25 }),
    })));
    await chooseFormat('json');
    expect(prepareUserDataExportMock).not.toHaveBeenCalled();
    finishWrite();
    await waitFor(() => expect(prepareUserDataExportMock).toHaveBeenCalledWith('json'));
  });

  it('serializes rapid writes and waits for the entire queue', async () => {
    const resolvers: Array<() => void> = [];
    const onUpdateProfile = vi.fn((updated: StudentProfile) => {
      void updated;
      return new Promise<void>(resolve => resolvers.push(resolve));
    });
    renderSettings({ onUpdateProfile });
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    await waitFor(() => expect(onUpdateProfile).toHaveBeenCalledTimes(1));
    expect(onUpdateProfile.mock.calls[0][0].settings.audioEnabled).toBe(true);
    expect(onUpdateProfile.mock.calls[0][0].settings.autoAdvance).toBe(true);

    await chooseFormat('json');
    resolvers[0]!();
    await waitFor(() => expect(onUpdateProfile).toHaveBeenCalledTimes(2));
    expect(onUpdateProfile.mock.calls[1][0].settings).toMatchObject({ audioEnabled: true, autoAdvance: false });
    expect(prepareUserDataExportMock).not.toHaveBeenCalled();
    resolvers[1]!();
    await waitFor(() => expect(prepareUserDataExportMock).toHaveBeenCalledOnce());
  });

  it('blocks export after a failed pending write and remains retryable after a corrected write', async () => {
    const onUpdateProfile = vi.fn()
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    renderSettings({ onUpdateProfile });
    fireEvent.click(screen.getAllByRole('switch')[0]);
    expect(await screen.findByText(/Could not save the latest Settings changes/i)).toBeVisible();
    await chooseFormat('json');
    expect(prepareUserDataExportMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/try again before exporting/i)).toBeVisible();

    fireEvent.click(screen.getAllByRole('switch')[0]);
    await waitFor(() => expect(onUpdateProfile).toHaveBeenCalledTimes(2));
    await chooseFormat('json');
    await waitFor(() => expect(prepareUserDataExportMock).toHaveBeenCalledOnce());
  });

  it('routes name, grade, and Daily New limits through the async persistence boundary', async () => {
    const onUpdateProfile = vi.fn(async () => undefined);
    renderSettings({ onUpdateProfile });
    fireEvent.change(screen.getByDisplayValue('Alex'), { target: { value: 'Alexandra' } });
    fireEvent.click(within(screen.getByDisplayValue('Alexandra').parentElement!).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Alexandra' })));
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    await waitFor(() => expect(onUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ gradeLevel: 4 })));
    fireEvent.click(screen.getByRole('button', { name: /Save Daily New limits/i }));
    await waitFor(() => expect(onUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({
      settings: expect.objectContaining({ dailyNewGoalQuestionLimits: expect.any(Object) }),
    })));
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
