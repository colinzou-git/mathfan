import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DiagnosticSession } from '../features/diagnosis/DiagnosticSession';
import {
  DiagnosticStateConflictError,
  persistDiagnosticAnswerProposal,
  retryDiagnosticWriteJob,
} from '../features/diagnosis/diagnosticPersistence';
import { itemStateRepo } from '../db/repositories';
import type { PracticeItem } from '../types/math';

const { planItems } = vi.hoisted(() => ({ planItems: [] as PracticeItem[] }));
const firstItem: PracticeItem = {
  id: 'MUL_2x4', skillId: 'SKILL_MUL_FACTS', itemType: 'multiplication_fact',
  prompt: '2 x 4', answer: 8, answerInput: 'numeric', tags: ['multiplication'],
  difficulty: 0.2, factA: 2, factB: 4,
};
const secondItem: PracticeItem = {
  id: 'MUL_3x4', skillId: 'SKILL_MUL_FACTS', itemType: 'multiplication_fact',
  prompt: '3 x 4', answer: 12, answerInput: 'numeric', tags: ['multiplication'],
  difficulty: 0.2, factA: 3, factB: 4,
};

vi.mock('../features/diagnosis/diagnosticPlanner', () => ({
  buildDiagnosticPlan: (sessionId: string) => ({
    sessionId,
    items: [...planItems],
    description: 'Quick check of times tables and division facts.',
  }),
}));
vi.mock('../features/diagnosis/diagnosticPersistence', async importOriginal => ({
  ...(await importOriginal<typeof import('../features/diagnosis/diagnosticPersistence')>()),
  persistDiagnosticAnswerProposal: vi.fn(),
  retryDiagnosticWriteJob: vi.fn(),
}));
vi.mock('../db/repositories', () => ({ itemStateRepo: { get: vi.fn() } }));

async function startAndSubmit(answer: string) {
  fireEvent.click(screen.getByRole('button', { name: /let's go/i }));
  for (const digit of answer) fireEvent.click(screen.getByRole('button', { name: digit }));
  fireEvent.click(screen.getAllByRole('button', { name: /check/i })[0]);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

async function advanceFeedback() {
  await act(async () => { vi.advanceTimersByTime(1200); });
}

describe('DiagnosticSession immediate immutable persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    planItems.splice(0, planItems.length, firstItem);
    vi.mocked(itemStateRepo.get).mockReset().mockResolvedValue(undefined);
    vi.mocked(persistDiagnosticAnswerProposal).mockReset().mockResolvedValue(undefined);
    vi.mocked(retryDiagnosticWriteJob).mockReset().mockImplementation(async job => {
      job.status = 'saved';
      job.lastError = undefined;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('persists question 1 before question 2 is displayed', async () => {
    planItems.push(secondItem);
    render(<DiagnosticSession studentId="student-1" onComplete={vi.fn()} onCancel={vi.fn()} />);
    await startAndSubmit('8');

    expect(persistDiagnosticAnswerProposal).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/correct/i)).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await advanceFeedback();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('retains every completed answer when unmounted mid-session', async () => {
    planItems.push(secondItem);
    const view = render(<DiagnosticSession studentId="student-1" onComplete={vi.fn()} onCancel={vi.fn()} />);
    await startAndSubmit('8');
    view.unmount();
    expect(persistDiagnosticAnswerProposal).toHaveBeenCalledTimes(1);
    expect(vi.mocked(persistDiagnosticAnswerProposal).mock.calls[0][0].event.itemId).toBe(firstItem.id);
  });

  it('keeps the learner on the question and reports the exact unsaved count after failure', async () => {
    vi.mocked(persistDiagnosticAnswerProposal).mockRejectedValueOnce(new Error('disk unavailable'));
    render(<DiagnosticSession studentId="student-1" onComplete={vi.fn()} onCancel={vi.fn()} />);
    await startAndSubmit('8');

    expect(screen.getByRole('alert')).toHaveTextContent('1 answer remain unsaved');
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.queryByText(/great work/i)).not.toBeInTheDocument();
  });

  it('retries the same immutable proposal and advances exactly once after success', async () => {
    vi.mocked(persistDiagnosticAnswerProposal).mockRejectedValueOnce(new Error('disk unavailable'));
    render(<DiagnosticSession studentId="student-1" onComplete={vi.fn()} onCancel={vi.fn()} />);
    await startAndSubmit('8');
    const original = vi.mocked(persistDiagnosticAnswerProposal).mock.calls[0][0];

    fireEvent.click(screen.getByRole('button', { name: /try saving again/i }));
    await act(async () => { await Promise.resolve(); });
    expect(retryDiagnosticWriteJob).toHaveBeenCalledTimes(1);
    expect(vi.mocked(retryDiagnosticWriteJob).mock.calls[0][0].proposal).toBe(original);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/correct/i)).toBeInTheDocument();
    await advanceFeedback();
    expect(screen.getByText(/great work/i)).toBeInTheDocument();
  });

  it('uses fixed IDs and timestamps and synchronously blocks double submission', async () => {
    const fixed = new Date('2026-07-16T08:30:00.000Z');
    vi.setSystemTime(fixed);
    render(<DiagnosticSession studentId="student-1" onComplete={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /let's go/i }));
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    const check = screen.getAllByRole('button', { name: /check/i })[0];
    fireEvent.click(check);
    fireEvent.click(check);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(persistDiagnosticAnswerProposal).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(persistDiagnosticAnswerProposal).mock.calls[0][0];
    expect(saved.event.id).toBeTruthy();
    expect(saved.attempt.id).toBeTruthy();
    expect(saved.event.createdAt).toBe(fixed.toISOString());
    expect(saved.attempt.createdAt).toBe(fixed.toISOString());
    expect(saved.stateAfter?.lastSeenAt).toBe(fixed.toISOString());
  });

  it('requires explicit resubmission with new IDs and the latest state after a conflict', async () => {
    vi.mocked(persistDiagnosticAnswerProposal)
      .mockRejectedValueOnce(new DiagnosticStateConflictError('fact:mul:2x4'))
      .mockResolvedValueOnce(undefined);
    vi.mocked(itemStateRepo.get)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        studentId: 'student-1', cardKey: 'fact:mul:2x4', lastItemId: firstItem.id,
        skillId: firstItem.skillId, attemptCount: 4, correctCount: 3, lastCorrect: true,
        lastLatencyMs: 1000, medianLatencyMs: 1000, ease: 2.5, stabilityDays: 2,
        difficulty: firstItem.difficulty, reps: 4, lapses: 1, masteryLevel: 'learning', mistakePatterns: [],
      });
    render(<DiagnosticSession studentId="student-1" onComplete={vi.fn()} onCancel={vi.fn()} />);
    await startAndSubmit('8');
    const stale = vi.mocked(persistDiagnosticAnswerProposal).mock.calls[0][0];

    expect(screen.getByRole('alert')).toHaveTextContent(/changed in another session/i);
    fireEvent.click(screen.getByRole('button', { name: /reload question/i }));
    expect(persistDiagnosticAnswerProposal).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole('button', { name: /check/i })[0]);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const fresh = vi.mocked(persistDiagnosticAnswerProposal).mock.calls[1][0];
    expect(fresh.event.id).not.toBe(stale.event.id);
    expect(fresh.attempt.id).not.toBe(stale.attempt.id);
    expect(fresh.expectedStateRevision.attemptCount).toBe(4);
  });

  it('supports keyboard input and Escape without changing persistence behavior', async () => {
    const onCancel = vi.fn();
    render(<DiagnosticSession studentId="student-1" onComplete={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /let's go/i }));
    fireEvent.keyDown(window, { key: '8' });
    fireEvent.keyDown(window, { key: 'Enter' });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(persistDiagnosticAnswerProposal).toHaveBeenCalledTimes(1);
    cleanup();

    render(<DiagnosticSession studentId="student-1" onComplete={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /let's go/i }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
