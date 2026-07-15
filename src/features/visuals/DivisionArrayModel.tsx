import type { DivisionQuestionSpec } from '../curriculum/divisionItems';

export function DivisionArrayModel({ spec, revealAnswer = false }: { spec: DivisionQuestionSpec; revealAnswer?: boolean }) {
  const known = spec.schema === 'unknown_factor' ? spec.divisor : Math.min(spec.divisor, 10);
  return <figure aria-label={`Array model for ${spec.dividend} divided by ${spec.divisor}`} style={{ margin: '1rem auto', textAlign: 'center' }}>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${known}, 1rem)`, gap: '.3rem', justifyContent: 'center' }}>
      {Array.from({ length: Math.min(spec.dividend, 100) }, (_, i) => <span key={i} aria-hidden="true">●</span>)}
    </div>
    <figcaption>{known} in one known dimension × {revealAnswer ? spec.quotient : '?'} in the other</figcaption>
  </figure>;
}
