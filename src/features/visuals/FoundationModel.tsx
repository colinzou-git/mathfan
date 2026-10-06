import type { FoundationQuestionSpec } from '../curriculum/foundationTypes';
import { expandedParts } from '../curriculum/foundationItems';

const places = ['millions', 'hundred thousands', 'ten thousands', 'thousands', 'hundreds', 'tens', 'ones'];
export function FoundationModel({ spec, revealAnswer = false }: { spec: FoundationQuestionSpec; revealAnswer?: boolean }) {
  const visual = spec.visual;
  if (!visual) return null;
  const style = { width: '100%', maxWidth: 360, color: 'var(--text, #334155)', fontSize: 13 };
  if (visual.kind === 'place_value') {
    const hideLeft = spec.skillId === 'g4-nbt-ten-times' && spec.form === 'model' && !revealAnswer;
    return <div style={style} role="img" aria-label={hideLeft ? 'Place-value columns. Exchange ten smaller units for one unit in the next column to the left.' : `Place-value chart for ${visual.values.join(' and ')}.`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}>
        {places.map(place => <span key={place} style={{ textAlign: 'center', fontSize: 10, overflowWrap: 'anywhere' }}>{place}</span>)}
        {visual.values.map((value, row) => String(value).padStart(7, '0').split('').map((digit, i) => <span key={`${row}-${i}`} style={{ textAlign: 'center', padding: '8px 0', border: '1px solid #94a3b8', background: '#eef2ff' }}>{hideLeft && row === 0 ? '?' : digit}</span>))}
      </div>
      <p>10 units → 1 unit in the next place to the left.</p>
    </div>;
  }
  if (visual.kind === 'columns') {
    const maxDigits = Math.max(String(visual.a).length, String(visual.b).length);
    return <div style={style} role="img" aria-label={`${visual.recording === 'partial' ? 'Place-value decomposition' : 'Aligned columns'} for ${visual.a} ${visual.operation} ${visual.b}. Result hidden until submission.`}>
      {visual.recording === 'partial' ? <div>
        <p>{expandedParts(visual.a).join(' + ')}</p><p>{visual.operation} ({expandedParts(visual.b).join(' + ')})</p>
        <p>Combine or exchange equal place units.</p>
      </div> : <div style={{ fontFamily: 'monospace', fontSize: 24, textAlign: 'right', letterSpacing: 5 }}>
        <div>{String(visual.a).padStart(maxDigits, ' ')}</div>
        <div>{visual.operation} {String(visual.b).padStart(maxDigits, ' ')}</div>
        <div style={{ borderTop: '2px solid #64748b' }}>{revealAnswer ? visual.operation === '+' ? visual.a + visual.b : visual.a - visual.b : '?'}</div>
      </div>}
    </div>;
  }
  if (visual.kind === 'rectangles') {
    const [rows, cols] = visual.pairs[0];
    const w = 260, h = Math.max(50, Math.min(130, w * rows / cols));
    return <svg style={style} viewBox={`0 0 320 ${h + 55}`} role="img" aria-label={`Rectangle of ${visual.total} unit squares arranged in equal rows. One side has ${rows} rows; find or reason about its partner.`}>
      <rect x="35" y="20" width={w} height={h} fill="#e0e7ff" stroke="#6366f1" />
      {cols <= 20 && Array.from({ length: cols - 1 }, (_, i) => <path key={`c${i}`} d={`M ${35 + w * (i + 1) / cols} 20 v ${h}`} stroke="#818cf8" />)}
      {rows <= 12 && Array.from({ length: rows - 1 }, (_, i) => <path key={`r${i}`} d={`M 35 ${20 + h * (i + 1) / rows} h ${w}`} stroke="#818cf8" />)}
      <text x="5" y={h / 2 + 20} fontSize="13" fill="currentColor">{rows}</text>
      <text x="150" y={h + 40} fontSize="13" fill="currentColor">{revealAnswer ? cols : '?'} columns · {visual.total} squares</text>
    </svg>;
  }
  if (visual.kind === 'pattern') {
    return <div style={style} role="img" aria-label={`Pattern terms ${visual.terms.join(', ')}. The next term is hidden.`}>
      {visual.terms.map((term, index) => <div key={index} style={{ margin: '7px 0' }}>
        <span>Position {index + 1}: {term} {visual.shape ? 'squares' : ''} </span>
        {visual.shape && <div aria-hidden="true" style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>{Array.from({ length: term }, (_, i) => <span key={i} style={{ width: 10, height: 10, background: '#6366f1' }} />)}</div>}
      </div>)}
      <p>Position 4: ?</p>
    </div>;
  }
  const rounding = visual.kind === 'rounding';
  const hideBounds = rounding && spec.form === 'check' && !revealAnswer;
  const lower = rounding ? visual.lower : 0, upper = rounding ? visual.upper : visual.step * visual.count;
  const description = rounding ? hideBounds ? `Number line locating ${visual.value}. Find the neighboring multiples for the two unlabeled bounds.` : `Number line from ${lower} to ${upper} with ${visual.value} between the bounds. No rounded answer is selected.` : `First ${visual.count} of ${visual.totalCount} equal jumps of ${visual.step}, starting at zero. Continue the same jump size. Final landing label hidden.`;
  return <svg style={style} viewBox="0 0 360 90" role="img" aria-label={description}>
    <path d="M 25 45 H 335" stroke="#64748b" strokeWidth="2" />
    {rounding ? <>
      <path d="M 25 38 v 14 M 180 38 v 14 M 335 38 v 14" stroke="#64748b" />
      <circle cx={25 + 310 * (visual.value - lower) / (upper - lower)} cy="45" r="5" fill="#6366f1" />
      <text x="25" y="75" textAnchor="start" fontSize="12" fill="currentColor">{hideBounds ? '?' : lower.toLocaleString('en-US')}</text>
      <text x="335" y="75" textAnchor="end" fontSize="12" fill="currentColor">{hideBounds ? '?' : upper.toLocaleString('en-US')}</text>
      <text x="180" y="20" textAnchor="middle" fontSize="12" fill="currentColor">Locate {visual.value.toLocaleString('en-US')}</text>
    </> : <><text x="180" y="15" textAnchor="middle" fontSize="12" fill="currentColor">First {visual.count} of {visual.totalCount} jumps</text>{Array.from({ length: visual.count + 1 }, (_, i) => <g key={i}>
      <path d={`M ${25 + 310 * i / visual.count} 38 v 14`} stroke="#64748b" />
      <text x={25 + 310 * i / visual.count} y="73" textAnchor="middle" fontSize="12" fill="currentColor">{i === visual.count && !revealAnswer ? '?' : i * visual.step}</text>
      {i < visual.count && <path d={`M ${25 + 310 * i / visual.count} 40 q ${155 / visual.count} -35 ${310 / visual.count} 0`} fill="none" stroke="#6366f1" />}
    </g>)}</>}
  </svg>;
}
