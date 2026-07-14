import type { StudentProfile, GradeLevel } from '../../types/math';

/** Creates a random, durable identity key for a newly created learner profile. */
export function createLearnerKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 for environments without crypto.randomUUID (older WebViews, some test runners).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Trims, collapses whitespace, and lowercases a learner name for duplicate-match comparison only. */
export function normalizeLearnerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Returns existing profiles that look like they might be the same learner as `draft`,
 * based on normalized name + grade. This is a duplicate-prevention hint, not a
 * globally unique identity rule — callers must still let the user create a separate learner.
 */
export function profileCreationMatch(
  draft: { displayName: string; gradeLevel: GradeLevel },
  profiles: StudentProfile[],
): StudentProfile[] {
  const normalizedDraftName = normalizeLearnerName(draft.displayName);
  if (!normalizedDraftName) return [];
  return profiles.filter(
    p => normalizeLearnerName(p.displayName) === normalizedDraftName && p.gradeLevel === draft.gradeLevel
  );
}

/** True when a profile has a stable, synced learner identity (i.e. was created under the new identity model). */
export function hasStableLearnerIdentity(profile: StudentProfile): boolean {
  return typeof profile.learnerKey === 'string' && profile.learnerKey.length > 0;
}
