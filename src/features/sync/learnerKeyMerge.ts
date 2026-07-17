import type { StudentProfile } from '../../types/math';
import { validTimeMs } from './timeUtil';

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableValue(child)]));
}

/** Stable metadata-only tie breaker for two revisions of the same profile row. */
export function stableProfileFingerprint(profile: StudentProfile): string {
  const metadata = Object.fromEntries(Object.entries(profile)
    .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key)));
  return JSON.stringify(stableValue(metadata));
}

export function compareProfileRevision(a: StudentProfile, b: StudentProfile): number {
  const aUpdated = validTimeMs(a.updatedAt);
  const bUpdated = validTimeMs(b.updatedAt);
  if (aUpdated !== null || bUpdated !== null) {
    if (aUpdated === null) return -1;
    if (bUpdated === null) return 1;
    if (aUpdated !== bUpdated) return aUpdated - bUpdated;
  } else {
    const createdDifference = (validTimeMs(a.createdAt) ?? 0) - (validTimeMs(b.createdAt) ?? 0);
    if (createdDifference) return createdDifference;
  }
  return stableProfileFingerprint(a).localeCompare(stableProfileFingerprint(b));
}

function mergeSameIdProfile(older: StudentProfile, newer: StudentProfile): StudentProfile {
  return {
    ...older,
    ...newer,
    id: older.id,
    learnerKey: newer.learnerKey ?? older.learnerKey,
    settings: newer.settings ?? older.settings,
    createdAt: [older.createdAt, newer.createdAt].filter(Boolean).sort()[0],
    updatedAt: newer.updatedAt ?? older.updatedAt,
  };
}

/** Collapses exact IDs by revision before learner-key aliasing is considered. */
export function mergeProfilesByExactId(
  localProfiles: StudentProfile[],
  remoteProfiles: StudentProfile[],
): StudentProfile[] {
  const byId = new Map<string, StudentProfile>();
  for (const profile of [...localProfiles, ...remoteProfiles]) {
    const existing = byId.get(profile.id);
    if (!existing) { byId.set(profile.id, profile); continue; }
    const comparison = compareProfileRevision(existing, profile);
    byId.set(profile.id, comparison <= 0
      ? mergeSameIdProfile(existing, profile)
      : mergeSameIdProfile(profile, existing));
  }
  return [...byId.values()];
}

/**
 * Resolves two profile rows that share the same `learnerKey` but different `id`s
 * (e.g. a local placeholder created before a Drive restore completed, and the
 * real synced record). Only called when both records share a learnerKey — never
 * applied to two legacy profiles that lack one.
 *
 * Rules (see issue #25):
 *  - prefer the record already referenced by answer data;
 *  - preserve the selected record's id;
 *  - merge only profile metadata/settings using the existing updated-data rule.
 */
export function resolveLearnerKeyDuplicate(
  local: StudentProfile,
  remote: StudentProfile,
  eventCountByStudentId: Record<string, number>
): StudentProfile {
  const localEvents = eventCountByStudentId[local.id] ?? 0;
  const remoteEvents = eventCountByStudentId[remote.id] ?? 0;
  const base = remoteEvents > localEvents ? remote : local;
  const metadataSource = compareProfileRevision(local, remote) < 0 ? remote : local;

  return {
    ...base,
    displayName: metadataSource.displayName,
    gradeLevel: metadataSource.gradeLevel,
    timezone: metadataSource.timezone,
    settings: metadataSource.settings,
    updatedAt: metadataSource.updatedAt,
  };
}

export type StudentIdAliasMap = Map<string, string>;

/** Chooses one stable owner ID for every duplicated learnerKey before child rows are merged. */
export function resolveCanonicalStudentIds(
  localProfiles: StudentProfile[],
  remoteProfiles: StudentProfile[],
  evidenceCounts: Record<string, number>,
): StudentIdAliasMap {
  const aliases: StudentIdAliasMap = new Map();
  const localIds = new Set(localProfiles.map(profile => profile.id));
  const groups = new Map<string, StudentProfile[]>();
  for (const profile of [...localProfiles, ...remoteProfiles]) {
    aliases.set(profile.id, profile.id);
    if (!profile.learnerKey) continue;
    const group = groups.get(profile.learnerKey) ?? [];
    if (!group.some(existing => existing.id === profile.id)) group.push(profile);
    groups.set(profile.learnerKey, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const canonical = [...group].sort((a, b) =>
      (evidenceCounts[b.id] ?? 0) - (evidenceCounts[a.id] ?? 0)
      || Number(localIds.has(b.id)) - Number(localIds.has(a.id))
      || compareProfileRevision(b, a)
      || a.id.localeCompare(b.id)
    )[0].id;
    for (const profile of group) aliases.set(profile.id, canonical);
  }
  return aliases;
}

export function remapStudentId<T extends { studentId: string }>(record: T, aliases: StudentIdAliasMap): T {
  const studentId = aliases.get(record.studentId) ?? record.studentId;
  return studentId === record.studentId ? record : { ...record, studentId };
}
