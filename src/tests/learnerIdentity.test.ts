import { describe, expect, it } from 'vitest';
import {
  createLearnerKey,
  normalizeLearnerName,
  profileCreationMatch,
  hasStableLearnerIdentity,
} from '../features/profile/learnerIdentity';
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

describe('createLearnerKey', () => {
  it('produces unique keys', () => {
    const keys = new Set(Array.from({ length: 50 }, () => createLearnerKey()));
    expect(keys.size).toBe(50);
  });

  it('produces a UUID-shaped string', () => {
    const key = createLearnerKey();
    expect(key).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('normalizeLearnerName', () => {
  it('trims, collapses whitespace, and lowercases', () => {
    expect(normalizeLearnerName('  Alex   Smith  ')).toBe('alex smith');
  });

  it('is case-insensitive', () => {
    expect(normalizeLearnerName('ALEX')).toBe(normalizeLearnerName('alex'));
  });
});

describe('profileCreationMatch', () => {
  it('matches on normalized name + grade', () => {
    const existing = [makeProfile({ id: 'a', displayName: 'Alex ', gradeLevel: 3 })];
    const matches = profileCreationMatch({ displayName: 'alex', gradeLevel: 3 }, existing);
    expect(matches.map(p => p.id)).toEqual(['a']);
  });

  it('does not match different grade', () => {
    const existing = [makeProfile({ id: 'a', displayName: 'Alex', gradeLevel: 3 })];
    const matches = profileCreationMatch({ displayName: 'Alex', gradeLevel: 4 }, existing);
    expect(matches).toEqual([]);
  });

  it('does not match different name', () => {
    const existing = [makeProfile({ id: 'a', displayName: 'Alex', gradeLevel: 3 })];
    const matches = profileCreationMatch({ displayName: 'Sam', gradeLevel: 3 }, existing);
    expect(matches).toEqual([]);
  });

  it('returns multiple matches when several profiles share name+grade', () => {
    const existing = [
      makeProfile({ id: 'a', displayName: 'Alex', gradeLevel: 3 }),
      makeProfile({ id: 'b', displayName: 'alex', gradeLevel: 3 }),
    ];
    const matches = profileCreationMatch({ displayName: 'Alex', gradeLevel: 3 }, existing);
    expect(matches.map(p => p.id).sort()).toEqual(['a', 'b']);
  });

  it('returns no matches for an empty name', () => {
    const existing = [makeProfile({ id: 'a', displayName: 'Alex', gradeLevel: 3 })];
    expect(profileCreationMatch({ displayName: '   ', gradeLevel: 3 }, existing)).toEqual([]);
  });
});

describe('hasStableLearnerIdentity', () => {
  it('is true when learnerKey is present', () => {
    expect(hasStableLearnerIdentity(makeProfile({ learnerKey: 'k1' }))).toBe(true);
  });

  it('is false for legacy profiles without a learnerKey', () => {
    expect(hasStableLearnerIdentity(makeProfile())).toBe(false);
  });
});
