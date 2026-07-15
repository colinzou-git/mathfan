import type { FractionComparisonStrategy, FractionValue } from '../fractions/types';
import { FractionBar } from './FractionBar';

interface Props { left: FractionValue; right: FractionValue; strategy: FractionComparisonStrategy; revealAnswer?: boolean; color?: string }

export function FractionComparisonModel({ left, right, strategy, revealAnswer = false, color }: Props) {
  const relation = left.numerator * right.denominator === right.numerator * left.denominator
    ? '=' : left.numerator * right.denominator < right.numerator * left.denominator ? '<' : '>';
  const label = revealAnswer
    ? `Equal-sized fraction bars show ${left.numerator}/${left.denominator} ${relation} ${right.numerator}/${right.denominator}`
    : `Two equal-sized fraction bars to compare using the ${strategy.replaceAll('_', ' ')} strategy`;
  return (
    <div role="img" aria-label={label} style={{ width: 'min(100%, 320px)', display: 'grid', gap: 12 }}>
      <div aria-hidden="true"><FractionBar {...left} fillColor={color} /></div>
      <div aria-hidden="true"><FractionBar {...right} fillColor={color} /></div>
    </div>
  );
}
