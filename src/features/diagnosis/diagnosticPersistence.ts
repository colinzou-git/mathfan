import { recordPracticeAnswer } from '../learning/recordAnswer';

export async function recordDiagnosticAnswerWithRetry(payload: Parameters<typeof recordPracticeAnswer>[0]): Promise<void> {
  try {
    await recordPracticeAnswer(payload);
  } catch (err) {
    console.warn('[DiagnosticSession] answer write failed, retrying...', err);
    await recordPracticeAnswer(payload);
  }
}
