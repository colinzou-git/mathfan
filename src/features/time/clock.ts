/**
 * App clock — the single source of "now" for scheduling, timestamps, and stats.
 *
 * Normally this is just the wall clock. In **debug speed** mode it runs fast so
 * that day-scale FSRS intervals can be exercised in seconds (default: 1 day per
 * 20 real seconds). This lets a tester — or an automated test — watch reviews
 * come due, streaks build, and growth charts move without waiting real days.
 *
 * IMPORTANT: answer latency (how fast the child responded) must use the REAL
 * wall clock, never this. Use `performance.now()` / `Date.now()` for that.
 *
 * The clock is monotonic across a scale change: when you toggle speed, app-time
 * continues from where it was (it never jumps backward and orphans due dates).
 */

const STORAGE_KEY = 'mathfan_clock';

/** 1 app-day per 20 real seconds → 86400/20 = 4320× real time. */
export const DEBUG_SCALE = 86400 / 20;
export const NORMAL_SCALE = 1;

interface ClockState {
  /** Real wall-clock ms at the moment the current scale took effect. */
  realAnchorMs: number;
  /** App-time ms that corresponds to realAnchorMs. */
  appAnchorMs: number;
  scale: number;
}

function load(): ClockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as ClockState;
      if (typeof s.realAnchorMs === 'number' && typeof s.appAnchorMs === 'number' && typeof s.scale === 'number') {
        return s;
      }
    }
  } catch { /* ignore */ }
  // Default: app-time == real-time, scale 1.
  const nowMs = Date.now();
  return { realAnchorMs: nowMs, appAnchorMs: nowMs, scale: NORMAL_SCALE };
}

let state: ClockState = load();

function save(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/** Current app-time in ms. */
export function appNowMs(): number {
  return state.appAnchorMs + (Date.now() - state.realAnchorMs) * state.scale;
}

/** Current app-time as a Date. */
export function appNow(): Date {
  return new Date(appNowMs());
}

/** Re-anchor at the current instant, then apply a new scale (keeps time monotonic). */
function setScale(scale: number): void {
  const appMs = appNowMs();
  state = { realAnchorMs: Date.now(), appAnchorMs: appMs, scale };
  save();
}

export function getScale(): number {
  return state.scale;
}

export function isDebugSpeed(): boolean {
  return state.scale !== NORMAL_SCALE;
}

export function enableDebugSpeed(scale: number = DEBUG_SCALE): void {
  setScale(scale);
}

export function disableDebugSpeed(): void {
  setScale(NORMAL_SCALE);
}

/** Test-only: reset the clock to real time (and clear persistence). */
export function _resetClock(): void {
  const nowMs = Date.now();
  state = { realAnchorMs: nowMs, appAnchorMs: nowMs, scale: NORMAL_SCALE };
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
