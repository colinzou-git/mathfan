import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speak, speakProblem, speakFeedback } from '../features/audio/speech';

// Minimal controllable mock of the Web Speech API. The mock utterance does NOT
// auto-fire onend, so we can assert the returned promise stays pending until we
// explicitly dispatch onend/onerror — the exact timing the auto-advance relies on.

interface MockUtterance {
  text: string;
  rate: number;
  pitch: number;
  voice: SpeechSynthesisVoice | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

let utterances: MockUtterance[] = [];
let speakSpy: ReturnType<typeof vi.fn>;
let cancelSpy: ReturnType<typeof vi.fn>;

function installSpeechMock() {
  utterances = [];
  speakSpy = vi.fn();
  cancelSpy = vi.fn();

  class MockSpeechSynthesisUtterance {
    text: string;
    rate = 1;
    pitch = 1;
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
  vi.restoreAllMocks();
  delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
});

describe('speech promise timing', () => {
  it('cancels any in-flight speech before starting a new utterance', () => {
    speak('hello');
    expect(cancelSpy).toHaveBeenCalledOnce();
    expect(speakSpy).toHaveBeenCalledOnce();
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
