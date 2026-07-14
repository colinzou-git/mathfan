import type { StudentProfile } from '../../types/math';

export type ProfileBootstrapResult =
  | { status: 'ready'; profiles: StudentProfile[]; selected: StudentProfile }
  | { status: 'choose'; profiles: StudentProfile[] }
  | { status: 'setup' }
  | { status: 'restore_available' };

export interface ActiveProfileSelection {
  learnerKey?: string;
  id?: string;
}

const ACTIVE_SELECTION_KEY = 'mathfan.activeLearnerKey';

/** Reads the last-selected profile from localStorage. Prefers the stable learnerKey; falls back to id for legacy profiles. */
export function loadActiveProfileSelection(): ActiveProfileSelection | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SELECTION_KEY);
    if (!raw) return null;
    if (raw.startsWith('key:')) return { learnerKey: raw.slice(4) };
    if (raw.startsWith('id:')) return { id: raw.slice(3) };
    return null;
  } catch {
    return null;
  }
}

export function saveActiveProfileSelection(profile: StudentProfile): void {
  try {
    const value = profile.learnerKey ? `key:${profile.learnerKey}` : `id:${profile.id}`;
    localStorage.setItem(ACTIVE_SELECTION_KEY, value);
  } catch {
    /* ignore */
  }
}

/** Resolves a saved selection against the current profile list. Returns undefined if the saved selection no longer matches anything. */
export function resolveSelectedProfile(
  profiles: StudentProfile[],
  saved: ActiveProfileSelection | null
): StudentProfile | undefined {
  if (!saved) return undefined;
  if (saved.learnerKey) {
    const byKey = profiles.find(p => p.learnerKey === saved.learnerKey);
    if (byKey) return byKey;
  }
  if (saved.id) {
    const byId = profiles.find(p => p.id === saved.id);
    if (byId) return byId;
  }
  return undefined;
}

export interface BootstrapProfilesArgs {
  loadLocalProfiles: () => Promise<StudentProfile[]>;
  /** Synchronous "was this device signed in before" signal — see googleAuth.hasPersistedGrant(). */
  hasPersistedGrant: boolean;
  /** Performs a Drive pull + merge into local storage. Only called when local storage is empty and a grant was persisted. */
  attemptRestore: () => Promise<{ ok: boolean }>;
  loadActiveSelection: () => ActiveProfileSelection | null;
}

/**
 * Decides what the app should show at startup: a chooser, plain setup, a restore
 * prompt, or a ready-to-go profile — without ever guessing `all[0]`.
 */
export async function bootstrapProfiles(args: BootstrapProfilesArgs): Promise<ProfileBootstrapResult> {
  let profiles = await args.loadLocalProfiles();

  if (profiles.length === 0) {
    if (!args.hasPersistedGrant) {
      return { status: 'setup' };
    }
    const result = await args.attemptRestore();
    profiles = await args.loadLocalProfiles();
    if (profiles.length === 0) {
      return result.ok ? { status: 'setup' } : { status: 'restore_available' };
    }
  }

  const selection = args.loadActiveSelection();
  const selected = resolveSelectedProfile(profiles, selection);
  if (selected) return { status: 'ready', profiles, selected };
  if (profiles.length === 1) return { status: 'ready', profiles, selected: profiles[0] };
  return { status: 'choose', profiles };
}
