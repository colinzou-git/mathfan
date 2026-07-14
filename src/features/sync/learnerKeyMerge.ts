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
