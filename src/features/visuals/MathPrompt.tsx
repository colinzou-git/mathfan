/**
 * MathPrompt — display-layer rendering for a plain prompt string. Detected
 * fraction patterns (1/4, 2/3, ?/6, 2/?) are rendered as stacked FractionText;
 * everything else (symbols like =, ▢, <, >, +, −, ×, ÷) renders as plain text.
 *
 * This does NOT change the underlying PracticeItem.prompt data model — it is a
 * presentation improvement only.
 */

import type { ReactNode } from 'react';
import { FractionText } from './FractionText';
import { findFractionsInText } from './visualModelUtils';

interface Props {
  text: string;
}

export function MathPrompt({ text }: Props) {
  const tokens = findFractionsInText(text);
  if (tokens.length === 0) return <>{text}</>;

  const parts: ReactNode[] = [];
  let cursor = 0;

  tokens.forEach((tok, i) => {
    if (tok.index > cursor) {
      parts.push(<span key={`t${i}`}>{text.slice(cursor, tok.index)}</span>);
    }
    parts.push(
      <FractionText key={`f${i}`} numerator={tok.numerator} denominator={tok.denominator} />,
    );
    cursor = tok.index + tok.raw.length;
  });

  if (cursor < text.length) {
    parts.push(<span key="tail">{text.slice(cursor)}</span>);
  }

  return <>{parts}</>;
}
