import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../features/auth/googleAuth', () => ({
  getToken: vi.fn(async () => 'mock-credential'),
}));

import { pullAndMerge, syncFailureResult } from '../features/sync/driveSync';
import { CanonicalEventConflictError } from '../features/sync/canonicalEventMerge';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Drive sync error handling', () => {
  it('surfaces a recoverable canonical conflict without leaking answer payloads', () => {
    const result = syncFailureResult(new CanonicalEventConflictError({
      eventId: 'event-1', differingFields: ['studentAnswer'], localStudentId: 'local', remoteStudentId: 'remote',
    }));
    expect(result).toEqual({
      ok: false, code: 'canonical_event_conflict',
      error: 'Sync found incompatible copies of answer event-1. Local data was not changed.',
      details: { eventId: 'event-1', differingFields: ['studentAnswer'] },
    });
    expect(JSON.stringify(result)).not.toContain('local');
    expect(JSON.stringify(result)).not.toContain('remote');
  });

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
