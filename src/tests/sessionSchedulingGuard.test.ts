import { describe, expect, it } from 'vitest';
import { createSessionSchedulingGuard } from '../features/scheduler/sessionSchedulingGuard';

describe('SessionSchedulingGuard', () => {
  it('allows scheduling on a card\'s first presentation-first-attempt', () => {
    const guard = createSessionSchedulingGuard();
    guard.presentationStarted('fact:mul:7x8');
    expect(guard.canSchedule('fact:mul:7x8', 1)).toBe(true);
  });

  it('does not allow scheduling on a retry (attemptNo > 1)', () => {
    const guard = createSessionSchedulingGuard();
    guard.presentationStarted('fact:mul:7x8');
    expect(guard.canSchedule('fact:mul:7x8', 2)).toBe(false);
  });

  it('does not allow scheduling again once marked scheduled, even on a later presentation', () => {
    const guard = createSessionSchedulingGuard();
    guard.presentationStarted('fact:mul:7x8');
    guard.markScheduled('fact:mul:7x8');

    guard.presentationStarted('fact:mul:7x8'); // same card shown again later in the session
    expect(guard.canSchedule('fact:mul:7x8', 1)).toBe(false);
  });

  it('tracks presentation counts independently per card', () => {
    const guard = createSessionSchedulingGuard();
    expect(guard.presentationStarted('fact:mul:7x8')).toBe(1);
    expect(guard.presentationStarted('fact:mul:7x8')).toBe(2);
    expect(guard.presentationStarted('fact:div:56/7')).toBe(1);
  });

  it('different cards schedule independently', () => {
    const guard = createSessionSchedulingGuard();
    guard.presentationStarted('fact:mul:7x8');
    guard.markScheduled('fact:mul:7x8');
    guard.presentationStarted('fact:div:56/7');
    expect(guard.canSchedule('fact:div:56/7', 1)).toBe(true);
  });

  it('releaseScheduled lets a later presentation schedule after a failed write', () => {
    const guard = createSessionSchedulingGuard();
    guard.presentationStarted('fact:mul:7x8');
    guard.markScheduled('fact:mul:7x8');
    guard.releaseScheduled('fact:mul:7x8');

    guard.presentationStarted('fact:mul:7x8');
    expect(guard.canSchedule('fact:mul:7x8', 1)).toBe(true);
  });

  it('reset clears both scheduled cards and presentation counts', () => {
    const guard = createSessionSchedulingGuard();
    guard.presentationStarted('fact:mul:7x8');
    guard.markScheduled('fact:mul:7x8');

    guard.reset();

    expect(guard.presentationStarted('fact:mul:7x8')).toBe(1);
    expect(guard.canSchedule('fact:mul:7x8', 1)).toBe(true);
  });
});
