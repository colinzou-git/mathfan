import { recordPracticeAnswer } from '../learning/recordAnswer';

export interface DiagnosticWriteJob {
  id: string;
  status: 'pending' | 'saved' | 'failed';
  run: () => Promise<void>;
  lastError?: string;
}

export async function flushDiagnosticWriteJobs(jobs: DiagnosticWriteJob[]): Promise<number> {
  for (const job of jobs) {
    if (job.status === 'saved') continue;
    try {
      await job.run();
      job.status = 'saved';
      job.lastError = undefined;
    } catch (error) {
      job.status = 'failed';
      job.lastError = error instanceof Error ? error.message : 'Unknown save error';
    }
  }
  return jobs.filter(job => job.status !== 'saved').length;
}

export async function recordDiagnosticAnswerWithRetry(payload: Parameters<typeof recordPracticeAnswer>[0]): Promise<void> {
  try {
    await recordPracticeAnswer(payload);
  } catch (err) {
    console.warn('[DiagnosticSession] answer write failed, retrying...', err);
    await recordPracticeAnswer(payload);
  }
}
