/**
 * FractionText — an inline stacked fraction (numerator over denominator with a
 * horizontal bar) that aligns naturally inside prompt text.
 *
 * The visual parts are aria-hidden; a single accessible label (defaulting to the
 * spoken fraction, e.g. "one fourth") is exposed so screen readers don't read
 * "1 4" awkwardly.
 */

import { fractionToWords } from '../audio/mathSpeech';

interface Props {
  numerator: number | string;
  denominator: number | string;
  /** Accessible label override. Defaults to the spoken fraction. */
  ariaLabel?: string;
  /** Slightly smaller rendering for dense layouts. */
  compact?: boolean;
}

export function FractionText({ numerator, denominator, ariaLabel, compact = false }: Props) {
  const label = ariaLabel ?? fractionToWords(numerator, denominator);

  return (
    <span
      role="img"
      aria-label={label}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        lineHeight: 1.05,
        fontSize: compact ? '0.72em' : '0.82em',
        margin: '0 0.18em',
      }}
    >
      <span aria-hidden="true" style={{ padding: '0 0.2em' }}>{numerator}</span>
      <span
        aria-hidden="true"
        style={{ display: 'block', width: '100%', borderTop: '0.09em solid currentColor' }}
      />
      <span aria-hidden="true" style={{ padding: '0 0.2em' }}>{denominator}</span>
    </span>
  );
}
