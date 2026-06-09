import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MathPrompt } from '../features/visuals/MathPrompt';
import { FractionText } from '../features/visuals/FractionText';

afterEach(cleanup);

describe('MathPrompt', () => {
  it('renders a numeric fraction with the spoken accessible label', () => {
    render(<MathPrompt text="1/4 = ?" />);
    expect(screen.getByLabelText('one fourth')).toBeInTheDocument();
    // The non-fraction remainder is still shown as text.
    expect(screen.getByText(/=/)).toBeInTheDocument();
  });

  it('renders an equivalent-fraction prompt with both fractions accessible', () => {
    render(<MathPrompt text="2/3 = ?/6" />);
    expect(screen.getByLabelText('two thirds')).toBeInTheDocument();
    expect(screen.getByLabelText('what number over six')).toBeInTheDocument();
  });

  it('renders a compare prompt with both fractions and no raw slash', () => {
    const { container } = render(<MathPrompt text="2/3 ▢ 3/4" />);
    expect(screen.getByLabelText('two thirds')).toBeInTheDocument();
    expect(screen.getByLabelText('three fourths')).toBeInTheDocument();
    expect(container.textContent).not.toContain('/');
  });

  it('passes through a non-fraction prompt unchanged', () => {
    render(<MathPrompt text="6 × 7 = ?" />);
    expect(screen.getByText('6 × 7 = ?')).toBeInTheDocument();
  });
});

describe('FractionText', () => {
  it('labels an unknown denominator as "two over what number"', () => {
    render(<FractionText numerator={2} denominator="?" />);
    expect(screen.getByLabelText('two over what number')).toBeInTheDocument();
  });

  it('honors an explicit ariaLabel override', () => {
    render(<FractionText numerator={3} denominator={4} ariaLabel="custom label" />);
    expect(screen.getByLabelText('custom label')).toBeInTheDocument();
  });
});
