import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProfileSetup } from '../features/dashboard/ProfileSetup';
import type { StudentProfile } from '../types/math';

afterEach(cleanup);

function makeProfile(overrides: Partial<StudentProfile> = {}): StudentProfile {
  return {
    id: 'p1',
    learnerKey: 'k1',
    displayName: 'Alex',
    gradeLevel: 3,
    timezone: 'UTC',
    createdAt: '2026-01-01T00:00:00.000Z',
    settings: {
      audioEnabled: true,
      speechRate: 1,
      dailyGoalMinutes: 10,
      sessionLength: 10,
      autoAdvance: true,
      theme: 'indigo',
      allowTimedMode: true,
      competitionModeEnabled: false,
      parentModeEnabled: false,
    },
    ...overrides,
  };
}

describe('ProfileSetup', () => {
  it('shows the creation form directly when there are no existing profiles', () => {
    render(
      <ProfileSetup
        existingProfiles={[]}
        restoreState="idle"
        onSelectExisting={vi.fn()}
        onCreate={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText('e.g. Alex')).toBeTruthy();
  });

  it('lists existing profiles for selection instead of guessing one', () => {
    const existing = [makeProfile({ id: 'a', displayName: 'Sam' }), makeProfile({ id: 'b', displayName: 'Robin' })];
    render(
      <ProfileSetup
        existingProfiles={existing}
        restoreState="idle"
        onSelectExisting={vi.fn()}
        onCreate={vi.fn()}
      />
    );
    expect(screen.getByText(/Sam \(Grade 3\)/)).toBeTruthy();
    expect(screen.getByText(/Robin \(Grade 3\)/)).toBeTruthy();
  });

  it('calls onSelectExisting when an existing profile is chosen', () => {
    const onSelectExisting = vi.fn();
    const existing = [makeProfile({ id: 'a', displayName: 'Sam' })];
    render(
      <ProfileSetup
        existingProfiles={existing}
        restoreState="idle"
        onSelectExisting={onSelectExisting}
        onCreate={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText(/Sam \(Grade 3\)/));
    expect(onSelectExisting).toHaveBeenCalledWith(existing[0]);
  });

  it('creates a new profile immediately when no name/grade match exists', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <ProfileSetup
        existingProfiles={[makeProfile({ id: 'a', displayName: 'Sam' })]}
        restoreState="idle"
        onSelectExisting={vi.fn()}
        onCreate={onCreate}
      />
    );
    fireEvent.click(screen.getByText('Create a separate learner'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Alex'), { target: { value: 'Robin' } });
    fireEvent.click(screen.getByText('Start Learning →'));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0].displayName).toBe('Robin');
  });

  it('asks for confirmation instead of silently creating a duplicate-looking profile', () => {
    const onCreate = vi.fn();
    render(
      <ProfileSetup
        existingProfiles={[makeProfile({ id: 'a', displayName: 'Alex', gradeLevel: 3 })]}
        restoreState="idle"
        onSelectExisting={vi.fn()}
        onCreate={onCreate}
      />
    );
    fireEvent.click(screen.getByText('Create a separate learner'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Alex'), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByText('Start Learning →'));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText('Is this the same learner?')).toBeTruthy();
  });

  it('still allows creating a separate learner after a duplicate match is found', () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <ProfileSetup
        existingProfiles={[makeProfile({ id: 'a', displayName: 'Alex', gradeLevel: 3 })]}
        restoreState="idle"
        onSelectExisting={vi.fn()}
        onCreate={onCreate}
      />
    );
    fireEvent.click(screen.getByText('Create a separate learner'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Alex'), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByText('Start Learning →'));
    fireEvent.click(screen.getByText('Create a separate learner'));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('shows a retry option when restore is unavailable', () => {
    const onRestore = vi.fn();
    render(
      <ProfileSetup
        existingProfiles={[]}
        restoreState="unavailable"
        onSelectExisting={vi.fn()}
        onCreate={vi.fn()}
        onRestore={onRestore}
      />
    );
    fireEvent.click(screen.getByText('Try restoring again'));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});
