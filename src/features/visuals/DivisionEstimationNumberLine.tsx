import type { CSSProperties } from 'react';
import type { DivisionEstimationQuestionSpec } from '../curriculum/divisionEstimationItems';

interface Props {
  spec: DivisionEstimationQuestionSpec;
  revealAnswer?: boolean;
}

export function DivisionEstimationNumberLine({ spec, revealAnswer = false }: Props) {
  const same = spec.lowerCompatibleDividend === spec.upperCompatibleDividend;
  const span = spec.upperCompatibleDividend - spec.lowerCompatibleDividend;
  const currentX = same ? 170 : 40 + ((spec.dividend - spec.lowerCompatibleDividend) / span) * 260;
  const label = same
    ? `${spec.dividend} is already compatible with ${spec.divisor}.`
    : `${spec.dividend} lies between compatible dividends ${spec.lowerCompatibleDividend} and ${spec.upperCompatibleDividend}.`;

  return (
    <figure style={s.figure} aria-label={`Number line. ${label}`}>
      <svg width="340" height={revealAnswer ? 126 : 102} viewBox={`0 0 340 ${revealAnswer ? 126 : 102}`} role="img">
        <line x1="40" y1="46" x2="300" y2="46" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
        {!same && (
          <>
            <Tick x={40} label={spec.lowerCompatibleDividend} />
            <Tick x={300} label={spec.upperCompatibleDividend} />
          </>
        )}
        <line x1={currentX} y1="30" x2={currentX} y2="62" stroke="#0f766e" strokeWidth="4" />
        <circle cx={currentX} cy="46" r="7" fill="#0f766e" />
        <text x={currentX} y="24" textAnchor="middle" fontSize="16" fontWeight="800" fill="#115e59">
          {spec.dividend}
        </text>
        {same && <text x="170" y="82" textAnchor="middle" fontSize="14" fill="#475569">compatible dividend</text>}
        {revealAnswer && !same && (
          <>
            <text x="40" y="98" textAnchor="middle" fontSize="13" fill="#475569">{spec.lowerCompatibleDividend} ÷ {spec.divisor} = {spec.lowerEstimate}</text>
            <text x="300" y="98" textAnchor="middle" fontSize="13" fill="#475569">{spec.upperCompatibleDividend} ÷ {spec.divisor} = {spec.upperEstimate}</text>
          </>
        )}
      </svg>
      <figcaption style={s.caption}>{label}</figcaption>
    </figure>
  );
}

function Tick({ x, label }: { x: number; label: number }) {
  return (
    <>
      <line x1={x} y1="34" x2={x} y2="58" stroke="#64748b" strokeWidth="3" />
      <text x={x} y="82" textAnchor="middle" fontSize="15" fontWeight="700" fill="#334155">{label}</text>
    </>
  );
}

const s: Record<string, CSSProperties> = {
  figure: { margin: 0, maxWidth: '100%', textAlign: 'center' },
  caption: { color: '#64748b', fontSize: '12px', marginTop: '-4px' },
};
