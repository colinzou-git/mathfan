import { useState, useEffect } from 'react';
import type { StudentProfile, StudentSettings, GradeLevel, SessionLength, ThemeName } from '../../types/math';
import { THEMES, applyTheme } from '../theme/themes';
import { useSync } from '../sync/useSync';
import { getDriveFileInfo } from '../sync/driveSync';
import { attemptRepo } from '../../db/repositories';
import { studentRepo } from '../../db/repositories';
import { isDebugSpeed, enableDebugSpeed, disableDebugSpeed } from '../time/clock';
import { getAiConfig, setAiKey, setAiModel, clearAiKey, DEFAULT_MODEL } from '../ai/aiConfig';
import { askTutor, explainAiError, aiErrorDetail } from '../ai/gemini';

interface Props {
  profile: StudentProfile;
  onUpdateProfile: (p: StudentProfile) => void;
  onBack: () => void;
  onSwitchStudent: () => void;
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

export function SettingsPage({ profile, onUpdateProfile, onBack, onSwitchStudent }: Props) {
  const settings = profile.settings;
  const { auth, syncStatus, lastSyncedAt, syncError, handleSignIn, handleSignOut, manualSync } = useSync();
  const [driveInfo, setDriveInfo] = useState<{ sizeBytes: number | null; modifiedAt: string | null } | null>(null);
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);
  const [editName, setEditName] = useState(profile.displayName);
  const [nameDirty, setNameDirty] = useState(false);
  const [debugSpeed, setDebugSpeed] = useState(isDebugSpeed());

  const toggleDebugSpeed = (on: boolean) => {
    if (on) enableDebugSpeed(); else disableDebugSpeed();
    setDebugSpeed(on);
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
  }, [profile.id, auth.signedIn]);

  const save = (patch: Partial<StudentSettings>) => {
    const updated = { ...profile, settings: { ...settings, ...patch } };
    if (patch.theme) applyTheme(patch.theme);
    onUpdateProfile(updated);
  };

  const saveName = async () => {
    if (!editName.trim() || editName.trim() === profile.displayName) { setNameDirty(false); return; }
    const updated = { ...profile, displayName: editName.trim() };
    await studentRepo.save(updated);
    onUpdateProfile(updated);
    setNameDirty(false);
  };

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
      const mins = Math.floor((Date.now() - d.getTime()) / 60000);
      if (mins < 1) return `Synced just now (${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      if (mins < 60) return `Synced ${mins}m ago (${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      return `Synced ${d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    }
    return 'Not yet synced';
  }

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
                onClick={() => onUpdateProfile({ ...profile, gradeLevel: g })}
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
          <div style={s.warnBox}>
            <p style={{ fontWeight: '600', margin: '0 0 4px' }}>Not configured</p>
            <p style={{ fontSize: '13px', margin: 0 }}>
              Add <code>VITE_GOOGLE_CLIENT_ID</code> to your <code>.env</code> file and restart the dev server.
            </p>
          </div>
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
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                style={{ ...s.syncBtn, opacity: syncStatus === 'syncing' ? 0.5 : 1 }}
                onClick={manualSync}
                disabled={syncStatus === 'syncing'}
              >
                {syncStatus === 'syncing' ? '⏳ Syncing…' : '↻ Sync Now'}
              </button>
              <button style={s.outBtn} onClick={handleSignOut}>Sign Out</button>
            </div>
            {syncStatus === 'error' && syncError && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>{syncError}</p>
            )}
          </>
        ) : (
          <div>
            <p style={{ ...s.rowDesc, marginBottom: '12px' }}>
              Sign in to sync your progress across devices. Data is stored privately in your Google Drive.
            </p>
            <button
              style={{ ...s.syncBtn, opacity: syncStatus === 'syncing' ? 0.5 : 1 }}
              onClick={handleSignIn}
              disabled={syncStatus === 'syncing'}
            >
              {syncStatus === 'syncing' ? '⏳ Signing in…' : '🔑 Sign in with Google'}
            </button>
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
  syncBtn: { flex: 1, padding: '10px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  outBtn: { padding: '10px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  warnBox: { background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px' },
  preset: { padding: '5px 10px', border: '1.5px solid #e5e7eb', borderRadius: '16px', background: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: '500', fontFamily: 'ui-monospace, monospace' },
  presetOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)' },
};
