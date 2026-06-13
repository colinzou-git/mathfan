// Text-to-speech via Web Speech API — adapted from pwa-starter-kit MODULE-MAP §10

import { normalizeMathForSpeech } from './mathSpeech';

const CANCEL_SETTLE_MS = 50;
const ANDROID_RESUME_KICK_MS = 150;

let voice: SpeechSynthesisVoice | null = null;
let requestSeq = 0;
let unlockListenersInstalled = false;

interface ActiveSpeech {
  utterance: SpeechSynthesisUtterance;
  resolve: () => void;
  startTimer: ReturnType<typeof setTimeout> | null;
  resumeTimer: ReturnType<typeof setTimeout> | null;
  watchdogTimer: ReturnType<typeof setTimeout> | null;
}

let activeSpeech: ActiveSpeech | null = null;

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
}

function getBestVoice(): SpeechSynthesisVoice | null {
  const synth = getSynth();
  if (!synth) return null;

  const voices = synth.getVoices();
  const isEnglish = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith('en');
  const isUsEnglish = (v: SpeechSynthesisVoice) => v.lang.toLowerCase() === 'en-us';

  // Android normally exposes Google voices. Do not exclude them: prefer an
  // installed US-English voice, then any installed English voice, then any
  // English voice supplied by the browser/OS.
  return voices.find(v => isUsEnglish(v) && v.localService)
    ?? voices.find(v => isEnglish(v) && v.localService)
    ?? voices.find(isUsEnglish)
    ?? voices.find(isEnglish)
    ?? null;
}

function ensureVoice(): void {
  if (!voice) voice = getBestVoice();
}

function clearActiveTimers(active: ActiveSpeech): void {
  if (active.startTimer) clearTimeout(active.startTimer);
  if (active.resumeTimer) clearTimeout(active.resumeTimer);
  if (active.watchdogTimer) clearTimeout(active.watchdogTimer);
}

function finishActive(utterance?: SpeechSynthesisUtterance): void {
  const active = activeSpeech;
  if (!active || (utterance && active.utterance !== utterance)) return;

  clearActiveTimers(active);
  activeSpeech = null;
  active.resolve();
}

// Resolves when the utterance finishes (onend), fails (onerror), is interrupted,
// or reaches the watchdog timeout. Android Chrome can drop an utterance when
// cancel() and speak() happen in the same task, so replacement speech waits one
// short settle period after cancellation. Keeping a module-level reference also
// prevents mobile browsers from garbage-collecting the utterance too early.
export function speak(text: string, rate = 0.9): Promise<void> {
  const synth = getSynth();
  if (!synth || !text.trim()) return Promise.resolve();

  const seq = ++requestSeq;
  const hadQueuedSpeech = activeSpeech !== null || synth.speaking || synth.pending || synth.paused;

  // Resolve interrupted callers ourselves. Some Android engines do not emit an
  // end/error event after cancel(), which otherwise leaves auto-advance waiting.
  finishActive();
  if (hadQueuedSpeech) {
    try {
      synth.cancel();
    } catch {
      // Continue and attempt the replacement utterance.
    }
  }

  ensureVoice();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1.05;
  utterance.volume = 1;
  utterance.lang = voice?.lang || 'en-US';
  if (voice) utterance.voice = voice;

  return new Promise<void>(resolve => {
    const active: ActiveSpeech = {
      utterance,
      resolve,
      startTimer: null,
      resumeTimer: null,
      watchdogTimer: null,
    };
    activeSpeech = active;

    const done = () => finishActive(utterance);
    utterance.onend = done;
    utterance.onerror = done;

    const enqueue = () => {
      active.startTimer = null;
      if (seq !== requestSeq || activeSpeech?.utterance !== utterance) return;

      try {
        // A background/foreground transition can leave Android's synthesis
        // engine paused. Resume before enqueueing, then kick it once more if the
        // browser has still not started playback.
        if (synth.paused) synth.resume();
        synth.speak(utterance);

        active.resumeTimer = setTimeout(() => {
          active.resumeTimer = null;
          if (seq === requestSeq && activeSpeech?.utterance === utterance) {
            try { synth.resume(); } catch { /* no-op */ }
          }
        }, ANDROID_RESUME_KICK_MS);

        // Browser speech engines occasionally omit both onend and onerror.
        // Never let that freeze the learning flow indefinitely.
        const watchdogMs = Math.min(60_000, Math.max(8_000, text.length * 180 + 3_000));
        active.watchdogTimer = setTimeout(done, watchdogMs);
      } catch {
        done();
      }
    };

    if (hadQueuedSpeech) {
      active.startTimer = setTimeout(enqueue, CANCEL_SETTLE_MS);
    } else {
      enqueue();
    }
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
  requestSeq++;
  finishActive();
  const synth = getSynth();
  if (!synth) return;
  try { synth.cancel(); } catch { /* no-op */ }
}

function installInteractionUnlock(): void {
  if (unlockListenersInstalled || typeof document === 'undefined') return;
  unlockListenersInstalled = true;

  const unlock = () => {
    const synth = getSynth();
    if (synth) {
      try {
        synth.resume();
        // Prime Android's TTS engine from a real user gesture. The silent token
        // is inaudible, but allows later effect-driven questions to be spoken.
        const primer = new SpeechSynthesisUtterance('.');
        primer.lang = 'en-US';
        primer.volume = 0;
        synth.speak(primer);
      } catch {
        // Speech will still be attempted normally on the next question.
      }
    }
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
  };

  document.addEventListener('pointerdown', unlock, { capture: true, once: true });
  document.addEventListener('keydown', unlock, { capture: true, once: true });
}

// Preload voices (they load asynchronously in some browsers) and install a
// one-time user-gesture primer required by some Android Chrome/PWA builds.
export function preloadVoices(): void {
  const synth = getSynth();
  if (!synth) return;

  synth.getVoices();
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', () => {
      voice = null; // reset so next speak() picks the newly available voice list
      ensureVoice();
    }, { once: true });
  }
  installInteractionUnlock();
}
