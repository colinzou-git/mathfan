import { describe, expect, it } from 'vitest';
import { compareBuilds, checkForUpdate, type BuildInfo } from '../features/settings/updateCheck';

const current: BuildInfo = { appVersion: '1.2.0', gitSha: 'aaaaaaa1111', buildTime: '2026-06-01T10:00:00.000Z' };

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('compareBuilds', () => {
  it('reports none when the server build is identical', () => {
    expect(compareBuilds(current, { ...current })).toBe('none');
  });

  it('reports available when the git SHA differs', () => {
    expect(compareBuilds(current, { ...current, gitSha: 'bbbbbbb2222' })).toBe('available');
  });

  it('reports available when only the build time differs (same SHA-less build)', () => {
    const dev: BuildInfo = { appVersion: '1.2.0', gitSha: 'dev', buildTime: '2026-06-01T10:00:00.000Z' };
    expect(compareBuilds(dev, { ...dev, buildTime: '2026-06-02T10:00:00.000Z' })).toBe('available');
  });

  it('ignores a dev SHA on one side and falls back to build time', () => {
    // Same build time + one side is 'dev' → not a real SHA mismatch → none.
    expect(compareBuilds(current, { ...current, gitSha: 'dev' })).toBe('none');
  });

  it('reports available when the app version differs as a last resort', () => {
    const sameShaAndTime = { appVersion: '9.9.9', gitSha: current.gitSha, buildTime: current.buildTime };
    expect(compareBuilds(current, sameShaAndTime)).toBe('available');
  });
});

describe('checkForUpdate', () => {
  it('returns available for a newer deployed build', async () => {
    const fetchImpl = async () =>
      jsonResponse({ appVersion: '1.3.0', gitSha: 'ccccccc3333', buildTime: '2026-07-01T10:00:00.000Z' });
    const result = await checkForUpdate(current, '/', fetchImpl as typeof fetch);
    expect(result.state).toBe('available');
    expect(result.server?.gitSha).toBe('ccccccc3333');
  });

  it('returns none when the deployed build matches', async () => {
    const fetchImpl = async () => jsonResponse({ ...current });
    const result = await checkForUpdate(current, '/', fetchImpl as typeof fetch);
    expect(result.state).toBe('none');
  });

  it('returns error (never "up to date") when the fetch fails', async () => {
    const fetchImpl = async () => { throw new Error('network down'); };
    const result = await checkForUpdate(current, '/', fetchImpl as typeof fetch);
    expect(result.state).toBe('error');
    expect(result.server).toBeNull();
  });

  it('returns error when build-info.json responds non-OK', async () => {
    const fetchImpl = async () => jsonResponse({}, false, 404);
    const result = await checkForUpdate(current, '/', fetchImpl as typeof fetch);
    expect(result.state).toBe('error');
  });

  it('returns error when build-info.json is malformed', async () => {
    const fetchImpl = async () => jsonResponse({ nope: true });
    const result = await checkForUpdate(current, '/', fetchImpl as typeof fetch);
    expect(result.state).toBe('error');
  });

  it('passes cache: no-store and a cache-busting query param', async () => {
    let calledUrl = '';
    let calledInit: RequestInit | undefined;
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calledUrl = String(url);
      calledInit = init;
      return jsonResponse({ ...current });
    };
    await checkForUpdate(current, '/mathfan/', fetchImpl as typeof fetch);
    expect(calledUrl).toContain('/mathfan/build-info.json?update-check=');
    expect(calledInit?.cache).toBe('no-store');
  });
});
