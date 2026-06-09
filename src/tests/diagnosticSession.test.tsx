import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DiagnosticSession } from '../features/diagnosis/DiagnosticSession';
import { recordDiagnosticAnswerWithRetry } from '../features/diagnosis/diagnosticPersistence';
import { itemStateRepo } from '../db/repositories';

const diagnosticItem = {
  id: 'MUL_2x4',
  skillId: 'SKILL_MUL_FACTS',
  itemType: 'multiplication_fact' as const,
  prompt: '2 x 4',
  answer: 8,
  answerInput: 'numeric' as const,
  tags: ['multiplication', 'table_2', 'table_4'],
  difficulty: 0.2,
  factA: 2,
  factB: 4,
};

vi.mock('../features/diagnosis/diagnosticPlanner', () => ({
  buildDiagnosticPlan: (sessionId: string) => ({
    sessionId,
    items: [diagnosticItem],
    description: 'Quick check of times tables and division facts.',
  }),
}));

vi.mock('../features/diagnosis/diagnosticPersistence', () => ({
  recordDiagnosticAnswerWithRetry: vi.fn(),
}));

vi.mock('../db/repositories', () => ({
  itemStateRepo: {
    get: vi.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function answerOnlyQuestion() {
  fireEvent.click(screen.getByRole('button', { name: /let's go/i }));
  fireEvent.click(screen.getByRole('button', { name: '8' }));
  fireEvent.click(screen.getAllByRole('button', { name: /check/i })[0]);
  await act(async () => {
    vi.advanceTimersByTime(1200);
  });
  expect(screen.getByText(/great work/i)).toBeInTheDocument();
}

describe('DiagnosticSession persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(itemStateRepo.get).mockResolvedValue(undefined);
    vi.mocked(recordDiagnosticAnswerWithRetry).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('auto-persists writes when last question transitions to done without button click', async () => {
    vi.mocked(recordDiagnosticAnswerWithRetry).mockResolvedValue(undefined);

    render(<DiagnosticSession studentId="student-1" onComplete={vi.fn()} onCancel={() => {}} />);
    await answerOnlyQuestion();

    // Persistence triggered automatically — no button click needed
    expect(vi.mocked(recordDiagnosticAnswerWithRetry)).toHaveBeenCalledTimes(1);
  });

  it('shows saving indicator while auto-save is in progress', async () => {
    const write = deferred<void>();
    vi.mocked(recordDiagnosticAnswerWithRetry).mockReturnValue(write.promise);

    render(<DiagnosticSession studentId="student-1" onComplete={vi.fn()} onCancel={() => {}} />);
    await answerOnlyQuestion();

    // Auto-flush started immediately — saving indicator is visible
    expect(screen.getByText(/saving your results/i)).toBeInTheDocument();

    // Resolve the write and confirm "See my Math Map" button appears
    await act(async () => {
      write.resolve();
      await write.promise;
    });
    expect(screen.getByRole('button', { name: /see my math map/i })).toBeInTheDocument();
  });

  it('does not duplicate writes when "See my Math Map" is clicked after auto-save', async () => {
    vi.mocked(recordDiagnosticAnswerWithRetry).mockResolvedValue(undefined);
    const onComplete = vi.fn();

    render(<DiagnosticSession studentId="student-1" onComplete={onComplete} onCancel={() => {}} />);
    await answerOnlyQuestion();

    // Auto-save already completed; click the button to navigate
    fireEvent.click(screen.getByRole('button', { name: /see my math map/i }));
    await act(async () => { await Promise.resolve(); });

    expect(onComplete).toHaveBeenCalledTimes(1);
    // Only the auto-flush wrote; no second call on button click
    expect(vi.mocked(recordDiagnosticAnswerWithRetry)).toHaveBeenCalledTimes(1);
  });

  it('shows error state when auto-save fails', async () => {
    vi.mocked(recordDiagnosticAnswerWithRetry).mockRejectedValue(new Error('db unavailable'));
    const onComplete = vi.fn();

    render(<DiagnosticSession studentId="student-1" onComplete={onComplete} onCancel={() => {}} />);
    await answerOnlyQuestion();

    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/could not save results/i)).toBeInTheDocument();
    expect(vi.mocked(recordDiagnosticAnswerWithRetry)).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('retries when the first payload construction fails, not just the write', async () => {
    // The thunk reads itemStateRepo.get before building the payload. If that read
    // throws on the first flush, "Try again" must rebuild the payload from scratch
    // and succeed — the old design captured a settled (rejected) promise and could
    // never recover from a construction-time failure.
    vi.mocked(itemStateRepo.get)
      .mockRejectedValueOnce(new Error('itemState read failed'))
      .mockResolvedValue(undefined);
    vi.mocked(recordDiagnosticAnswerWithRetry).mockResolvedValue(undefined);
    const onComplete = vi.fn();

    render(<DiagnosticSession studentId="student-1" onComplete={onComplete} onCancel={() => {}} />);
    await answerOnlyQuestion();

    // Auto-flush failed during payload construction — the write was never attempted.
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/could not save results/i)).toBeInTheDocument();
    expect(vi.mocked(recordDiagnosticAnswerWithRetry)).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();

    // Retry — the read now succeeds, payload is rebuilt, and the write goes through.
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await act(async () => { await Promise.resolve(); });
    expect(vi.mocked(recordDiagnosticAnswerWithRetry)).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('accepts keyboard digit input and submits on Enter', async () => {
    vi.mocked(recordDiagnosticAnswerWithRetry).mockResolvedValue(undefined);

    render(<DiagnosticSession studentId="student-1" onComplete={vi.fn()} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /let's go/i }));

    // Type the answer with the keyboard, including a Backspace correction.
    fireEvent.keyDown(window, { key: '9' });
    fireEvent.keyDown(window, { key: 'Backspace' });
    fireEvent.keyDown(window, { key: '8' });
    fireEvent.keyDown(window, { key: 'Enter' });

    await act(async () => { vi.advanceTimersByTime(1200); });

    expect(screen.getByText(/great work/i)).toBeInTheDocument();
    expect(vi.mocked(recordDiagnosticAnswerWithRetry)).toHaveBeenCalledTimes(1);
  });

  it('exits via Escape during an active question', () => {
    const onCancel = vi.fn();

    render(<DiagnosticSession studentId="student-1" onComplete={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /let's go/i }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('retries failed diagnostic writes when "Try again" is clicked', async () => {
    vi.mocked(recordDiagnosticAnswerWithRetry)
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockResolvedValueOnce(undefined);
    const onComplete = vi.fn();

    render(<DiagnosticSession studentId="student-1" onComplete={onComplete} onCancel={() => {}} />);
    await answerOnlyQuestion();

    // Auto-flush failed — error shown
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/could not save results/i)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    // Retry — should succeed and call onComplete
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await act(async () => { await Promise.resolve(); });
    expect(vi.mocked(recordDiagnosticAnswerWithRetry)).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
