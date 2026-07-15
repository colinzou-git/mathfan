import type { MeasurementDataSpec } from '../curriculum/measurementTypes';
import { buildElapsedTimeJumps } from '../curriculum/measurementItems';
type Spec = Extract<MeasurementDataSpec, { kind: 'elapsed_time' }>;
const fmt = (time: { hour: number; minute: number }) => `${time.hour}:${String(time.minute).padStart(2, '0')}`;

export function ElapsedTimeLineModel({ spec, revealAnswer = false }: { spec: Spec; revealAnswer?: boolean }) {
  const jumps = buildElapsedTimeJumps(spec.start, spec.end);
  return <figure aria-label={`Elapsed time line from ${fmt(spec.start)} to ${fmt(spec.end)}`} style={{ margin: '1rem auto', textAlign: 'center' }}>
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '.35rem' }}>
      <strong>{fmt(spec.start)}</strong>{jumps.map((jump, i) => <span key={i}>—{revealAnswer ? ` +${jump.minutes} min ` : ' jump '}→ <strong>{fmt(jump.to)}</strong></span>)}
    </div>
    <figcaption>Jump to a friendly hour, then continue to the end.</figcaption>
  </figure>;
}
