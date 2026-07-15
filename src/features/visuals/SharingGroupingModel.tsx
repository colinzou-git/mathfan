import type { DivisionQuestionSpec } from '../curriculum/divisionItems';

export function SharingGroupingModel({ spec, revealAnswer = false }: { spec: DivisionQuestionSpec; revealAnswer?: boolean }) {
  const sharing = spec.context?.interpretation === 'sharing';
  const groupCount = sharing ? spec.divisor : spec.quotient;
  return <figure aria-label={`${sharing ? 'Sharing' : 'Grouping'} model for ${spec.dividend} objects`} style={{ margin: '1rem auto', textAlign: 'center' }}>
    <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      {Array.from({ length: Math.min(groupCount, 12) }, (_, i) => <span key={i} style={{ border: '2px solid currentColor', borderRadius: '50%', padding: '.5rem' }}>● {revealAnswer ? `× ${sharing ? spec.quotient : spec.divisor}` : '…'}</span>)}
    </div>
    <figcaption>{sharing ? `${spec.dividend} shared among ${spec.divisor} groups` : `${spec.dividend} arranged ${spec.divisor} in each group`}</figcaption>
  </figure>;
}
