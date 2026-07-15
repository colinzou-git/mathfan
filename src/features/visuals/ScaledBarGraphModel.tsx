import type { MeasurementDataSpec } from '../curriculum/measurementTypes';
type Spec = Extract<MeasurementDataSpec, { kind: 'bar_graph' }>;

export function ScaledBarGraphModel({ spec, revealAnswer = false }: { spec: Spec; revealAnswer?: boolean }) {
  const max = Math.max(...spec.values, spec.scale);
  return <figure aria-label={`Scaled bar graph titled ${spec.title}; vertical axis counts by ${spec.scale}`} style={{ margin: '1rem auto', maxWidth: 420 }}>
    <div style={{ height: 190, display: 'flex', alignItems: 'end', gap: '1rem', borderLeft: '2px solid currentColor', borderBottom: '2px solid currentColor', padding: '0 1rem' }}>
      {spec.values.map((value, index) => <div key={spec.categories[index]} style={{ flex: 1, textAlign: 'center' }}>
        <div aria-label={`${spec.categories[index]} bar${spec.question === 'missing' && spec.requestedIndex === index && !revealAnswer ? ' missing' : ''}`} style={{ height: `${spec.question === 'missing' && spec.requestedIndex === index && !revealAnswer ? 12 : Math.max(12, value / max * 150)}px`, background: spec.question === 'missing' && spec.requestedIndex === index && !revealAnswer ? 'transparent' : 'var(--accent, #4f7cff)', border: spec.question === 'missing' && spec.requestedIndex === index && !revealAnswer ? '2px dashed currentColor' : undefined, borderRadius: '.3rem .3rem 0 0' }} />
        <span>{spec.categories[index]}</span>
      </div>)}
    </div>
    <figcaption>{spec.title} · Each grid step represents {spec.scale}</figcaption>
  </figure>;
}
