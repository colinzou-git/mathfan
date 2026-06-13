import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speak, speakProblem, speakFeedback, stopSpeech } from '../features/audio/speech';

// Minimal controllable mock of the Web Speech API. The mock utterance does NOT
// auto-fire onend, so we can assert the returned promise stays pending until we
// explicitly dispatch onend/onerror — the exact timing the auto-advance relies on.

interface MockUtterance {
  text: string;
  rate: number;
  pitch: number;
  volume: number;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

let utterances: MockUtterance[] = [];
let speakSpy: ReturnType<typeof vi.fn>;
let cancelSpy: ReturnType<typeof vi.fn>;
let resumeSpy: ReturnType<typeof vi.fn>;

function installSpeechMock() {
  utterances = [];
  speakSpy = vi.fn();
  cancelSpy = vi.fn();
  resumeSpy = vi.fn();

  class MockSpeechSynthesisUtterance {
    text: string;
    rate = 1;
    pitch = 1;
    volume = 1;
    lang = '';
    voice: SpeechSynthesisVoice | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
      utterances.push(this as unknown as MockUtterance);
    }
  }

  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
    speak: speakSpy,
    cancel: cancelSpy,
    resume: resumeSpy,
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => [],
    addEventListener: () => {},
  };
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    MockSpeechSynthesisUtterance;
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
    MockSpeechSynthesisUtterance;
}

const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(installSpeechMock);
afterEach(() => {
  stopSpeech();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
});

describe('speech promise timing', () => {
  it('starts the first utterance without an unnecessary cancel', () => {
    speak('hello');
    expect(cancelSpy).not.toHaveBeenCalled();
    expect(speakSpy).toHaveBeenCalledOnce();
    expect(utterances.at(-1)?.lang).toBe('en-US');
  });

  it('waits briefly after cancelling before speaking a replacement utterance', async () => {
    vi.useFakeTimers();

    const first = speak('first');
    const second = speak('second');

    await first; // interrupted callers resolve even if Android emits no end event
    expect(cancelSpy).toHaveBeenCalledOnce();
    expect(speakSpy).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(49);
    expect(speakSpy).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1);
    expect(speakSpy).toHaveBeenCalledTimes(2);
    expect(utterances.at(-1)?.text).toBe('second');

    utterances.at(-1)!.onend?.();
    await second;
  });

  it('speakFeedback resolves only after the utterance fires onend', async () => {
    let resolved = false;
    const p = speakFeedback(true, 42).then(() => { resolved = true; });

    await flush();
    expect(resolved).toBe(false);                 // still speaking → must not resolve
    expect(speakSpy).toHaveBeenCalledOnce();
    expect(utterances.at(-1)?.text).toBe('42');

    utterances.at(-1)!.onend?.();                 // speech finished
    await p;
    expect(resolved).toBe(true);
  });

  it('resolves when the utterance fires onerror (so a failed voice never hangs advance)', async () => {
    let resolved = false;
    const p = speak('boom').then(() => { resolved = true; });

    await flush();
    expect(resolved).toBe(false);

    utterances.at(-1)!.onerror?.();
    await p;
    expect(resolved).toBe(true);
  });

  it('speakProblem speaks math symbols as words and resolves on completion', async () => {
    let resolved = false;
    const p = speakProblem('6 × 7 = ?').then(() => { resolved = true; });

    await flush();
    expect(utterances.at(-1)?.text).toBe('6 times 7 = what');
    expect(resolved).toBe(false);

    utterances.at(-1)!.onend?.();
    await p;
    expect(resolved).toBe(true);
  });

  it('resolves immediately when speechSynthesis is unavailable', async () => {
    delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    await expect(speakFeedback(true, 5)).resolves.toBeUndefined();
  });
});

describe('speakProblem speaks fractions naturally (never "slash")', () => {
  const spokenTextFor = (prompt: string) => {
    speakProblem(prompt);
    return utterances.at(-1)?.text ?? '';
  };

  it('speaks a numeric fraction with an equals sign', () => {
    expect(spokenTextFor('1/4 = ?')).toBe('one fourth = what');
  });

  it('speaks 3/4 as "three fourths"', () => {
    expect(spokenTextFor('3/4 = ?')).toBe('three fourths = what');
  });

  it('does not speak raw slashes for a compare prompt', () => {
    const text = spokenTextFor('2/3 ▢ 3/4');
    expect(text).toBe('two thirds blank three fourths');
    expect(text).not.toContain('/');
    expect(text.toLowerCase()).not.toContain('slash');
  });

  it('speaks an unknown numerator as "what number over six"', () => {
    expect(spokenTextFor('?/6')).toBe('what number over six');
  });

  it('speaks an unknown denominator as "two over what number"', () => {
    expect(spokenTextFor('2/?')).toBe('two over what number');
  });

  it('never emits "/" or "slash" for an equivalent-fraction prompt', () => {
    const text = spokenTextFor('2/3 = ?/6');
    expect(text).not.toContain('/');
    expect(text.toLowerCase()).not.toContain('slash');
    expect(text).toContain('two thirds');
    expect(text).toContain('what number over six');
  });
});

describe('speakProblem does not pronounce a sentence-ending "?" as "what"', () => {
  const spokenTextFor = (prompt: string) => {
    speakProblem(prompt);
    return utterances.at(-1)?.text ?? '';
  };

  it('keeps a word-problem question mark as punctuation, not the word "what"', () => {
    expect(spokenTextFor('How many apples in all?')).toBe('How many apples in all?');
  });

  it('does not say "what" for a multi-sentence word problem', () => {
    const text = spokenTextFor('There are 3 boxes. Each one has 4 apples. How many apples in all?');
    expect(text.toLowerCase()).not.toContain('what');
  });

  it('still speaks an equation placeholder "?" as "what" while keeping a sentence "?"', () => {
    expect(spokenTextFor('If 6 × ? = 12, how many groups?')).toBe(
      'If 6 times what = 12, how many groups?',
    );
  });
});
