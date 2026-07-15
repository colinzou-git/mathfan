import type { MeasurementDataSpec } from '../curriculum/measurementTypes';
type Spec = Extract<MeasurementDataSpec, { kind: 'line_plot' }>;

export function LinePlotModel({ spec }: { spec: Spec }) {
  const min = Math.min(...spec.valuesInTicks), max = Math.max(...spec.valuesInTicks);
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const units = spec.unit === 'inch' ? 'inches' : `${spec.unit}s`;
  return <figure aria-label={`Line plot in ${units} divided into ${spec.denominator === 1 ? 'whole units' : spec.denominator === 2 ? 'halves' : 'quarters'}`} style={{ margin: '1rem auto', overflowX: 'auto' }}>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ticks.length}, minmax(2.5rem, 1fr))`, alignItems: 'end', borderBottom: '2px solid currentColor', minHeight: 120 }}>
      {ticks.map(tick => <div key={tick} style={{ textAlign: 'center' }}>
        <div aria-label={`${spec.valuesInTicks.filter(value => value === tick).length} observations at tick ${tick}`}>{spec.valuesInTicks.filter(value => value === tick).map((_, i) => <div key={i}>✕</div>)}</div>
        <div>|</div><div>{tick / spec.denominator}</div>
      </div>)}
    </div>
  </figure>;
}
