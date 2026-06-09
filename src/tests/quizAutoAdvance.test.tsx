import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { StudentSettings } from '../types/math';

// Speech is mocked so the test controls exactly when the answer audio "finishes".
vi.mock('../features/audio/speech', () => ({
  speakProblem: vi.fn(() => Promise.resolve()),
  speakFeedback: vi.fn(() => Promise.resolve()),
  stopSpeech: vi.fn(),
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
import { speakFeedback } from '../features/audio/speech';

const mockSpeakFeedback = vi.mocked(speakFeedback);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const settings = { audioEnabled: true } as StudentSettings;

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mockSpeakFeedback.mockImplementation(() => Promise.resolve()); });

async function startAndAnswerFirst() {
  render(<MultiplicationQuizPage studentId="s1" settings={settings} onDone={() => {}} />);
  fireEvent.click(screen.getByText(/Start 20-Question Quiz/));
  await screen.findByText('Question 1 of 2');

  const input = screen.getByLabelText('Your answer');
  fireEvent.change(input, { target: { value: '42' } });
  fireEvent.click(screen.getByLabelText('Submit answer'));
}

describe('MultiplicationQuizPage auto-advance', () => {
  it('does not advance to the next question until the feedback speech promise resolves', async () => {
    // Speech never resolves during this window → advance must stay blocked.
    let resolveSpeech!: () => void;
    mockSpeakFeedback.mockImplementation(() => new Promise<void>(r => { resolveSpeech = () => r(); }));

    await startAndAnswerFirst();

    expect(mockSpeakFeedback).toHaveBeenCalledWith(true, 42);

    // Wait well past the post-speech visual pause; the pause timer cannot even
    // start until speech resolves, so we must still be on question 1.
    await sleep(700);
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument();
    expect(screen.queryByText('Question 2 of 2')).not.toBeInTheDocument();

    // Now let the answer audio finish → advance proceeds after the visual pause.
    resolveSpeech();
    await waitFor(() => expect(screen.getByText('Question 2 of 2')).toBeInTheDocument());
  });

  it('advances after the answer speech finishes when audio resolves immediately', async () => {
    await startAndAnswerFirst();
    await waitFor(() => expect(screen.getByText('Question 2 of 2')).toBeInTheDocument());
  });
});
