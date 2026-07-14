import { describe, expect, it, vi } from 'vitest';
import {
  bootstrapProfiles,
  loadActiveProfileSelection,
  saveActiveProfileSelection,
  resolveSelectedProfile,
} from '../features/profile/profileBootstrap';
import type { StudentProfile } from '../types/math';

function makeProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    id: 'p1',
    displayName: 'Alex',
    gradeLevel: 3,
    timezone: 'UTC',
    createdAt: '2026-01-01T00:00:00.000Z',
    settings: {
      audioEnabled: true,
      speechRate: 1,
      dailyGoalMinutes: 10,
      sessionLength: 10,
      autoAdvance: true,
      theme: 'indigo',
      allowTimedMode: true,
      competitionModeEnabled: false,
      parentModeEnabled: false,
    },
    ...overrides,
  };
}

describe('bootstrapProfiles', () => {
  it('goes straight to setup when local is empty and never signed in', async () => {
    const result = await bootstrapProfiles({
      loadLocalProfiles: async () => [],
      hasPersistedGrant: false,
      attemptRestore: async () => ({ ok: true }),
      loadActiveSelection: () => null,
    });
    expect(result).toEqual({ status: 'setup' });
  });

  it('restores before offering setup when local is empty but device was signed in', async () => {
    const restored = makeProfile({ id: 'restored', learnerKey: 'k1' });
    let profiles: StudentProfile[] = [];
    const attemptRestore = vi.fn(async () => {
      profiles = [restored];
      return { ok: true };
    });
    const result = await bootstrapProfiles({
      loadLocalProfiles: async () => profiles,
      hasPersistedGrant: true,
      attemptRestore,
      loadActiveSelection: () => null,
    });
    expect(attemptRestore).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'ready', profiles: [restored], selected: restored });
  });

  it('falls back to setup when restore succeeds but finds nothing', async () => {
    const result = await bootstrapProfiles({
      loadLocalProfiles: async () => [],
      hasPersistedGrant: true,
      attemptRestore: async () => ({ ok: true }),
      loadActiveSelection: () => null,
    });
    expect(result).toEqual({ status: 'setup' });
  });

  it('offers a retry instead of setup when the restore attempt fails outright', async () => {
    const result = await bootstrapProfiles({
      loadLocalProfiles: async () => [],
      hasPersistedGrant: true,
      attemptRestore: async () => ({ ok: false }),
      loadActiveSelection: () => null,
    });
    expect(result).toEqual({ status: 'restore_available' });
  });

  it('is ready immediately for a single local profile with no saved selection', async () => {
    const profile = makeProfile();
    const result = await bootstrapProfiles({
      loadLocalProfiles: async () => [profile],
      hasPersistedGrant: false,
      attemptRestore: async () => ({ ok: true }),
      loadActiveSelection: () => null,
    });
    expect(result).toEqual({ status: 'ready', profiles: [profile], selected: profile });
  });

  it('shows a chooser for multiple profiles with no saved selection', async () => {
    const profiles = [makeProfile({ id: 'a' }), makeProfile({ id: 'b' })];
    const result = await bootstrapProfiles({
      loadLocalProfiles: async () => profiles,
      hasPersistedGrant: false,
      attemptRestore: async () => ({ ok: true }),
      loadActiveSelection: () => null,
    });
    expect(result).toEqual({ status: 'choose', profiles });
  });

  it('honors a saved active selection instead of guessing all[0]', async () => {
    const profiles = [makeProfile({ id: 'a' }), makeProfile({ id: 'b', learnerKey: 'k-b' })];
    const result = await bootstrapProfiles({
      loadLocalProfiles: async () => profiles,
      hasPersistedGrant: false,
      attemptRestore: async () => ({ ok: true }),
      loadActiveSelection: () => ({ learnerKey: 'k-b' }),
    });
    expect(result).toEqual({ status: 'ready', profiles, selected: profiles[1] });
  });
});

describe('resolveSelectedProfile', () => {
  const profiles = [
    makeProfile({ id: 'legacy' }),
    makeProfile({ id: 'stable', learnerKey: 'k1' }),
  ];

  it('resolves by learnerKey first', () => {
    expect(resolveSelectedProfile(profiles, { learnerKey: 'k1' })?.id).toBe('stable');
  });

  it('falls back to id for legacy profiles', () => {
    expect(resolveSelectedProfile(profiles, { id: 'legacy' })?.id).toBe('legacy');
  });

  it('returns undefined when nothing matches', () => {
    expect(resolveSelectedProfile(profiles, { learnerKey: 'missing' })).toBeUndefined();
  });

  it('returns undefined when there is no saved selection', () => {
    expect(resolveSelectedProfile(profiles, null)).toBeUndefined();
  });
});

describe('active profile selection persistence', () => {
  it('round-trips a stable-identity profile via learnerKey', () => {
    localStorage.clear();
    saveActiveProfileSelection(makeProfile({ id: 'a', learnerKey: 'k1' }));
    expect(loadActiveProfileSelection()).toEqual({ learnerKey: 'k1' });
  });

  it('round-trips a legacy profile via id', () => {
    localStorage.clear();
    saveActiveProfileSelection(makeProfile({ id: 'legacy-id' }));
    expect(loadActiveProfileSelection()).toEqual({ id: 'legacy-id' });
  });

  it('returns null when nothing is saved', () => {
    localStorage.clear();
    expect(loadActiveProfileSelection()).toBeNull();
  });
});
