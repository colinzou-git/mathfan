// Text-to-speech via Web Speech API — adapted from pwa-starter-kit MODULE-MAP §10

import { normalizeMathForSpeech } from './mathSpeech';

let voice: SpeechSynthesisVoice | null = null;

function getBestVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(
    v => v.lang.startsWith('en') && !v.name.includes('Google') && v.localService
  );
  return preferred ?? voices.find(v => v.lang.startsWith('en')) ?? null;
}

function ensureVoice() {
  if (!voice) voice = getBestVoice();
}

// Resolves when the utterance finishes (onend) or fails (onerror), so callers
// can await speech completion before advancing. Cancels existing speech first,
// preserving the interrupt-on-new-speech behavior used by manual repeat/advance.
export function speak(text: string, rate = 0.9): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.resolve();
  speechSynthesis.cancel();
  ensureVoice();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1.05;
  if (voice) utterance.voice = voice;
  return new Promise<void>(resolve => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    utterance.onend = done;
    utterance.onerror = done;
    speechSynthesis.speak(utterance);
  });
}

export function speakProblem(prompt: string, rate?: number): Promise<void> {
  // Rewrite math symbols and fractions into natural spoken words (e.g. "1/4"
  // becomes "one fourth", never "one slash four").
  return speak(normalizeMathForSpeech(prompt), rate);
}

export function speakFeedback(isCorrect: boolean, answer: number | string): Promise<void> {
  if (isCorrect) {
    return speak(String(answer));
  }
  return speak(`Not quite. The answer is ${answer}.`);
}

export function stopSpeech(): void {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// Preload voices (they load async in some browsers)
export function preloadVoices(): void {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener('voiceschanged', () => {
    voice = null; // reset so next speak() picks fresh voice list
  }, { once: true });
}
