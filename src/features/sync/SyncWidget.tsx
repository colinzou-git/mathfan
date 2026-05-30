import type { SyncStatus } from './driveSync';
import type { AuthState } from '../auth/googleAuth';

const HAS_GOOGLE_CONFIG = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

interface Props {
  auth: AuthState;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  syncError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onSync: () => void;
}

export function SyncWidget({ auth, syncStatus, lastSyncedAt, syncError, onSignIn, onSignOut, onSync }: Props) {
  const isSyncing = syncStatus === 'syncing';

  // ── Not configured ────────────────────────────────────────────────────────
  if (!HAS_GOOGLE_CONFIG) {
    return (
      <div style={{ ...s.box, borderColor: '#fcd34d', background: '#fffbeb' }}>
        <p style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', margin: '0 0 4px' }}>
          ⚠ Google sync not configured
        </p>
        <p style={{ fontSize: '12px', color: '#78350f', margin: 0, lineHeight: 1.5 }}>
          Create a <code style={s.code}>.env</code> file in the project root with{' '}
          <code style={s.code}>VITE_GOOGLE_CLIENT_ID=…</code>, then restart the dev server.
        </p>
      </div>
    );
  }

  // ── Signed out ────────────────────────────────────────────────────────────
  if (!auth.signedIn) {
    return (
      <div style={s.box}>
        <div style={s.row}>
          <div style={s.text}>
            <p style={s.label}>Sign in to sync across devices</p>
            <p style={s.sub}>Your progress follows you everywhere.</p>
          </div>
          <button
            style={{ ...s.signInBtn, opacity: isSyncing ? 0.6 : 1 }}
            onClick={onSignIn}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <span style={s.spinner}>⏳</span>
            ) : (
              <GoogleIcon />
            )}
            {isSyncing ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

        {/* Show errors even before sign-in completes */}
        {syncStatus === 'error' && syncError && (
          <p style={s.errorMsg}>⚠ {friendlyError(syncError)}</p>
        )}
      </div>
    );
  }

  // ── Signed in ─────────────────────────────────────────────────────────────
  const syncLabel = isSyncing
    ? 'Syncing…'
    : syncStatus === 'error'
    ? 'Sync failed'
    : lastSyncedAt
    ? `Synced ${timeSince(lastSyncedAt)}`
    : 'Tap ↻ to sync';

  return (
    <div style={s.box}>
      <div style={s.row}>
        <div style={s.avatar}>
          {auth.profile?.picture
            ? <img src={auth.profile.picture} alt="" style={s.pic} referrerPolicy="no-referrer" />
            : <span style={s.initials}>{initials(auth.profile?.name ?? '?')}</span>
          }
        </div>
        <div style={s.text}>
          <p style={s.label}>{auth.profile?.name ?? auth.profile?.email ?? 'Signed in'}</p>
          <p style={{ ...s.sub, color: syncStatus === 'error' ? '#ef4444' : '#6b7280' }}>
            {syncLabel}
          </p>
        </div>
        <button
          style={{ ...s.iconBtn, opacity: isSyncing ? 0.5 : 1 }}
          onClick={onSync}
          disabled={isSyncing}
          title="Sync now"
        >↻</button>
        <button style={s.outBtn} onClick={onSignOut} title="Sign out">✕</button>
      </div>
      {syncStatus === 'error' && syncError && (
        <p style={s.errorMsg}>⚠ {friendlyError(syncError)}</p>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function friendlyError(raw: string): string {
  if (raw.includes('client_id')) return 'Google client ID missing — add VITE_GOOGLE_CLIENT_ID to .env and restart.';
  if (raw.includes('popup_closed') || raw.includes('cancelled')) return 'Sign-in cancelled. Try again.';
  if (raw.includes('popup_blocked')) return 'Popup was blocked by your browser. Allow popups for this site.';
  if (raw.includes('origin')) return 'This origin is not authorized. Add it in Google Cloud Console.';
  if (raw.includes('400') || raw.includes('401')) return 'Auth error — check your Google client ID.';
  if (raw.includes('403')) return 'Drive API not enabled. Enable it in Google Cloud Console.';
  return raw.length > 80 ? raw.slice(0, 80) + '…' : raw;
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function timeSince(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

const s: Record<string, React.CSSProperties> = {
  box: { background: '#fff', borderRadius: '12px', padding: '12px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: '16px', border: '1px solid #f3f4f6' },
  row: { display: 'flex', alignItems: 'center', gap: '10px' },
  text: { flex: 1, minWidth: 0 },
  label: { fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sub: { fontSize: '12px', color: '#6b7280', margin: '2px 0 0' },
  avatar: { flexShrink: 0 },
  pic: { width: '32px', height: '32px', borderRadius: '50%', display: 'block' },
  initials: { width: '32px', height: '32px', borderRadius: '50%', background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' },
  signInBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', flexShrink: 0, color: '#374151', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  spinner: { fontSize: '14px' },
  iconBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '4px', color: '#4f46e5', flexShrink: 0, fontWeight: 'bold' },
  outBtn: { background: 'none', border: 'none', fontSize: '14px', cursor: 'pointer', padding: '4px', color: '#9ca3af', flexShrink: 0 },
  errorMsg: { fontSize: '12px', color: '#ef4444', margin: '8px 0 0', lineHeight: 1.4 },
  code: { background: '#f3f4f6', borderRadius: '3px', padding: '1px 4px', fontFamily: 'monospace', fontSize: '11px' },
};
