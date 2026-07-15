import type { ArithmeticQuestionSpec } from '../curriculum/regrouping';

interface Props { spec: ArithmeticQuestionSpec; revealAnswer?: boolean; color?: string }

const places = ['hundreds', 'tens', 'ones'] as const;
const digitAt = (value: number, index: number) => Math.floor(value / 10 ** index) % 10;

export function PlaceValueRegroupModel({ spec, revealAnswer = false, color = '#4f46e5' }: Props) {
  const answer = spec.operation === 'addition' ? spec.a + spec.b : spec.a - spec.b;
  const visiblePlaces = spec.structure.digits === 3 ? places : places.slice(1);
  const actionText = spec.structure.columnActions
    .filter(column => column.action !== 'none')
    .map(column => `${column.action} in the ${column.place} place`)
    .join(', ');
  const label = revealAnswer
    ? `Place-value model for ${spec.a} ${spec.operation === 'addition' ? 'plus' : 'minus'} ${spec.b}; ${actionText || 'no regrouping'}; answer ${answer}`
    : `Place-value model with ${visiblePlaces.join(', ')} columns; ${actionText || 'no regrouping needed'}`;
  return (
    <div role="img" aria-label={label} style={{ width: 'min(100%, 360px)', overflowX: 'auto' }}>
      <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: `repeat(${visiblePlaces.length}, minmax(68px, 1fr))`, border: `2px solid ${color}`, borderRadius: 10 }}>
        {visiblePlaces.map((place, visibleIndex) => {
          const index = visiblePlaces.length - visibleIndex - 1;
          const action = spec.structure.columnActions.find(column => column.place === place)?.action ?? 'none';
          return (
            <div key={place} style={{ padding: 8, textAlign: 'center', borderLeft: visibleIndex ? `1px solid ${color}` : undefined }}>
              <strong style={{ display: 'block', fontSize: 12, textTransform: 'capitalize' }}>{place}</strong>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{digitAt(spec.a, index)}</div>
              <div style={{ fontSize: 20 }}>{spec.operation === 'addition' ? '+' : '−'} {digitAt(spec.b, index)}</div>
              {action !== 'none' && <div style={{ fontSize: 11, color, fontWeight: 700 }}>{action === 'compose' ? 'make a larger unit' : 'trade for 10'}</div>}
              {revealAnswer && <div style={{ borderTop: `1px solid ${color}`, marginTop: 5, fontSize: 22, fontWeight: 800 }}>{digitAt(answer, index)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
