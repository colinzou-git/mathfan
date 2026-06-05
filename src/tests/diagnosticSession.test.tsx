import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DiagnosticSession } from '../features/diagnosis/DiagnosticSession';
import { recordPracticeAnswer } from '../features/learning/recordAnswer';
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

vi.mock('../features/learning/recordAnswer', () => ({
  recordPracticeAnswer: vi.fn(),
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
    vi.mocked(recordPracticeAnswer).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('waits for pending diagnostic writes before completing', async () => {
    const write = deferred<void>();
    vi.mocked(recordPracticeAnswer).mockReturnValue(write.promise);
    const onComplete = vi.fn();

    render(<DiagnosticSession studentId="student-1" onComplete={onComplete} onCancel={() => {}} />);
    await answerOnlyQuestion();

    fireEvent.click(screen.getByRole('button', { name: /see my math map/i }));
    expect(screen.getByText(/saving your results/i)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => {
      write.resolve();
      await write.promise;
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not complete when diagnostic writes fail after retry', async () => {
    vi.mocked(recordPracticeAnswer).mockRejectedValue(new Error('db unavailable'));
    const onComplete = vi.fn();

    render(<DiagnosticSession studentId="student-1" onComplete={onComplete} onCancel={() => {}} />);
    await answerOnlyQuestion();

    fireEvent.click(screen.getByRole('button', { name: /see my math map/i }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/could not save results/i)).toBeInTheDocument();
    expect(vi.mocked(recordPracticeAnswer)).toHaveBeenCalledTimes(2);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
