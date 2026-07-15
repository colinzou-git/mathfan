import type { FractionValue } from '../fractions/types';
import { FractionBar } from './FractionBar';

interface Props { left: FractionValue; right: FractionValue; revealAnswer?: boolean; color?: string }

export function FractionEquivalenceModel({ left, right, revealAnswer = false, color }: Props) {
  const label = revealAnswer
    ? `Aligned fraction bars showing ${left.numerator}/${left.denominator} and ${right.numerator}/${right.denominator} as equal amounts`
    : `Two equal-sized fraction bars, partitioned into ${left.denominator} and ${right.denominator} equal parts`;
  return (
    <div role="img" aria-label={label} style={{ width: 'min(100%, 320px)', display: 'grid', gap: 12 }}>
      <div aria-hidden="true"><FractionBar {...left} fillColor={color} showLabel={revealAnswer} /></div>
      <div aria-hidden="true"><FractionBar {...right} fillColor={color} showLabel={revealAnswer} /></div>
    </div>
  );
}
