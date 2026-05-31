import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TutorChat } from '../features/ai/TutorChat';
import { SessionSummary } from '../components/SessionSummary';
import { NumPad } from '../components/NumPad';

afterEach(cleanup);

describe('TutorChat', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

  it('renders the not-configured state when no AI key is set', () => {
    render(
      <TutorChat
        context={{ prompt: '7 × 8', answer: 56, itemType: 'multiplication_fact' }}
        onClose={() => {}}
        onOpenSettings={() => {}}
      />
    );
    expect(screen.getByText(/isn't set up/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open settings/i })).toBeInTheDocument();
  });
});

describe('SessionSummary', () => {
  it('shows first-try accuracy (not completion %) and a missed-facts list', () => {
    render(
      <SessionSummary
        completedCount={10}
        correctCount={10}
        firstTryCount={7}
        correctedCount={2}
        repeatedCount={1}
        slowFirstTryCount={1}
        attemptCount={14}
        latencies={[1200, 1500]}
        fastestMs={1200}
        missedFacts={['7 × 8', '6 × 9']}
        onDone={() => {}}
      />
    );
    expect(screen.getByText(/Session Complete/i)).toBeInTheDocument();
    // 7 of 10 solved on the first try → 70%, even though all 10 were eventually correct.
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText(/Practice these next time/i)).toBeInTheDocument();
    expect(screen.getByText('7 × 8')).toBeInTheDocument();
  });
});

describe('NumPad', () => {
  it('shows a decimal key only when allowDecimal is set', () => {
    const { rerender } = render(<NumPad value="" onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Decimal point' })).toBeNull();
    rerender(<NumPad value="" onChange={() => {}} onSubmit={() => {}} allowDecimal />);
    expect(screen.getByRole('button', { name: 'Decimal point' })).toBeInTheDocument();
  });
});
