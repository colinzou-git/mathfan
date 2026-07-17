import { useState, useEffect, useRef } from 'react';
import type { StudentProfile, StudentSettings, GradeLevel, SessionLength, ThemeName } from '../../types/math';
import { THEMES, applyTheme } from '../theme/themes';
import { getDriveFileInfo } from '../sync/driveSync';
import type { SyncStatus } from '../sync/driveSync';
import type { AuthState } from '../auth/googleAuth';
import { attemptRepo } from '../../db/repositories';
import { isDebugSpeed, enableDebugSpeed, disableDebugSpeed } from '../time/clock';
import { getAiConfig, setAiKey, setAiModel, clearAiKey, DEFAULT_MODEL } from '../ai/aiConfig';
import { askTutor, explainAiError, aiErrorDetail } from '../ai/gemini';
import { checkForUpdate, type BuildInfo } from './updateCheck';
import { normalizeDailyNewGoalLimits, validateDailyNewGoalLimits } from '../goals/dailyNewGoalLimits';
import {
  canShareExportArtifact,
  downloadPreparedExport,
  prepareUserDataExport,
  sharePreparedExport,
  type PreparedUserDataExport,
  type UserDataExportFormat,
} from '../export/userDataExport';
import { mergeNormalizedSnapshot, normalizeSnapshot, type SnapshotNormalizationProblem } from '../sync/snapshot';
import { speak, unlockSpeechFromUserGesture, type SpeechStatus } from '../audio/speech';

interface Props {
  profile: StudentProfile;
  onUpdateProfile: (p: StudentProfile) => Promise<void>;
  onBack: () => void;
  onSwitchStudent: () => void;
  auth: AuthState;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  syncError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onManualSync: () => void;
}

type ExportUiState =
  | { status: 'idle' }
  | { status: 'exporting'; format: UserDataExportFormat }
  | {
      status: 'ready';
      format: UserDataExportFormat;
      artifact: PreparedUserDataExport;
      deliveryMessage?: string;
      sharing?: boolean;
    }
  | { status: 'success'; format: UserDataExportFormat; filename: string; warning?: string }
  | { status: 'error'; message: string };

type ImportUiState =
  | { status: 'idle' }
  | { status: 'importing' }
  | { status: 'success'; warnings: SnapshotNormalizationProblem[] }
  | { status: 'error'; problems: SnapshotNormalizationProblem[] };

function snapshotProblemLabel(problem: SnapshotNormalizationProblem): string {
  return `${problem.table}${problem.recordId ? ` record ${problem.recordId}` : ''}: ${problem.message}`;
}

/** Known Gemini models with a free tier. Each has its own daily quota. */
const AI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.section}>
      <h3 style={s.sectionTitle}>{title}</h3>
      <div style={s.sectionBody}>{children}</div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={s.row}>
      <div>
        <p style={s.rowLabel}>{label}</p>
        {desc && <p style={s.rowDesc}>{desc}</p>}
      </div>
      <button
        role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        style={{ ...s.toggle, background: checked ? 'var(--primary)' : '#d1d5db' }}
      >
        <span style={{ ...s.knob, transform: checked ? 'translateX(22px)' : 'translateX(2px)' }} />
      </button>
    </label>
  );
}

export function SettingsPage({ profile, onUpdateProfile, onBack, onSwitchStudent, auth, syncStatus, lastSyncedAt, syncError, onSignIn, onSignOut, onManualSync }: Props) {
  const settings = profile.settings;
  const [driveInfo, setDriveInfo] = useState<{ sizeBytes: number | null; modifiedAt: string | null } | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);
  const [editName, setEditName] = useState(profile.displayName);
  const [nameDirty, setNameDirty] = useState(false);
  const [debugSpeed, setDebugSpeed] = useState(isDebugSpeed());
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'available' | 'none' | 'error'>('idle');
  const [serverBuild, setServerBuild] = useState<BuildInfo | null>(null);
  const [dailyNewLimits, setDailyNewLimits] = useState(() => normalizeDailyNewGoalLimits(settings.dailyNewGoalQuestionLimits));
  const [dailyNewLimitsError, setDailyNewLimitsError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportState, setExportState] = useState<ExportUiState>({ status: 'idle' });
  const [importState, setImportState] = useState<ImportUiState>({ status: 'idle' });
  const [profileWritePending, setProfileWritePending] = useState(false);
  const [profileWriteError, setProfileWriteError] = useState<string | null>(null);
  const [soundTestStatus, setSoundTestStatus] = useState<'idle' | 'playing' | SpeechStatus>('idle');
  const exportControlRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const latestProfileRef = useRef(profile);
  const pendingProfileWriteRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWriteCountRef = useRef(0);
  const mountedRef = useRef(true);
  const syncStatusRef = useRef(syncStatus);

  // The build baked into this running bundle (substituted by Vite `define`).
  const currentBuild: BuildInfo = { appVersion: __APP_VERSION__, gitSha: __GIT_SHA__, buildTime: __BUILD_TIME__ };

  // Primary update detection: probe the deployed build-info.json over the
  // network. This works even when `registration.waiting` is empty, which it
  // always is under `skipWaiting: true`. A failed fetch surfaces a real error
  // instead of pretending the app is up to date.
  const checkForUpdates = async () => {
    setUpdateState('checking');
    const result = await checkForUpdate(currentBuild, import.meta.env.BASE_URL);
    setServerBuild(result.server);
    setUpdateState(result.state);
  };

  // Secondary action: nudge the service worker to pick up the new build, then
  // force a cache-busting reload. We don't rely on `registration.waiting`
  // because skipWaiting means there may be no waiting worker to message.
  const applyUpdate = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      }
    } catch {
      // Ignore — the cache-busting reload below still pulls the new build.
    }
    const url = new URL(window.location.href);
    url.searchParams.set('fresh', String(Date.now()));
    window.location.href = url.toString();
  };

  const toggleDebugSpeed = (on: boolean) => {
    if (on) enableDebugSpeed(); else disableDebugSpeed();
    setDebugSpeed(on);
  };

  const testSound = async () => {
    // Keep both calls in the click task so mobile/PWA engines receive a durable
    // user-activation signal before the audible request is enqueued.
    unlockSpeechFromUserGesture();
    setSoundTestStatus('playing');
    const result = await speak('MathFan sound is on.', settings.speechRate ?? 0.9);
    setSoundTestStatus(result.status);
  };

  const soundTestLabel: Record<'idle' | 'playing' | SpeechStatus, string> = {
    idle: '',
    playing: 'Playing…',
    ended: 'Sound played',
    not_started: 'Speech could not start',
    error: 'Speech failed',
    unavailable: 'Speech is unavailable in this browser',
    cancelled: 'Cancelled',
  };

  // AI tutor config (localStorage-backed, never synced)
  const [aiKey, setAiKeyInput] = useState(() => getAiConfig().apiKey);
  const [aiModel, setAiModelInput] = useState(() => getAiConfig().model);
  const [aiTest, setAiTest] = useState<{ state: 'idle' | 'testing' | 'ok' | 'err'; msg?: string; detail?: string }>({ state: 'idle' });

  const saveAi = () => { setAiKey(aiKey); setAiModel(aiModel || DEFAULT_MODEL); setAiTest({ state: 'idle' }); };
  const testAi = async () => {
    setAiKey(aiKey); setAiModel(aiModel || DEFAULT_MODEL);
    setAiTest({ state: 'testing' });
    try {
      await askTutor(
        [{ role: 'user', text: 'Say hello in one short sentence.' }],
        { prompt: '2 + 2', answer: 4, itemType: 'addition_fact' },
      );
      setAiTest({ state: 'ok', msg: 'Connected! The tutor is ready.' });
    } catch (err) {
      // Show the kid-friendly summary AND the provider's raw reason, so a
      // grown-up can actually fix it (wrong model, quota, disabled API, …).
      setAiTest({ state: 'err', msg: explainAiError(err), detail: aiErrorDetail(err) });
    }
  };
  const removeAi = () => { clearAiKey(); setAiKeyInput(''); setAiTest({ state: 'idle' }); };

  useEffect(() => {
    attemptRepo.getAll(profile.id).then(a => setTotalQuestions(a.length));
    if (auth.signedIn) {
      getDriveFileInfo().then(setDriveInfo);
    }
  }, [profile.id, auth.signedIn, lastSyncedAt]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (pendingWriteCountRef.current === 0) latestProfileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    syncStatusRef.current = syncStatus;
    if (syncStatus !== 'syncing') return;
    const timer = window.setTimeout(() => setExportMenuOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [syncStatus]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!exportControlRef.current?.contains(event.target as Node)) setExportMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [exportMenuOpen]);

  useEffect(() => {
    if (exportState.status !== 'success') return;
    const timer = window.setTimeout(() => setExportState({ status: 'idle' }), 8000);
    return () => window.clearTimeout(timer);
  }, [exportState.status]);

  const persistProfile = (updated: StudentProfile): Promise<void> => {
    latestProfileRef.current = updated;
    pendingWriteCountRef.current += 1;
    setProfileWritePending(true);
    setProfileWriteError(null);

    const write = pendingProfileWriteRef.current
      .catch(() => undefined)
      .then(() => onUpdateProfile(updated));
    pendingProfileWriteRef.current = write;

    void write
      .then(() => {
        if (mountedRef.current && latestProfileRef.current === updated) setProfileWriteError(null);
      })
      .catch(error => {
        console.error('[MathFan settings] Profile write failed.', error);
        if (mountedRef.current) setProfileWriteError('Could not save the latest Settings changes. Please try again.');
      })
      .finally(() => {
        pendingWriteCountRef.current -= 1;
        if (mountedRef.current && pendingWriteCountRef.current === 0) setProfileWritePending(false);
      });

    return write;
  };

  const save = (patch: Partial<StudentSettings>) => {
    const current = latestProfileRef.current;
    const updated = { ...current, settings: { ...current.settings, ...patch } };
    if (patch.theme) applyTheme(patch.theme);
    void persistProfile(updated);
  };

  const saveName = async () => {
    if (!editName.trim() || editName.trim() === latestProfileRef.current.displayName) { setNameDirty(false); return; }
    const updated = { ...latestProfileRef.current, displayName: editName.trim() };
    try {
      await persistProfile(updated);
      if (mountedRef.current) setNameDirty(false);
    } catch {
      // persistProfile already reports a readable error and leaves the name retryable.
    }
  };

  const saveDailyNewLimits = () => {
    const result = validateDailyNewGoalLimits(dailyNewLimits);
    if (result.errors.length) {
      setDailyNewLimitsError(result.errors[0]);
      return;
    }
    setDailyNewLimitsError(null);
    setDailyNewLimits(result.limits);
    save({ dailyNewGoalQuestionLimits: result.limits });
  };

  function fmtBuildTime(iso: string): string {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
  }

  // Compact build identifier derived from the build timestamp, e.g. "20260605.2212".
  // Changes on every build even when the semver stays the same.
  function buildId(iso: string): string {
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}.${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
  }

  // Short git SHA for display; 'dev' for local/unversioned builds.
  function shortSha(sha: string): string {
    return sha && sha !== 'dev' ? sha.slice(0, 7) : 'dev';
  }

  // One-line label like "MathFan v1.2.0+20260605.2212 · a1b2c3d".
  function buildLabel(b: BuildInfo): string {
    return `MathFan v${b.appVersion}+${buildId(b.buildTime)} · ${shortSha(b.gitSha)}`;
  }

  function fmt(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function syncTimeLabel(): string {
    if (syncStatus === 'syncing') return 'Syncing…';
    if (syncStatus === 'error') return syncError ? `Error: ${syncError.slice(0, 60)}` : 'Sync failed';
    if (lastSyncedAt) {
      const d = new Date(lastSyncedAt);
      const mins = Math.floor((Date.now() - d.getTime()) / 60000); // eslint-disable-line react-hooks/purity
      if (mins < 1) return `Synced just now (${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      if (mins < 60) return `Synced ${mins}m ago (${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      return `Synced ${d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    }
    return 'Not yet synced';
  }

  const currentSyncWarning = () => syncStatus === 'error'
    ? 'Exported local data. Google Drive sync is currently failing, so this file may not include newer activity from another device.'
    : undefined;

  const completeExport = (format: UserDataExportFormat, filename: string) => {
    setExportState({
      status: 'success',
      format,
      filename,
      warning: currentSyncWarning(),
    });
  };

  const runExport = async (format: UserDataExportFormat) => {
    if (syncStatus === 'syncing' || exportState.status === 'exporting') return;
    setExportMenuOpen(false);
    setExportState({ status: 'exporting', format });

    try {
      await pendingProfileWriteRef.current;
    } catch (error) {
      console.error('[MathFan export] Pending Settings write failed.', error);
      setExportState({
        status: 'error',
        message: 'Could not save the latest Settings changes. Please try again before exporting.',
      });
      return;
    }

    const syncIsRunning = () => syncStatusRef.current === 'syncing';
    if (syncIsRunning()) {
      setExportState({ status: 'error', message: 'Finish the current sync before exporting local data.' });
      return;
    }

    const prepared = await prepareUserDataExport(format);
    if (!prepared.ok) {
      setExportState({ status: 'error', message: prepared.error });
      return;
    }

    if (syncIsRunning()) {
      setExportState({ status: 'error', message: 'The sync started before export finished. Please export again when sync is complete.' });
      return;
    }

    if (canShareExportArtifact(prepared.artifact)) {
      setExportState({ status: 'ready', format, artifact: prepared.artifact });
      return;
    }

    const downloaded = downloadPreparedExport(prepared.artifact);
    if (downloaded.ok) completeExport(format, prepared.artifact.filename);
    else setExportState({ status: 'error', message: downloaded.error ?? 'Could not save the export file. Please try again.' });
  };

  const shareReadyExport = async () => {
    if (exportState.status !== 'ready' || exportState.sharing) return;
    const current = exportState;
    setExportState({ ...current, sharing: true, deliveryMessage: undefined });
    const result = await sharePreparedExport(current.artifact);
    if (result.status === 'shared') {
      completeExport(current.format, current.artifact.filename);
      return;
    }
    setExportState({
      ...current,
      sharing: false,
      deliveryMessage: result.status === 'dismissed'
        ? 'Sharing was not completed. You can try again or download the file instead.'
        : result.message,
    });
  };

  const downloadReadyExport = () => {
    if (exportState.status !== 'ready') return;
    const current = exportState;
    const result = downloadPreparedExport(current.artifact);
    if (result.ok) completeExport(current.format, current.artifact.filename);
    else setExportState({ ...current, sharing: false, deliveryMessage: result.error });
  };

  const exportDisabled = exportState.status === 'exporting' || syncStatus === 'syncing';
  const syncActionDisabled = syncStatus === 'syncing' || exportState.status === 'exporting';

  const importBackup = async (file: File) => {
    setImportState({ status: 'importing' });
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const rawSnapshot = parsed && typeof parsed === 'object' && 'snapshot' in parsed
        ? (parsed as { snapshot: unknown }).snapshot
        : parsed;
      const normalized = normalizeSnapshot(rawSnapshot);
      if (!normalized.snapshot || normalized.problems.length) {
        setImportState({ status: 'error', problems: normalized.problems });
        return;
      }
      await mergeNormalizedSnapshot(normalized.snapshot);
      setImportState({ status: 'success', warnings: normalized.warnings });
    } catch (error) {
      setImportState({
        status: 'error',
        problems: [{ table: 'snapshot', code: 'read_failed', message: error instanceof Error ? error.message : 'The backup could not be read.' }],
      });
    } finally {
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const exportControl = (
    <div ref={exportControlRef} style={s.exportControl}>
      <button
        type="button"
        style={{ ...s.exportBtn, opacity: exportDisabled ? 0.6 : 1, cursor: exportDisabled ? 'not-allowed' : 'pointer' }}
        aria-haspopup="menu"
        aria-expanded={exportMenuOpen}
        title={syncStatus === 'syncing' ? 'Finish the current sync before exporting local data.' : undefined}
        onClick={() => { if (!exportDisabled) setExportMenuOpen(open => !open); }}
        disabled={exportDisabled}
      >
        {exportState.status === 'exporting' ? 'Exporting…' : 'Export User Data'}
      </button>
      {exportMenuOpen && (
        <div role="menu" aria-label="Export format" style={s.exportMenu}>
          <button type="button" role="menuitem" style={s.exportMenuItem} onClick={() => runExport('json')}>
            Export as JSON
          </button>
          <button type="button" role="menuitem" style={s.exportMenuItem} onClick={() => runExport('zip')}>
            Export as ZIP
          </button>
        </div>
      )}
    </div>
  );

  const exportDetails = (
    <>
      <p style={{ ...s.rowDesc, marginTop: '10px' }}>
        Exports all MathFan data currently stored on this device. It does not sync with Google Drive first.
      </p>
      {syncStatus === 'syncing' && (
        <p style={{ color: '#b45309', fontSize: '13px', margin: '6px 0 0' }}>
          Finish the current sync before exporting local data.
        </p>
      )}
      {profileWritePending && exportState.status !== 'exporting' && (
        <p role="status" style={{ color: '#6b7280', fontSize: '13px', margin: '6px 0 0' }}>Saving changes…</p>
      )}
      {profileWriteError && exportState.status !== 'error' && (
        <p role="alert" style={{ color: '#b91c1c', fontSize: '13px', margin: '6px 0 0' }}>{profileWriteError}</p>
      )}
      {exportState.status === 'ready' && (
        <div style={s.exportReadyPanel}>
          <p role="status" style={{ margin: 0, color: '#166534', fontSize: '13px' }}>
            Your export is ready: <strong>{exportState.artifact.filename}</strong>
          </p>
          {exportState.deliveryMessage && (
            <p role="alert" style={{ color: '#b45309', fontSize: '13px', margin: '6px 0 0' }}>
              {exportState.deliveryMessage}
            </p>
          )}
          <div style={{ ...s.syncActions, marginTop: '10px' }}>
            <button type="button" style={s.syncBtn} onClick={shareReadyExport} disabled={exportState.sharing}>
              {exportState.sharing ? 'Opening Share…' : 'Share or Save File'}
            </button>
            <button type="button" style={{ ...s.exportBtn, width: 'auto', flex: '1 1 140px' }} onClick={downloadReadyExport}>Download Instead</button>
            <button type="button" style={s.outBtn} onClick={() => setExportState({ status: 'idle' })}>Cancel</button>
          </div>
        </div>
      )}
      {exportState.status === 'success' && (
        <div role="status" style={{ color: '#15803d', fontSize: '13px', marginTop: '8px' }}>
          <p style={{ margin: 0 }}>Exported {exportState.filename}</p>
          {exportState.warning && <p style={{ color: '#b45309', margin: '4px 0 0' }}>{exportState.warning}</p>}
        </div>
      )}
      {exportState.status === 'error' && (
        <p role="alert" style={{ color: '#b91c1c', fontSize: '13px', margin: '8px 0 0' }}>{exportState.message}</p>
      )}
      <div style={{ ...s.syncActions, marginTop: '12px' }}>
        <input
          ref={importFileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Choose MathFan backup"
          style={{ display: 'none' }}
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) void importBackup(file);
          }}
        />
        <button
          type="button"
          style={s.outBtn}
          disabled={importState.status === 'importing' || syncStatus === 'syncing'}
          onClick={() => importFileRef.current?.click()}
        >
          {importState.status === 'importing' ? 'Importing…' : 'Import Backup'}
        </button>
      </div>
      <p style={{ ...s.rowDesc, marginTop: '6px' }}>Restore a MathFan JSON backup from this device. Existing progress is safely merged.</p>
      {importState.status === 'success' && (
        <div role="status" style={{ color: '#15803d', fontSize: '13px', marginTop: '8px' }}>
          <p style={{ margin: 0 }}>Backup imported successfully. Your restored progress is ready.</p>
          {importState.warnings.map((warning, index) => (
            <p key={`${warning.table}-${warning.recordId ?? index}`} style={{ color: '#b45309', margin: '4px 0 0' }}>
              {snapshotProblemLabel(warning)}
            </p>
          ))}
        </div>
      )}
      {importState.status === 'error' && (
        <div role="alert" style={{ color: '#b91c1c', fontSize: '13px', marginTop: '8px' }}>
          <p style={{ margin: 0 }}>This backup was not imported. Your current progress was not changed.</p>
          {importState.problems.map((problem, index) => (
            <p key={`${problem.table}-${problem.recordId ?? index}`} style={{ margin: '4px 0 0' }}>{snapshotProblemLabel(problem)}</p>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={onBack}>← Back</button>
        <h2 style={s.title}>Settings</h2>
      </div>

      {/* ── Profile ─────────────────────────────────────────────────── */}
      <Section title="Profile">
        <div style={s.row}>
          <p style={s.rowLabel}>Name</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              value={editName}
              onChange={e => { setEditName(e.target.value); setNameDirty(true); }}
              onKeyDown={e => e.key === 'Enter' && saveName()}
              style={s.textInput}
              maxLength={40}
            />
            {nameDirty && (
              <button style={s.saveBtn} onClick={saveName}>Save</button>
            )}
          </div>
        </div>
        <div style={s.row}>
          <p style={s.rowLabel}>Grade</p>
          <div style={{ display: 'flex', gap: '6px' }}>
            {([3, 4, 5] as GradeLevel[]).map(g => (
              <button
                key={g}
                onClick={() => void persistProfile({ ...latestProfileRef.current, gradeLevel: g })}
                style={{ ...s.gradeBtn, ...(profile.gradeLevel === g ? s.gradeBtnOn : {}) }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <button style={s.linkBtn} onClick={onSwitchStudent}>Switch / Add Profile</button>
      </Section>

      {/* ── Practice ────────────────────────────────────────────────── */}
      <Section title="Practice">
        <ToggleRow
          label="Sound"
          desc="Speak questions and feedback aloud"
          checked={settings.audioEnabled}
          onChange={v => save({ audioEnabled: v })}
        />
        <div style={s.row}>
          <div>
            <p style={s.rowLabel}>Test Sound</p>
            <p role="status" style={s.rowDesc}>
              {soundTestLabel[soundTestStatus] || 'Check that this browser can play MathFan speech'}
            </p>
          </div>
          <button
            type="button"
            style={s.adjBtn}
            disabled={soundTestStatus === 'playing'}
            onClick={() => void testSound()}
          >
            {soundTestStatus === 'playing' ? 'Playing…' : 'Play'}
          </button>
        </div>
        <ToggleRow
          label="Auto-advance"
          desc="Skip 'press Enter to continue' after correct answers"
          checked={settings.autoAdvance}
          onChange={v => save({ autoAdvance: v })}
        />
        <div style={s.row}>
          <div>
            <p style={s.rowLabel}>Default questions per session</p>
            <p style={s.rowDesc}>Used when starting Daily Review</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button style={s.adjBtn} onClick={() => save({ sessionLength: Math.max(1, settings.sessionLength - 5) as SessionLength })}>−5</button>
            <input
              type="number" min={1} max={200}
              aria-label="Default questions per session"
              value={settings.sessionLength}
              onChange={e => {
                const n = parseInt(e.target.value);
                if (!isNaN(n) && n > 0) save({ sessionLength: Math.min(200, n) as SessionLength });
              }}
              style={s.numInput}
            />
            <button style={s.adjBtn} onClick={() => save({ sessionLength: Math.min(200, settings.sessionLength + 5) as SessionLength })}>+5</button>
          </div>
        </div>
      </Section>

      <Section title="Daily New for Goals limits">
        <label style={s.row}>
          <span style={s.rowLabel}>Default min questions per skill per day</span>
          <input aria-label="Default min questions per skill per day" type="number" min={1} max={50}
            value={dailyNewLimits.minQuestionsPerSkillTile}
            onChange={event => setDailyNewLimits(current => ({ ...current, minQuestionsPerSkillTile: Number(event.target.value) }))} style={s.numInput} />
        </label>
        <label style={s.row}>
          <span style={s.rowLabel}>Default max questions per skill per day</span>
          <input aria-label="Default max questions per skill per day" type="number" min={1} max={100}
            value={dailyNewLimits.maxQuestionsPerSkillTile}
            onChange={event => setDailyNewLimits(current => ({ ...current, maxQuestionsPerSkillTile: Number(event.target.value) }))} style={s.numInput} />
        </label>
        <label style={s.row}>
          <span style={s.rowLabel}>Max planned goal-new questions per day</span>
          <input aria-label="Max planned goal-new questions per day" type="number" min={1} max={200}
            value={dailyNewLimits.maxPlannedQuestionsPerDay}
            onChange={event => setDailyNewLimits(current => ({ ...current, maxPlannedQuestionsPerDay: Number(event.target.value) }))} style={s.numInput} />
        </label>
        <p style={s.rowDesc}>These only affect Daily New for Goals. FSRS Daily Review is unchanged.</p>
        {dailyNewLimitsError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{dailyNewLimitsError}</p>}
        <button style={s.saveBtn} onClick={saveDailyNewLimits}>Save Daily New limits</button>
      </Section>

      {/* ── Appearance ──────────────────────────────────────────────── */}
      <Section title="Appearance">
        <p style={{ ...s.rowDesc, marginBottom: '12px' }}>Choose a color theme</p>
        <div style={s.themeGrid}>
          {THEMES.map(t => (
            <button
              key={t.name}
              title={t.label}
              onClick={() => save({ theme: t.name as ThemeName })}
              style={{
                ...s.themeBtn,
                background: t.primary,
                boxShadow: settings.theme === t.name
                  ? `0 0 0 3px #fff, 0 0 0 5px ${t.primary}`
                  : '0 1px 3px rgba(0,0,0,0.2)',
                transform: settings.theme === t.name ? 'scale(1.15)' : 'scale(1)',
              }}
              aria-label={t.label}
              aria-pressed={settings.theme === t.name}
            />
          ))}
        </div>
        <p style={{ ...s.rowDesc, marginTop: '8px', textAlign: 'center' }}>
          {THEMES.find(t => t.name === settings.theme)?.label ?? 'Indigo'}
        </p>
      </Section>

      {/* ── Sync ────────────────────────────────────────────────────── */}
      <Section title="Google Sync">
        {!import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
          <>
            <div style={s.warnBox}>
              <p style={{ fontWeight: '600', margin: '0 0 4px' }}>Not configured</p>
              <p style={{ fontSize: '13px', margin: 0 }}>
                Add <code>VITE_GOOGLE_CLIENT_ID</code> to your <code>.env</code> file and restart the dev server.
              </p>
            </div>
            <div style={s.syncActions}>{exportControl}</div>
            {exportDetails}
          </>
        ) : auth.signedIn ? (
          <>
            <div style={s.syncInfoGrid}>
              <SyncRow label="Account" value={auth.profile?.email ?? auth.profile?.name ?? 'Signed in'} />
              <SyncRow label="Last sync" value={syncTimeLabel()} />
              {driveInfo?.sizeBytes && (
                <SyncRow label="Drive file" value={fmt(driveInfo.sizeBytes)} />
              )}
              {driveInfo?.modifiedAt && (
                <SyncRow
                  label="Drive modified"
                  value={new Date(driveInfo.modifiedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                />
              )}
              {totalQuestions !== null && (
                <SyncRow label="Questions in DB" value={`${totalQuestions.toLocaleString()} attempts`} />
              )}
            </div>
            <div style={s.syncActions}>
              <button
                style={{ ...s.syncBtn, opacity: syncActionDisabled ? 0.5 : 1 }}
                onClick={onManualSync}
                disabled={syncActionDisabled}
              >
                {syncStatus === 'syncing' ? '⏳ Syncing…' : '↻ Sync Now'}
              </button>
              {exportControl}
              <button style={s.outBtn} onClick={onSignOut}>Sign Out</button>
            </div>
            {exportDetails}
            {syncStatus === 'error' && syncError && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>{syncError}</p>
            )}
          </>
        ) : (
          <div>
            <p style={{ ...s.rowDesc, marginBottom: '12px' }}>
              Sign in to sync your progress across devices. Data is stored privately in your Google Drive.
            </p>
            <div style={s.syncActions}>
              <button
                style={{ ...s.syncBtn, opacity: syncActionDisabled ? 0.5 : 1 }}
                onClick={onSignIn}
                disabled={syncActionDisabled}
              >
                {syncStatus === 'syncing' ? '⏳ Signing in…' : '🔑 Sign in with Google'}
              </button>
              {exportControl}
            </div>
            {exportDetails}
            {syncStatus === 'error' && syncError && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>{syncError}</p>
            )}
          </div>
        )}
      </Section>

      {/* ── AI Tutor ────────────────────────────────────────────────── */}
      <Section title="AI Tutor">
        <p style={{ ...s.rowDesc, marginBottom: '10px' }}>
          The tutor gives hints and asks guiding questions — it never gives the
          answer. Add a free Google Gemini key to turn it on (get one at{' '}
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>aistudio.google.com/apikey</span>).
          The key is stored on this device only — never synced.
        </p>
        <label style={s.row}><span style={s.rowLabel}>Gemini API key</span></label>
        <input
          type="password"
          value={aiKey}
          onChange={e => setAiKeyInput(e.target.value)}
          placeholder="Paste your API key"
          autoComplete="off"
          style={{ ...s.textInput, width: '100%' }}
        />
        <label style={{ ...s.row, marginTop: 8 }}>
          <span style={s.rowLabel}>Model</span>
          <input
            value={aiModel}
            onChange={e => setAiModelInput(e.target.value)}
            placeholder={DEFAULT_MODEL}
            style={{ ...s.textInput, width: 200 }}
          />
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {AI_MODELS.map(m => (
            <button
              key={m}
              onClick={() => setAiModelInput(m)}
              style={{ ...s.preset, ...(aiModel === m ? s.presetOn : {}) }}
            >
              {m}
            </button>
          ))}
        </div>
        <p style={{ ...s.rowDesc, marginTop: 4 }}>
          Free keys have a per-model daily limit — if one model says it's busy, try another.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button style={s.saveBtn} onClick={saveAi}>Save</button>
          <button style={{ ...s.saveBtn, background: '#0ea5e9' }} onClick={testAi} disabled={aiTest.state === 'testing' || !aiKey}>
            {aiTest.state === 'testing' ? 'Testing…' : 'Test'}
          </button>
          {getAiConfig().apiKey && <button style={s.outBtn} onClick={removeAi}>Remove key</button>}
        </div>
        {aiTest.state === 'ok' && <p style={{ color: '#15803d', fontSize: 13, marginTop: 8 }}>✓ {aiTest.msg}</p>}
        {aiTest.state === 'err' && (
          <div style={{ marginTop: 8 }}>
            <p style={{ color: '#b91c1c', fontSize: 13, margin: 0 }}>{aiTest.msg}</p>
            {aiTest.detail && (
              <p style={{ color: '#9ca3af', fontSize: 12, margin: '4px 0 0', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-word' }}>
                Details: {aiTest.detail}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* ── Testing ─────────────────────────────────────────────────── */}
      <Section title="Testing (advanced)">
        <ToggleRow
          label="Fast time (debug)"
          desc="Speeds the app clock so 1 day passes in ~20 seconds — lets you watch spaced-review (FSRS) come due, streaks build, and charts move without waiting. Turn off for normal use."
          checked={debugSpeed}
          onChange={toggleDebugSpeed}
        />
        {debugSpeed && (
          <p style={{ fontSize: 12, color: '#b45309', margin: '8px 0 0' }}>
            ⚡ Fast time is ON — review dates and stats are running ~4320× real time.
          </p>
        )}
      </Section>

      {/* ── About ───────────────────────────────────────────────────── */}
      <Section title="About">
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '13px', lineHeight: 1.9, color: '#374151' }}>
          <div data-testid="current-build">{buildLabel(currentBuild)}</div>
          <div style={{ color: '#9ca3af' }}>Built: {fmtBuildTime(__BUILD_TIME__)}</div>
          {serverBuild && (
            <div data-testid="server-build" style={{ color: '#9ca3af' }}>
              Server: {buildLabel(serverBuild)}
            </div>
          )}
        </div>
        <div style={{ marginTop: '12px' }}>
          <button
            data-testid="check-update-button"
            style={{
              ...s.syncBtn,
              opacity: updateState === 'checking' ? 0.5 : 1,
              background: updateState === 'available' ? '#16a34a' : undefined,
            }}
            onClick={updateState === 'available' ? applyUpdate : checkForUpdates}
            disabled={updateState === 'checking'}
          >
            {updateState === 'checking' ? 'Checking…' :
             updateState === 'available' ? 'Reload to update' :
             'Check for Updates'}
          </button>
          {updateState !== 'idle' && (
            <p
              data-testid="update-status"
              style={{
                fontSize: '13px', margin: '8px 0 0',
                color: updateState === 'available' ? '#16a34a'
                  : updateState === 'error' ? '#b91c1c'
                  : '#6b7280',
              }}
            >
              {updateState === 'checking' ? 'Checking for latest version…' :
               updateState === 'available' ? 'New version available — tap to reload' :
               updateState === 'none' ? 'You are on the latest version' :
               'Could not check for updates. Please try again.'}
            </p>
          )}
        </div>
      </Section>
    </div>
  );
}

function SyncRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: '14px' }}>
      <span style={{ color: '#6b7280', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#111827', fontWeight: '500', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { maxWidth: '480px', margin: '0 auto', padding: '12px 16px', fontFamily: 'system-ui, sans-serif' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' },
  back: { background: 'none', border: 'none', color: 'var(--primary)', fontSize: '16px', cursor: 'pointer', fontWeight: '500', padding: 0 },
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0 },
  section: { background: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: '13px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' },
  sectionBody: { display: 'flex', flexDirection: 'column', gap: '4px' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f9fafb', gap: '12px' },
  rowLabel: { fontSize: '15px', fontWeight: '600', color: '#111827', margin: 0 },
  rowDesc: { fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' },
  toggle: { position: 'relative', width: '46px', height: '26px', border: 'none', borderRadius: '13px', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0, padding: 0 },
  knob: { position: 'absolute', top: '2px', width: '22px', height: '22px', background: '#fff', borderRadius: '50%', transition: 'transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', display: 'block' },
  textInput: { fontSize: '15px', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '6px 10px', outline: 'none', fontFamily: 'inherit', width: '140px' },
  saveBtn: { padding: '6px 14px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  gradeBtn: { width: '40px', height: '40px', border: '2px solid #e5e7eb', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '16px', fontWeight: '600' },
  gradeBtnOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '14px', padding: '8px 0 0', fontWeight: '500', textAlign: 'left' as const },
  adjBtn: { padding: '6px 10px', border: '1.5px solid #e5e7eb', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  numInput: { width: '64px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', border: 'none', borderBottom: '2px solid var(--primary)', outline: 'none', background: 'transparent', MozAppearance: 'textfield' as never },
  themeGrid: { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' },
  themeBtn: { width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: 'pointer', transition: 'all 0.15s' },
  syncInfoGrid: { borderRadius: '8px', overflow: 'hidden' },
  syncActions: { display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'flex-start' },
  syncBtn: { flex: '1 1 140px', padding: '10px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  exportControl: { flex: '1 1 150px', minWidth: 0 },
  exportBtn: { width: '100%', padding: '9px 14px', background: '#fff', color: 'var(--primary)', border: '2px solid var(--primary)', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  exportMenu: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px', marginTop: '4px', border: '1px solid #d1d5db', borderRadius: '10px', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
  exportMenuItem: { padding: '9px 10px', border: 'none', borderRadius: '7px', background: '#f9fafb', color: '#111827', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
  exportReadyPanel: { marginTop: '10px', padding: '12px', border: '1px solid #86efac', borderRadius: '10px', background: '#f0fdf4', overflowWrap: 'anywhere' },
  outBtn: { padding: '10px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  warnBox: { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px' },
  preset: { padding: '5px 10px', border: '1.5px solid #e5e7eb', borderRadius: '16px', background: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: '500', fontFamily: 'ui-monospace, monospace' },
  presetOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)' },
};
