import type { StudentProfile } from '../../types/math';
import { remoteHasNewerUpdatedAt } from './snapshot';

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
  const metadataSource = remoteHasNewerUpdatedAt(remote.updatedAt ?? '', local.updatedAt) ? remote : local;

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
