// Text-to-speech via Web Speech API — adapted from pwa-starter-kit MODULE-MAP §10

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

export function speak(text: string, rate = 0.9): void {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  ensureVoice();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1.05;
  if (voice) utterance.voice = voice;
  speechSynthesis.speak(utterance);
}

export function speakProblem(prompt: string, rate?: number): void {
  // Replace × with "times" and ÷ with "divided by" for natural speech
  const spoken = prompt
    .replace(/×/g, 'times')
    .replace(/÷/g, 'divided by')
    .replace(/\?/g, 'what');
  speak(spoken, rate);
}

export function speakFeedback(isCorrect: boolean, answer: number | string): void {
  if (isCorrect) {
    speak(`Correct! The answer is ${answer}.`);
  } else {
    speak(`Not quite. The answer is ${answer}.`);
  }
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
