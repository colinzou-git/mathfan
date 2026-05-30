/**
 * Google Identity Services (GIS) sign-in for MathFan.
 *
 * Hard-won rules from the WordFan / pwa-starter-kit:
 * - Token client MUST be created before the user's tap (preload on boot).
 * - requestAccessToken() MUST run synchronously inside the gesture — NO await before it.
 * - COOP header must be `same-origin-allow-popups` (not `same-origin`) on the server.
 * - Every origin (prod domain + local HTTPS LAN) must be listed in Google Cloud Console.
 * - Keep the access token in memory only; persist only a non-sensitive "granted" flag.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const STORAGE_KEY = 'mathfan_google_auth';

export interface GoogleProfile {
  email: string;
  name: string;
  picture?: string;
  sub: string;
}

export interface AuthState {
  signedIn: boolean;
  profile: GoogleProfile | null;
  token: string | null;
}

type AuthListener = (state: AuthState) => void;

// ── Module-level state (token in memory only) ─────────────────────────────────

let tokenClient: TokenClient | null = null;
let accessToken: string | null = null;
let tokenExpiresAt = 0;
let profile: GoogleProfile | null = null;
let granted = false;
const listeners = new Set<AuthListener>();

// ── Persistence (grant flag + profile only — NEVER the token) ─────────────────

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    granted = Boolean(saved.granted);
    profile = saved.profile ?? null;
  } catch { /* ignore */ }
}

function savePersisted() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ granted, profile }));
  } catch { /* ignore */ }
}

function clearPersisted() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ── GIS script loader ─────────────────────────────────────────────────────────

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

// ── Token client init ─────────────────────────────────────────────────────────

function initTokenClient(): void {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId || !window.google?.accounts?.oauth2 || tokenClient) return;

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.appdata openid email profile',
    callback: () => {}, // set per-request
    error_callback: (err) => {
      console.warn('[MathFan auth] GIS error:', err);
    },
  });
}

// ── Token request (wraps GIS in a Promise with timeout) ──────────────────────

function requestToken(interactive: boolean): Promise<string | null> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) { resolve(null); return; }

    const timeoutId = setTimeout(() => {
      console.warn('[MathFan auth] Token request timed out');
      if (interactive) reject(new Error('Sign-in timed out — popup may have been blocked.'));
      else resolve(null);
    }, 15_000);

    tokenClient.callback = (response: TokenResponse) => {
      clearTimeout(timeoutId);
      if (response.error || !response.access_token) {
        if (!interactive) { granted = false; resolve(null); return; }
        // Surface specific GIS error codes as readable messages
        const msg = response.error === 'popup_closed_by_user'
          ? 'popup_closed: Sign-in popup was closed. Try again.'
          : response.error === 'access_denied'
          ? 'access_denied: Permission was denied.'
          : `${response.error ?? 'unknown_error'}: ${response.error_description ?? 'Sign-in failed.'}`;
        reject(new Error(msg));
        return;
      }
      accessToken = response.access_token;
      tokenExpiresAt = Date.now() + ((response.expires_in ?? 3600) - 60) * 1000;
      granted = true;
      resolve(accessToken);
    };

    if (interactive) {
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } else if (granted) {
      tokenClient.requestAccessToken({ prompt: '' });
    } else {
      clearTimeout(timeoutId);
      resolve(null);
    }
  });
}

// ── Notify listeners ──────────────────────────────────────────────────────────

function notify() {
  const state = currentState();
  listeners.forEach(fn => fn(state));
}

export function currentState(): AuthState {
  return {
    signedIn: granted && !!accessToken,
    profile,
    token: accessToken,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Call once at app startup (before the sign-in button appears). */
export async function preload(): Promise<void> {
  loadPersisted();
  try {
    await loadGisScript();
    initTokenClient();
    if (granted) {
      // Try silent refresh so returning users are immediately "signed in"
      const token = await requestToken(false);
      if (token) {
        await fetchProfile(token);
        savePersisted();
        notify();
      }
    }
  } catch (err) {
    console.warn('[MathFan auth] Preload failed:', err);
  }
}

/**
 * Call from a button onClick handler. Returns the access token or throws.
 *
 * Timing note: GIS requires requestAccessToken to run inside a user gesture.
 * preload() should have already loaded the GIS script by the time the user
 * sees the button, so there should be no await gap. If the script is still
 * loading, we await it here — this is safe on desktop Chrome and most browsers
 * (iOS Safari is stricter, which is why preload() is called eagerly at startup).
 */
export async function signIn(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID not set — add it to your .env file and restart the dev server.');
  }
  await loadGisScript();
  initTokenClient();
  if (!tokenClient) {
    throw new Error('Google Identity Services failed to initialize. Check that VITE_GOOGLE_CLIENT_ID is correct.');
  }
  // requestToken rejects with a descriptive error on failure; let it propagate
  const token = await requestToken(true);
  if (!token) throw new Error('Sign-in failed — check that this origin is authorized in Google Cloud Console.');
  await fetchProfile(token);
  savePersisted();
  notify();
  return token;
}

export function signOut(): void {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken);
  }
  accessToken = null;
  tokenExpiresAt = 0;
  profile = null;
  granted = false;
  clearPersisted();
  notify();
}

/** Get a valid token, refreshing silently if needed. Returns null if not signed in. */
export async function getToken(): Promise<string | null> {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
  if (!granted) return null;
  return requestToken(false);
}

export function onChange(fn: AuthListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── Profile fetch ─────────────────────────────────────────────────────────────

async function fetchProfile(token: string): Promise<void> {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    profile = { email: data.email, name: data.name, picture: data.picture, sub: data.sub };
  } catch { /* non-fatal */ }
}
