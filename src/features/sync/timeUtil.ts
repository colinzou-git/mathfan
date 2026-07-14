export function validTimeMs(value: string | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function remoteHasNewerUpdatedAt(remoteUpdatedAt: string, localUpdatedAt: string | undefined): boolean {
  const remoteMs = validTimeMs(remoteUpdatedAt);
  if (remoteMs === null) return false;
  const localMs = validTimeMs(localUpdatedAt);
  return localMs === null || remoteMs >= localMs;
}
