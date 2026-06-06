import { describe, expect, it, vi } from 'vitest';
import { syncDiagnosticCompletionIfSignedIn } from '../features/diagnosis/diagnosticCompletion';

describe('diagnostic completion sync', () => {
  it('triggers sync only when signed in', async () => {
    const sync = vi.fn().mockResolvedValue(undefined);

    await syncDiagnosticCompletionIfSignedIn(false, sync);
    expect(sync).not.toHaveBeenCalled();

    await syncDiagnosticCompletionIfSignedIn(true, sync);
    expect(sync).toHaveBeenCalledTimes(1);
  });
});
