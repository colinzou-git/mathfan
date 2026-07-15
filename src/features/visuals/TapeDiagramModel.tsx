import type { WordProblemSpec } from '../curriculum/wordProblemItems';

export function TapeDiagramModel({ spec, revealAnswer = false }: { spec: WordProblemSpec; revealAnswer?: boolean }) {
  return <figure aria-label={`Tape diagram for ${spec.contextSchema}`} style={{ margin: '1rem auto', maxWidth: 430 }}>
    <div style={{ display: 'flex', border: '2px solid currentColor', borderRadius: '.3rem' }}>
      {spec.quantities.map((quantity, index) => <div key={`${quantity.label}-${index}`} style={{ flex: 1, padding: '.7rem', borderLeft: index ? '1px solid currentColor' : undefined, textAlign: 'center' }}>
        <div>{quantity.label}</div><strong>{quantity.value === undefined && !revealAnswer ? '?' : quantity.value ?? '?'}</strong>
      </div>)}
    </div>
    <figcaption>Known parts and the unknown are kept in their story roles.</figcaption>
  </figure>;
}
