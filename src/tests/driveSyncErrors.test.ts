import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../features/auth/googleAuth', () => ({
  getToken: vi.fn(async () => 'mock-credential'),
}));

import { pullAndMerge } from '../features/sync/driveSync';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Drive sync error handling', () => {
  it('reports a list failure instead of treating it as no remote file', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await pullAndMerge();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Drive LIST failed: 503');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a failed snapshot download instead of silently succeeding', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ files: [{ id: 'remote-1', modifiedTime: '2026-06-18T00:00:00.000Z' }] }),
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 502 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await pullAndMerge();

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Drive download failed: 502');
  });

  it('uses the newest sync file when duplicates already exist', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ files: [
          { id: 'older-file', modifiedTime: '2026-06-16T00:00:00.000Z' },
          { id: 'newer-file', modifiedTime: '2026-06-18T00:00:00.000Z' },
        ] }),
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 502 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await pullAndMerge();

    expect(String(fetchMock.mock.calls[1][0])).toContain('/newer-file?alt=media');
  });
});
