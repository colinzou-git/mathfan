import { useState, useEffect, useCallback } from 'react';
import { currentState, onChange, signIn, signOut, preload } from '../auth/googleAuth';
import { pullAndMerge, pushLocal, syncBothWays } from './driveSync';
import type { AuthState } from '../auth/googleAuth';
import type { SyncStatus } from './driveSync';

export interface SyncState {
  auth: AuthState;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  syncError: string | null;
}

const SYNC_AT_KEY = 'mathfan_last_synced';

export function useSync() {
  const [auth, setAuth] = useState<AuthState>(currentState);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(
    () => localStorage.getItem(SYNC_AT_KEY)
  );
  const [syncError, setSyncError] = useState<string | null>(null);

  // Subscribe to auth changes
  useEffect(() => {
    return onChange(setAuth);
  }, []);

  const recordSync = (at: string) => {
    setLastSyncedAt(at);
    localStorage.setItem(SYNC_AT_KEY, at);
  };

  const handleSignIn = useCallback(async () => {
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      await signIn();
      // After sign-in: pull first (get their data from other devices), then push local
      const result = await syncBothWays();
      if (result.ok && result.syncedAt) recordSync(result.syncedAt);
      setSyncStatus(result.ok ? 'synced' : 'error');
      if (!result.ok) setSyncError(result.error ?? 'Sync failed');
    } catch (err) {
      setSyncStatus('error');
      setSyncError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  }, []);

  const handleSignOut = useCallback(() => {
    signOut();
    setSyncStatus('idle');
    setSyncError(null);
  }, []);

  /** Push local data to Drive. Call after a session completes. */
  const pushAfterSession = useCallback(async () => {
    if (!currentState().signedIn) return;
    const result = await pushLocal();
    if (result.ok && result.syncedAt) recordSync(result.syncedAt);
  }, []);

  /** Pull from Drive and merge. Call manually or on app focus. */
  const pull = useCallback(async () => {
    if (!currentState().signedIn) return;
    setSyncStatus('syncing');
    setSyncError(null);
    const result = await pullAndMerge();
    if (result.ok && result.syncedAt) recordSync(result.syncedAt);
    setSyncStatus(result.ok ? 'synced' : 'error');
    if (!result.ok) setSyncError(result.error ?? 'Sync failed');
  }, []);

  const manualSync = useCallback(async () => {
    if (!currentState().signedIn) return;
    setSyncStatus('syncing');
    setSyncError(null);
    const result = await syncBothWays();
    if (result.ok && result.syncedAt) recordSync(result.syncedAt);
    setSyncStatus(result.ok ? 'synced' : 'error');
    if (!result.ok) setSyncError(result.error ?? 'Sync failed');
  }, []);

  return {
    auth,
    syncStatus,
    lastSyncedAt,
    syncError,
    handleSignIn,
    handleSignOut,
    pushAfterSession,
    pull,
    manualSync,
  };
}

/** Initialize auth on app start (silent refresh if previously signed in). */
export { preload as initAuth };
