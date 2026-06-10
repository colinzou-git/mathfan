// Deployed-build probe used by Settings → About → "Check for Updates".
//
// The PWA is configured with `skipWaiting: true`, so a new service worker never
// lingers in the `waiting` state — checking `registration.waiting` is therefore
// unreliable for discovering a new build. Instead we fetch /build-info.json
// (emitted at build time, never precached) and compare it against the values
// baked into the running bundle.

export interface BuildInfo {
  appVersion: string;
  gitSha: string;
  buildTime: string;
}

export type CheckResult =
  | { state: 'available'; server: BuildInfo }
  | { state: 'none'; server: BuildInfo }
  | { state: 'error'; server: null };

/**
 * Decide whether the build the browser is running differs from the build the
 * server is now serving. A new GitHub Pages deploy changes both the git SHA and
 * the build time, so either one differing means a newer build is live. The app
 * version is a weak signal (semver may not bump on every deploy) and is only
 * used as a last resort. A 'dev' SHA (local/unversioned build) is ignored so we
 * fall back to comparing build times.
 */
export function compareBuilds(current: BuildInfo, server: BuildInfo): 'available' | 'none' {
  const hasRealSha = (b: BuildInfo) => !!b.gitSha && b.gitSha !== 'dev';
  if (hasRealSha(current) && hasRealSha(server) && current.gitSha !== server.gitSha) return 'available';
  if (current.buildTime && server.buildTime && current.buildTime !== server.buildTime) return 'available';
  if (current.appVersion && server.appVersion && current.appVersion !== server.appVersion) return 'available';
  return 'none';
}

/** Fetch the deployed build-info.json with cache busting and no caching. */
export async function fetchServerBuildInfo(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BuildInfo> {
  const res = await fetchImpl(`${baseUrl}build-info.json?update-check=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`build-info.json returned ${res.status}`);
  const data: unknown = await res.json();
  if (!data || typeof data !== 'object' || typeof (data as BuildInfo).buildTime !== 'string') {
    throw new Error('build-info.json is malformed');
  }
  const d = data as Partial<BuildInfo>;
  return {
    appVersion: String(d.appVersion ?? ''),
    gitSha: String(d.gitSha ?? ''),
    buildTime: String(d.buildTime),
  };
}

/**
 * Probe the server for a newer build. Never throws: a failed fetch resolves to
 * `error` (so the UI shows a real failure) rather than a deceptive "up to date".
 */
export async function checkForUpdate(
  current: BuildInfo,
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckResult> {
  try {
    const server = await fetchServerBuildInfo(baseUrl, fetchImpl);
    return { state: compareBuilds(current, server), server };
  } catch {
    return { state: 'error', server: null };
  }
}
