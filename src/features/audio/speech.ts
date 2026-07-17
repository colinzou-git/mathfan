// Text-to-speech via Web Speech API — adapted from pwa-starter-kit MODULE-MAP §10

import { normalizeMathForSpeech } from './mathSpeech';

export type SpeechRole = 'problem' | 'feedback' | 'generic';

export type SpeechUnlockState =
  | 'not_attempted'
  | 'priming'
  | 'ready'
  | 'failed';

export type SpeechStatus =
  | 'ended'
  | 'error'
  | 'cancelled'
  | 'not_started'
  | 'unavailable';

export interface SpeechResult {
  status: SpeechStatus;
  error?: string;
}

interface SpeechRequest {
  id: number;
  role: SpeechRole;
  text: string;
  rate: number;
  resolve: (result: SpeechResult) => void;
}

interface ActiveSpeech {
  request: SpeechRequest;
  utterance: SpeechSynthesisUtterance;
  started: boolean;
  startTimer: ReturnType<typeof setTimeout> | null;
  completionTimer: ReturnType<typeof setTimeout> | null;
  resumeTimer: ReturnType<typeof setTimeout> | null;
}

const SPEECH_START_TIMEOUT_MS = 800;
const ANDROID_RESUME_KICK_MS = 150;
const UNLOCK_PRIMER_TIMEOUT_MS = 400;

let voice: SpeechSynthesisVoice | null = null;
let requestSequence = 0;
let unlockState: SpeechUnlockState = 'not_attempted';
let unlockPrimer: SpeechSynthesisUtterance | null = null;
let unlockPrimerTimer: ReturnType<typeof setTimeout> | null = null;
let activeSpeech: ActiveSpeech | null = null;
let queuedProblem: SpeechRequest | null = null;
let unlockListenersInstalled = false;
let lifecycleListenerInstalled = false;

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
}

function getBestVoice(): SpeechSynthesisVoice | null {
  const synth = getSynth();
  if (!synth) return null;

  const voices = synth.getVoices();
  const isEnglish = (candidate: SpeechSynthesisVoice) => candidate.lang.toLowerCase().startsWith('en');
  const isUsEnglish = (candidate: SpeechSynthesisVoice) => candidate.lang.toLowerCase() === 'en-us';

  return voices.find(candidate => isUsEnglish(candidate) && candidate.localService)
    ?? voices.find(candidate => isEnglish(candidate) && candidate.localService)
    ?? voices.find(isUsEnglish)
    ?? voices.find(isEnglish)
    ?? null;
}

function ensureVoice(): void {
  if (!voice) voice = getBestVoice();
}

function clearActiveTimers(active: ActiveSpeech): void {
  if (active.startTimer) clearTimeout(active.startTimer);
  if (active.completionTimer) clearTimeout(active.completionTimer);
  if (active.resumeTimer) clearTimeout(active.resumeTimer);
  active.startTimer = null;
  active.completionTimer = null;
  active.resumeTimer = null;
}

function completionTimeoutMs(request: SpeechRequest): number {
  const words = Math.max(1, request.text.trim().split(/\s+/).length);
  const estimatedMs = words * 450 / Math.max(0.5, request.rate);

  if (request.role === 'feedback') {
    return Math.min(4_000, Math.max(1_200, estimatedMs + 800));
  }

  return Math.min(30_000, Math.max(3_000, estimatedMs + 2_000));
}

function replaceQueuedProblem(request: SpeechRequest): void {
  queuedProblem?.resolve({ status: 'cancelled' });
  queuedProblem = request;
}

function flushQueuedProblem(): void {
  if (!queuedProblem || activeSpeech) return;
  const next = queuedProblem;
  queuedProblem = null;
  startSpeech(next);
}

function cancelActiveAppSpeech(): void {
  const active = activeSpeech;
  if (!active) return;

  clearActiveTimers(active);
  activeSpeech = null;
  active.request.resolve({ status: 'cancelled' });

  // Native flags are never ownership signals. MathFan only cancels here because
  // it has an app-owned active request, and never while the unlock primer owns
  // the engine because that would recreate the Android/PWA regression.
  if (unlockState === 'priming') return;
  const synth = getSynth();
  if (!synth) return;
  try { synth.cancel(); } catch { /* no-op */ }
}

function finishActiveSpeech(active: ActiveSpeech, result: SpeechResult): void {
  if (activeSpeech !== active) return;

  clearActiveTimers(active);
  activeSpeech = null;
  active.request.resolve(result);

  if (queuedProblem) {
    const next = queuedProblem;
    queuedProblem = null;
    queueMicrotask(() => startSpeech(next));
  }
}

function startSpeech(request: SpeechRequest): void {
  const synth = getSynth();
  if (!synth) {
    request.resolve({ status: 'unavailable' });
    return;
  }

  // Every request path should have resolved or queued the previous app-owned
  // item. Keep this guard so an unexpected caller can never orphan a promise.
  if (activeSpeech) cancelActiveAppSpeech();

  ensureVoice();

  const utterance = new SpeechSynthesisUtterance(request.text);
  utterance.rate = request.rate;
  utterance.pitch = 1.05;
  utterance.volume = 1;
  utterance.lang = voice?.lang || 'en-US';
  if (voice) utterance.voice = voice;

  const active: ActiveSpeech = {
    request,
    utterance,
    started: false,
    startTimer: null,
    completionTimer: null,
    resumeTimer: null,
  };
  activeSpeech = active;

  utterance.onstart = () => {
    if (activeSpeech !== active) return;
    active.started = true;
    if (active.startTimer) {
      clearTimeout(active.startTimer);
      active.startTimer = null;
    }
    if (active.resumeTimer) {
      clearTimeout(active.resumeTimer);
      active.resumeTimer = null;
    }
  };
  utterance.onend = () => finishActiveSpeech(active, { status: 'ended' });
  utterance.onerror = event => finishActiveSpeech(active, {
    status: 'error',
    error: event.error || 'unknown',
  });

  try {
    if (synth.paused) synth.resume();
    synth.speak(utterance);
  } catch {
    finishActiveSpeech(active, { status: 'error', error: 'speak_threw' });
    return;
  }

  // A few test/browser engines dispatch onstart synchronously from speak(). Do
  // not install a stale watchdog after that acknowledgement.
  if (activeSpeech === active && !active.started) {
    active.startTimer = setTimeout(() => {
      if (activeSpeech === active && !active.started) {
        finishActiveSpeech(active, {
          status: 'not_started',
          error: 'speech_start_timeout',
        });
      }
    }, SPEECH_START_TIMEOUT_MS);

    active.resumeTimer = setTimeout(() => {
      if (activeSpeech === active && !active.started) {
        try { synth.resume(); } catch { /* no-op */ }
      }
    }, ANDROID_RESUME_KICK_MS);
  }

  if (activeSpeech === active) {
    active.completionTimer = setTimeout(() => {
      if (activeSpeech === active) {
        finishActiveSpeech(active, {
          status: 'error',
          error: 'speech_completion_timeout',
        });
      }
    }, completionTimeoutMs(request));
  }
}

function requestSpeech(role: SpeechRole, text: string, rate = 0.9): Promise<SpeechResult> {
  const synth = getSynth();
  const normalized = text.trim();

  if (!synth || !normalized) {
    return Promise.resolve({ status: 'unavailable' });
  }

  return new Promise(resolve => {
    const request: SpeechRequest = {
      id: ++requestSequence,
      role,
      text: normalized,
      rate,
      resolve,
    };

    if (unlockState === 'priming') {
      if (role === 'problem') {
        replaceQueuedProblem(request);
      } else {
        if (queuedProblem) {
          queuedProblem.resolve({ status: 'cancelled' });
          queuedProblem = null;
        }
        queueMicrotask(() => startSpeech(request));
      }
      return;
    }

    if (role === 'problem' && activeSpeech?.request.role === 'feedback') {
      replaceQueuedProblem(request);
      return;
    }

    if (role === 'problem' && activeSpeech) {
      cancelActiveAppSpeech();
    } else if (role === 'feedback' && activeSpeech) {
      cancelActiveAppSpeech();
    } else if (role === 'generic' && activeSpeech) {
      cancelActiveAppSpeech();
    }

    if ((role === 'feedback' || role === 'generic') && queuedProblem) {
      queuedProblem.resolve({ status: 'cancelled' });
      queuedProblem = null;
    }

    startSpeech(request);
  });
}

export function unlockSpeechFromUserGesture(): void {
  const synth = getSynth();
  if (!synth) {
    unlockState = 'failed';
    return;
  }

  if (unlockState === 'ready' || unlockState === 'priming') return;
  unlockState = 'priming';

  try { synth.resume(); } catch { /* continue */ }

  const primer = new SpeechSynthesisUtterance('.');
  unlockPrimer = primer;
  primer.lang = 'en-US';
  primer.volume = 0.01;
  primer.rate = 10;

  let settled = false;
  const finish = (success: boolean) => {
    if (settled || unlockPrimer !== primer) return;
    settled = true;
    if (unlockPrimerTimer) clearTimeout(unlockPrimerTimer);
    unlockPrimerTimer = null;
    unlockPrimer = null;
    unlockState = success ? 'ready' : 'failed';
    flushQueuedProblem();
  };

  primer.onstart = () => {
    if (unlockPrimer === primer) unlockState = 'ready';
  };
  primer.onend = () => finish(true);
  primer.onerror = () => finish(false);

  try {
    synth.speak(primer);
  } catch {
    finish(false);
    return;
  }

  unlockPrimerTimer = setTimeout(() => {
    if (unlockPrimer === primer) finish(unlockState === 'ready');
  }, UNLOCK_PRIMER_TIMEOUT_MS);
}

export function speak(text: string, rate = 0.9): Promise<SpeechResult> {
  return requestSpeech('generic', text, rate);
}

export function speakProblem(prompt: string, rate = 0.9): Promise<SpeechResult> {
  return requestSpeech('problem', normalizeMathForSpeech(prompt), rate);
}

export function speakFeedback(
  isCorrect: boolean,
  answer: number | string,
  rate = 0.9,
): Promise<SpeechResult> {
  return requestSpeech(
    'feedback',
    isCorrect ? String(answer) : `Not quite. The answer is ${answer}.`,
    rate,
  );
}

export function stopSpeech(): void {
  requestSequence++;

  if (unlockPrimerTimer) clearTimeout(unlockPrimerTimer);
  unlockPrimerTimer = null;
  if (unlockPrimer) {
    unlockPrimer.onstart = null;
    unlockPrimer.onend = null;
    unlockPrimer.onerror = null;
    unlockPrimer = null;
  }

  if (activeSpeech) {
    const active = activeSpeech;
    clearActiveTimers(active);
    activeSpeech = null;
    active.request.resolve({ status: 'cancelled' });
  }

  if (queuedProblem) {
    queuedProblem.resolve({ status: 'cancelled' });
    queuedProblem = null;
  }

  unlockState = 'not_attempted';

  const synth = getSynth();
  if (synth) {
    try { synth.cancel(); } catch { /* no-op */ }
  }

  // If the original one-shot listener already fired, arm a fresh fallback for
  // the next foreground interaction. Explicit launch/submit handlers still call
  // unlock synchronously; this covers browser back/forward and resume paths.
  installInteractionUnlock();
}

function installInteractionUnlock(): void {
  if (unlockListenersInstalled || typeof document === 'undefined') return;
  unlockListenersInstalled = true;

  const unlock = () => {
    unlockListenersInstalled = false;
    unlockSpeechFromUserGesture();
    document.removeEventListener('pointerdown', unlock, true);
    document.removeEventListener('keydown', unlock, true);
  };

  document.addEventListener('pointerdown', unlock, { capture: true, once: true });
  document.addEventListener('keydown', unlock, { capture: true, once: true });
}

function installLifecycleRecovery(): void {
  if (lifecycleListenerInstalled || typeof document === 'undefined') return;
  lifecycleListenerInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    stopSpeech();
  });
}

// Preload voices (they load asynchronously in some browsers) and install a
// user-gesture primer required by some Android Chrome/PWA builds.
export function preloadVoices(): void {
  const synth = getSynth();
  if (!synth) return;

  voice = null;
  synth.getVoices();
  if (typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', () => {
      voice = null;
      ensureVoice();
    }, { once: true });
  }
  installInteractionUnlock();
  installLifecycleRecovery();
}
