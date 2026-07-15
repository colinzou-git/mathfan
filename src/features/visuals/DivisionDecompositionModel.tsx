import type { DivisionQuestionSpec } from '../curriculum/divisionItems';

export function DivisionDecompositionModel({ spec, revealAnswer = false }: { spec: DivisionQuestionSpec; revealAnswer?: boolean }) {
  const parts = spec.decomposition ?? [];
  if (spec.schema === 'verify_with_multiplication') return <figure aria-label={`Verification model for ${spec.dividend} divided by ${spec.divisor}`} style={{ margin: '1rem auto', textAlign: 'center' }}>
    <div>{revealAnswer ? spec.quotient : '?'} × {spec.divisor} = {spec.dividend}</div>
    <figcaption>Multiplication checks the division.</figcaption>
  </figure>;
  return <figure aria-label={`Decomposition model for ${spec.dividend} divided by ${spec.divisor}`} style={{ margin: '1rem auto', textAlign: 'center' }}>
    <div>{spec.dividend} = {parts.map(part => part.dividendPart).join(' + ')}</div>
    <div>{parts.map(part => `${part.dividendPart} ÷ ${spec.divisor} = ${revealAnswer ? part.quotientPart : '?'}`).join('  +  ')}</div>
    <figcaption>Add the partial quotients{revealAnswer ? ` to get ${spec.quotient}` : '.'}</figcaption>
  </figure>;
}
