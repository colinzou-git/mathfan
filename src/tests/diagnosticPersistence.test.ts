import { describe, expect, it, vi } from 'vitest';
import { flushDiagnosticWriteJobs, type DiagnosticWriteJob } from '../features/diagnosis/diagnosticPersistence';

describe('diagnostic write job flushing', () => {
  it('retains partial success and retries only the unsaved job', async () => {
    const runs = [vi.fn(), vi.fn(), vi.fn()];
    runs[0].mockResolvedValue(undefined);
    runs[1].mockResolvedValue(undefined);
    runs[2].mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined);
    const jobs: DiagnosticWriteJob[] = runs.map((run, index) => ({ id: `job-${index}`, status: 'pending', run }));

    expect(await flushDiagnosticWriteJobs(jobs)).toBe(1);
    expect(jobs.map(job => job.status)).toEqual(['saved', 'saved', 'failed']);
    expect(await flushDiagnosticWriteJobs(jobs)).toBe(0);
    expect(runs.map(run => run.mock.calls.length)).toEqual([1, 1, 2]);
    expect(jobs.map(job => job.status)).toEqual(['saved', 'saved', 'saved']);
  });
});
