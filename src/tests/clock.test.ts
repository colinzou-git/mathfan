import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  appNowMs, appNow, enableDebugSpeed, disableDebugSpeed, isDebugSpeed,
  getScale, _resetClock, DEBUG_SCALE, NORMAL_SCALE,
} from '../features/time/clock';

describe('app clock', () => {
  beforeEach(() => { _resetClock(); });
  afterEach(() => { _resetClock(); vi.useRealTimers(); });

  it('runs at real time by default', () => {
    expect(getScale()).toBe(NORMAL_SCALE);
    expect(isDebugSpeed()).toBe(false);
    expect(Math.abs(appNowMs() - Date.now())).toBeLessThan(50);
  });

  it('debug speed compresses ~1 day into 20 real seconds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    enableDebugSpeed();
    expect(isDebugSpeed()).toBe(true);
    expect(getScale()).toBe(DEBUG_SCALE);

    const start = appNowMs();
    vi.advanceTimersByTime(20_000); // 20 real seconds
    const elapsedAppMs = appNowMs() - start;
    // 20s × 4320 = 86,400,000 ms = exactly one day
    expect(elapsedAppMs).toBeCloseTo(86_400_000, -3);
  });

  it('is monotonic across a scale change (no backward jump)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
    enableDebugSpeed();
    vi.advanceTimersByTime(10_000);
    const before = appNowMs();
    disableDebugSpeed();
    const after = appNowMs();
    expect(after).toBeGreaterThanOrEqual(before);
    expect(getScale()).toBe(NORMAL_SCALE);
  });

  it('appNow returns a Date', () => {
    expect(appNow()).toBeInstanceOf(Date);
  });
});
