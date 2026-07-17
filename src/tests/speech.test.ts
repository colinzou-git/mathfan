import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  preloadVoices,
  speak,
  speakFeedback,
  speakProblem,
  stopSpeech,
  unlockSpeechFromUserGesture,
  type SpeechResult,
} from '../features/audio/speech';

interface MockUtterance {
  text: string;
  rate: number;
  pitch: number;
  volume: number;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

interface MockSynth {
  speaking: boolean;
  pending: boolean;
  paused: boolean;
  voices: SpeechSynthesisVoice[];
}

let utterances: MockUtterance[];
let spoken: MockUtterance[];
let synthState: MockSynth;
let speakSpy: ReturnType<typeof vi.fn>;
let cancelSpy: ReturnType<typeof vi.fn>;
let resumeSpy: ReturnType<typeof vi.fn>;

function installSpeechMock() {
  utterances = [];
  spoken = [];
  synthState = { speaking: false, pending: false, paused: false, voices: [] };
  speakSpy = vi.fn((utterance: MockUtterance) => { spoken.push(utterance); });
  cancelSpy = vi.fn();
  resumeSpy = vi.fn();

  class MockSpeechSynthesisUtterance {
    text: string;
    rate = 1;
    pitch = 1;
    volume = 1;
    lang = '';
    voice: SpeechSynthesisVoice | null = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;

    constructor(text: string) {
      this.text = text;
      utterances.push(this as unknown as MockUtterance);
    }
  }

  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speak: speakSpy,
      cancel: cancelSpy,
      resume: resumeSpy,
      get speaking() { return synthState.speaking; },
      get pending() { return synthState.pending; },
      get paused() { return synthState.paused; },
      getVoices: () => synthState.voices,
      addEventListener: vi.fn(),
    },
  });
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
}

const flushMicrotasks = async () => { await Promise.resolve(); await Promise.resolve(); };
const lastSpoken = () => spoken.at(-1)!;

beforeEach(() => {
  installSpeechMock();
  stopSpeech();
  cancelSpy.mockClear();
  resumeSpy.mockClear();
});

afterEach(() => {
  stopSpeech();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
});

describe('speech ownership and unlock lifecycle', () => {
  it('starts the first speech without an unnecessary cancel', () => {
    void speak('hello');
    expect(cancelSpy).not.toHaveBeenCalled();
    expect(spoken.map(value => value.text)).toEqual(['hello']);
    expect(lastSpoken().lang).toBe('en-US');
  });

  it.each(['pending', 'speaking', 'paused'] as const)(
    'does not cancel because native %s alone is true',
    flag => {
      synthState[flag] = true;
      void speak('hello');
      expect(cancelSpy).not.toHaveBeenCalled();
      expect(lastSpoken().text).toBe('hello');
    },
  );

  it('does not cancel the unlock primer when the first problem arrives', () => {
    unlockSpeechFromUserGesture();
    expect(lastSpoken().text).toBe('.');

    void speakProblem('6 × 7 = ?');

    expect(cancelSpy).not.toHaveBeenCalled();
    expect(spoken.map(value => value.text)).toEqual(['.']);
  });

  it('queues the first audible problem until the primer completes', async () => {
    unlockSpeechFromUserGesture();
    const primer = lastSpoken();
    const problem = speakProblem('6 × 7 = ?');

    primer.onstart?.();
    primer.onend?.();

    expect(spoken.map(value => value.text)).toEqual(['.', '6 times 7 = what']);
    lastSpoken().onstart?.();
    lastSpoken().onend?.();
    await expect(problem).resolves.toEqual({ status: 'ended' });
  });

  it('treats primer onstart as ready and keeps unlock idempotent', () => {
    unlockSpeechFromUserGesture();
    const primer = lastSpoken();
    primer.onstart?.();
    primer.onend?.();

    unlockSpeechFromUserGesture();

    expect(spoken.map(value => value.text)).toEqual(['.']);
  });

  it('times out a callback-less primer without remaining permanently priming', async () => {
    vi.useFakeTimers();
    unlockSpeechFromUserGesture();
    void speakProblem('first problem');

    await vi.advanceTimersByTimeAsync(400);
    expect(lastSpoken().text).toBe('first problem');

    unlockSpeechFromUserGesture();
    expect(lastSpoken().text).toBe('.');
    expect(spoken.filter(value => value.text === '.')).toHaveLength(2);
  });

  it('re-arms unlock after backgrounding and stopping speech', () => {
    preloadVoices();
    unlockSpeechFromUserGesture();
    stopSpeech();
    cancelSpy.mockClear();

    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    expect(lastSpoken().text).toBe('.');
    expect(cancelSpy).not.toHaveBeenCalled();
  });
});

describe('speech start and completion acknowledgement', () => {
  it('resolves not_started within 800 ms when an audible utterance is ignored', async () => {
    vi.useFakeTimers();
    const result = speak('ignored');

    await vi.advanceTimersByTimeAsync(799);
    let settled = false;
    void result.then(() => { settled = true; });
    await flushMicrotasks();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({
      status: 'not_started',
      error: 'speech_start_timeout',
    });
  });

  it('onstart clears the start watchdog', async () => {
    vi.useFakeTimers();
    const result = speak('acknowledged');
    lastSpoken().onstart?.();

    await vi.advanceTimersByTimeAsync(801);
    let settled = false;
    void result.then(() => { settled = true; });
    await flushMicrotasks();
    expect(settled).toBe(false);

    lastSpoken().onend?.();
    await expect(result).resolves.toEqual({ status: 'ended' });
  });

  it('reports native speech errors', async () => {
    const result = speak('boom');
    lastSpoken().onerror?.({ error: 'synthesis-failed' });
    await expect(result).resolves.toEqual({ status: 'error', error: 'synthesis-failed' });
  });

  it('uses the completion watchdog to clean the audio queue', async () => {
    vi.useFakeTimers();
    const feedback = speakFeedback(true, 42);
    lastSpoken().onstart?.();
    const problem = speakProblem('next problem');

    await vi.advanceTimersByTimeAsync(1_300);

    await expect(feedback).resolves.toEqual({
      status: 'error',
      error: 'speech_completion_timeout',
    });
    expect(lastSpoken().text).toBe('next problem');
    lastSpoken().onstart?.();
    lastSpoken().onend?.();
    await expect(problem).resolves.toEqual({ status: 'ended' });
  });

  it('returns unavailable without throwing when Web Speech is missing', async () => {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    await expect(speakFeedback(true, 5)).resolves.toEqual({ status: 'unavailable' });
  });
});

describe('role-aware sequencing', () => {
  it('interrupts an active problem with feedback', async () => {
    const problem = speakProblem('old problem');
    lastSpoken().onstart?.();
    const feedback = speakFeedback(true, 7);

    await expect(problem).resolves.toEqual({ status: 'cancelled' });
    expect(cancelSpy).toHaveBeenCalledOnce();
    expect(lastSpoken().text).toBe('7');
    lastSpoken().onstart?.();
    lastSpoken().onend?.();
    await expect(feedback).resolves.toEqual({ status: 'ended' });
  });

  it('does not interrupt active feedback with a problem', async () => {
    const feedback = speakFeedback(true, 7);
    const feedbackUtterance = lastSpoken();
    feedbackUtterance.onstart?.();
    const problem = speakProblem('new problem');

    expect(cancelSpy).not.toHaveBeenCalled();
    expect(lastSpoken()).toBe(feedbackUtterance);

    feedbackUtterance.onend?.();
    await flushMicrotasks();
    expect(lastSpoken().text).toBe('new problem');
    lastSpoken().onstart?.();
    lastSpoken().onend?.();
    await expect(feedback).resolves.toEqual({ status: 'ended' });
    await expect(problem).resolves.toEqual({ status: 'ended' });
  });

  it('collapses multiple queued problems to the newest one', async () => {
    const feedback = speakFeedback(true, 7);
    const feedbackUtterance = lastSpoken();
    feedbackUtterance.onstart?.();
    const obsolete = speakProblem('obsolete problem');
    const latest = speakProblem('latest problem');

    await expect(obsolete).resolves.toEqual({ status: 'cancelled' });
    feedbackUtterance.onend?.();
    await flushMicrotasks();
    expect(lastSpoken().text).toBe('latest problem');
    lastSpoken().onstart?.();
    lastSpoken().onend?.();
    await expect(feedback).resolves.toEqual({ status: 'ended' });
    await expect(latest).resolves.toEqual({ status: 'ended' });
  });

  it('stopSpeech resolves active and queued requests once and clears the primer', async () => {
    unlockSpeechFromUserGesture();
    const primer = lastSpoken();
    const queued = speakProblem('queued problem');
    const active = speakFeedback(true, 9);
    await flushMicrotasks();
    const activeResult = vi.fn<(result: SpeechResult) => void>();
    const queuedResult = vi.fn<(result: SpeechResult) => void>();
    void active.then(activeResult);
    void queued.then(queuedResult);

    stopSpeech();
    primer.onstart?.();
    primer.onend?.();
    await flushMicrotasks();

    expect(activeResult).toHaveBeenCalledOnce();
    expect(activeResult).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(queuedResult).toHaveBeenCalledOnce();
    expect(queuedResult).toHaveBeenCalledWith({ status: 'cancelled' });
  });
});

describe('speech text, rate, and voice selection', () => {
  it('passes configured rates and selects an English voice', () => {
    const englishVoice = { lang: 'en-GB', localService: true } as SpeechSynthesisVoice;
    synthState.voices = [{ lang: 'fr-FR', localService: true }, englishVoice] as SpeechSynthesisVoice[];
    preloadVoices();

    void speakProblem('6 × 7 = ?', 1.2);

    expect(lastSpoken().rate).toBe(1.2);
    expect(lastSpoken().voice).toBe(englishVoice);
    expect(lastSpoken().lang).toBe('en-GB');
  });

  it.each([
    ['1/4 = ?', 'one fourth = what'],
    ['3/4 = ?', 'three fourths = what'],
    ['?/6', 'what number over six'],
    ['2/?', 'two over what number'],
    ['If 6 × ? = 12, how many groups?', 'If 6 times what = 12, how many groups?'],
  ])('normalizes %s for speech', (prompt, expected) => {
    void speakProblem(prompt);
    expect(lastSpoken().text).toBe(expected);
    expect(lastSpoken().text.toLowerCase()).not.toContain('slash');
  });

  it('keeps sentence-ending question marks as punctuation', () => {
    void speakProblem('How many apples in all?');
    expect(lastSpoken().text).toBe('How many apples in all?');
  });
});
