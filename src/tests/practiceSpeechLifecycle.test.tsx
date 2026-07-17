import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PracticeItem, SessionConfig, StudentSettings } from '../types/math';

const mocks = vi.hoisted(() => ({
  usePracticeSession: vi.fn(),
  speakProblem: vi.fn(),
  speakFeedback: vi.fn(),
  stopSpeech: vi.fn(),
  unlockSpeech: vi.fn(),
  startSession: vi.fn(),
  submitAnswer: vi.fn(),
  nextQuestion: vi.fn(),
}));

vi.mock('../features/practice/usePracticeSession', () => ({
  usePracticeSession: mocks.usePracticeSession,
}));

vi.mock('../features/audio/speech', () => ({
  speakProblem: mocks.speakProblem,
  speakFeedback: mocks.speakFeedback,
  stopSpeech: mocks.stopSpeech,
  unlockSpeechFromUserGesture: mocks.unlockSpeech,
}));

vi.mock('../db/dexie', () => ({
  db: { sessions: { delete: vi.fn(async () => undefined) } },
}));

import { PracticeScreen } from '../features/practice/PracticeScreen';

const firstItem: PracticeItem = {
  id: 'MUL_6x7',
  skillId: 'g3-mul-facts',
  itemType: 'multiplication_fact',
  prompt: '6 × 7 = ?',
  answer: 42,
  answerInput: 'numeric',
  tags: [],
  difficulty: 0.2,
};

const secondItem: PracticeItem = {
  ...firstItem,
  id: 'MUL_3x4',
  prompt: '3 × 4 = ?',
  answer: 12,
};

const config: SessionConfig = { mode: 'daily_review', sessionLength: 2 };
const settings: StudentSettings = {
  audioEnabled: true,
  speechRate: 1.15,
  dailyGoalMinutes: 10,
  sessionLength: 10,
  autoAdvance: true,
  theme: 'indigo',
  allowTimedMode: false,
  competitionModeEnabled: false,
  parentModeEnabled: false,
};

function sessionState(phase: 'active' | 'correct', item: PracticeItem = firstItem) {
  return {
    phase,
    currentItem: item,
    retryKey: 0,
    saveStatus: 'idle',
    saveError: null,
    auxiliarySaveStatus: 'idle',
    auxiliarySaveError: null,
    sessionId: 'session-1',
    completedCount: phase === 'correct' ? 1 : 0,
    correctCount: phase === 'correct' ? 1 : 0,
    firstTryCount: phase === 'correct' ? 1 : 0,
    correctedCount: 0,
    repeatedCount: 0,
    slowFirstTryCount: 0,
    attemptCount: phase === 'correct' ? 1 : 0,
    totalPlanned: 2,
    latencies: [],
    missedFacts: [],
    fastestMs: null,
    lastSession: null,
    errorText: null,
    correctResult: phase === 'correct' ? { isNewPersonalBest: false } : null,
  };
}

function useStateFor(state: ReturnType<typeof sessionState>) {
  mocks.usePracticeSession.mockReturnValue({
    state,
    startSession: mocks.startSession,
    submitAnswer: mocks.submitAnswer,
    retrySave: vi.fn(),
    nextQuestion: mocks.nextQuestion,
    retryAuxiliaryWrites: vi.fn(),
    dismissAuxiliaryWarning: vi.fn(),
  });
}

function renderPractice(overrides: Partial<StudentSettings> = {}) {
  return render(
    <PracticeScreen
      studentId="student-1"
      config={config}
      settings={{ ...settings, ...overrides }}
      onUpdateSettings={() => {}}
      onDone={() => {}}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.speakProblem.mockResolvedValue({ status: 'ended' });
  mocks.speakFeedback.mockResolvedValue({ status: 'ended' });
  useStateFor(sessionState('active'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PracticeScreen speech lifecycle', () => {
  it('advances on the visual timer even when feedback speech never resolves', async () => {
    vi.useFakeTimers();
    mocks.speakFeedback.mockImplementation(() => new Promise(() => {}));
    useStateFor(sessionState('correct'));
    renderPractice();

    expect(mocks.speakFeedback).toHaveBeenCalledWith(true, 42, 1.15);
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });

    expect(mocks.nextQuestion).toHaveBeenCalledOnce();
  });

  it('lets Manual Next work immediately while feedback speech is pending', () => {
    mocks.speakFeedback.mockImplementation(() => new Promise(() => {}));
    useStateFor(sessionState('correct'));
    renderPractice({ autoAdvance: false });

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    expect(mocks.nextQuestion).toHaveBeenCalledOnce();
  });

  it('requests the next problem after the visual transition without cancelling feedback', async () => {
    mocks.speakFeedback.mockImplementation(() => new Promise(() => {}));
    useStateFor(sessionState('correct'));
    const view = renderPractice({ autoAdvance: false });
    expect(mocks.speakFeedback).toHaveBeenCalledOnce();

    useStateFor(sessionState('active', secondItem));
    view.rerender(
      <PracticeScreen
        studentId="student-1"
        config={config}
        settings={{ ...settings, autoAdvance: false }}
        onUpdateSettings={() => {}}
        onDone={() => {}}
      />,
    );

    await waitFor(() => expect(mocks.speakProblem).toHaveBeenCalledWith('3 × 4 = ?', 1.15));
    expect(mocks.stopSpeech).not.toHaveBeenCalled();
  });

  it('passes the configured rate to problem and feedback speech', async () => {
    const view = renderPractice();
    await waitFor(() => expect(mocks.speakProblem).toHaveBeenCalledWith('6 × 7 = ?', 1.15));

    useStateFor(sessionState('correct'));
    view.rerender(
      <PracticeScreen
        studentId="student-1"
        config={config}
        settings={settings}
        onUpdateSettings={() => {}}
        onDone={() => {}}
      />,
    );
    await waitFor(() => expect(mocks.speakFeedback).toHaveBeenCalledWith(true, 42, 1.15));
  });

  it('does not call speech APIs when sound is disabled', async () => {
    renderPractice({ audioEnabled: false });
    await act(async () => { await Promise.resolve(); });
    expect(mocks.speakProblem).not.toHaveBeenCalled();
    expect(mocks.speakFeedback).not.toHaveBeenCalled();
    expect(mocks.unlockSpeech).not.toHaveBeenCalled();
  });

  it('retries unlock synchronously when an answer is submitted', () => {
    renderPractice();
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));

    expect(mocks.unlockSpeech).toHaveBeenCalled();
    expect(mocks.submitAnswer).toHaveBeenCalledWith('42');
  });
});
