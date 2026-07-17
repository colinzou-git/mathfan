import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { StudentSettings } from '../types/math';

// Speech is mocked so the test controls exactly when the answer audio "finishes".
vi.mock('../features/audio/speech', () => ({
  speakProblem: vi.fn(() => Promise.resolve({ status: 'ended' as const })),
  speakFeedback: vi.fn(() => Promise.resolve({ status: 'ended' as const })),
  stopSpeech: vi.fn(),
  unlockSpeechFromUserGesture: vi.fn(),
}));

vi.mock('../db/dexie', () => ({
  db: {
    multFactStats: {
      where: () => ({ equals: () => ({ toArray: () => Promise.resolve([]) }) }),
    },
  },
}));

vi.mock('../features/learning/recordAnswer', () => ({
  recordQuizFirstAttempt: vi.fn(() => Promise.resolve()),
  recordQuizRetry: vi.fn(() => Promise.resolve()),
  finalizeQuizSession: vi.fn(() => Promise.resolve()),
}));

vi.mock('../features/multiplication/quizQuestionSelector', () => ({
  selectQuizQuestions: () => ['6x7', '3x4'],
}));

import { MultiplicationQuizPage } from '../features/multiplication/MultiplicationQuizPage';
import { speakFeedback, speakProblem, unlockSpeechFromUserGesture } from '../features/audio/speech';

const mockSpeakFeedback = vi.mocked(speakFeedback);
const mockSpeakProblem = vi.mocked(speakProblem);
const mockUnlockSpeech = vi.mocked(unlockSpeechFromUserGesture);
const settings = { audioEnabled: true, speechRate: 1.1 } as StudentSettings;

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mockSpeakFeedback.mockResolvedValue({ status: 'ended' });
});

async function startAndAnswerFirst() {
  render(<MultiplicationQuizPage studentId="s1" settings={settings} onDone={() => {}} />);
  fireEvent.click(screen.getByText(/Start 20-Question Quiz/));
  await screen.findByText('Question 1 of 2');

  const input = screen.getByLabelText('Your answer');
  fireEvent.change(input, { target: { value: '42' } });
  fireEvent.click(screen.getByLabelText('Submit answer'));
}

describe('MultiplicationQuizPage auto-advance', () => {
  it('advances visually when feedback speech never starts', async () => {
    mockSpeakFeedback.mockImplementation(() => new Promise(() => {}));

    await startAndAnswerFirst();

    expect(mockSpeakFeedback).toHaveBeenCalledWith(true, 42, 1.1);
    expect(mockSpeakProblem).toHaveBeenCalledWith('6 × 7 = ?', 1.1);
    expect(mockUnlockSpeech).toHaveBeenCalledTimes(2); // Start and answer submission
    await waitFor(
      () => expect(screen.getByText('Question 2 of 2')).toBeInTheDocument(),
      { timeout: 1_500 },
    );
  });

  it('advances after the answer speech finishes when audio resolves immediately', async () => {
    await startAndAnswerFirst();
    await waitFor(() => expect(screen.getByText('Question 2 of 2')).toBeInTheDocument());
  });
});
