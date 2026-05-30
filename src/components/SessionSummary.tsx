interface LastSession {
  accuracy: number;
  averageLatencyMs: number;
}

interface Props {
  completedCount: number;
  correctCount: number;
  latencies: number[];
  fastestMs: number | null;
  missedFacts?: string[];
  lastSession?: LastSession | null;
  wasQuit?: boolean;
  onDone: () => void;
  onPlayAgain?: () => void;
}

export function SessionSummary({
  completedCount,
  correctCount,
  latencies,
  fastestMs,
  missedFacts = [],
  lastSession,
  wasQuit,
  onDone,
  onPlayAgain,
}: Props) {
  const accuracy = completedCount ? Math.round((correctCount / completedCount) * 100) : 0;
  const avgMs = latencies.length
    ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
    : 0;

  const vsLastAccuracy = lastSession
    ? Math.round((accuracy - lastSession.accuracy * 100))
    : null;
  const vsLastSpeed = lastSession && avgMs && lastSession.averageLatencyMs
    ? Math.round((lastSession.averageLatencyMs - avgMs) / 1000 * 10) / 10
    : null;

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={{ fontSize: '52px', textAlign: 'center' }}>
          {accuracy >= 90 ? '🌟' : accuracy >= 70 ? '👍' : '💪'}
        </div>
        <h2 style={s.title}>{wasQuit ? 'Session Ended' : 'Session Complete!'}</h2>
        {wasQuit && <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', margin: '-8px 0 12px' }}>You stopped early — nice work on what you did!</p>}

        <div style={s.statsGrid}>
          <StatBox label="Questions" value={String(completedCount)} />
          <StatBox label="Correct" value={String(correctCount)} color="#22c55e" />
          <StatBox label="Accuracy" value={`${accuracy}%`} color={accuracy >= 80 ? '#22c55e' : '#f59e0b'} />
          <StatBox
            label="Avg Speed"
            value={avgMs ? `${(avgMs / 1000).toFixed(1)}s` : '—'}
          />
        </div>

        {fastestMs && (
          <p style={s.best}>⚡ Fastest answer: {(fastestMs / 1000).toFixed(1)}s</p>
        )}

        {missedFacts.length > 0 && (
          <div style={s.missedBox}>
            <p style={s.missedTitle}>Practice these next time</p>
            <div style={s.missedChips}>
              {missedFacts.slice(0, 12).map(f => (
                <span key={f} style={s.missedChip}>{f}</span>
              ))}
              {missedFacts.length > 12 && (
                <span style={s.missedMore}>+{missedFacts.length - 12} more</span>
              )}
            </div>
          </div>
        )}

        {(vsLastAccuracy !== null || vsLastSpeed !== null) && (
          <div style={s.compareBox}>
            <p style={s.compareTitle}>vs. last session</p>
            {vsLastAccuracy !== null && (
              <p style={s.compareLine}>
                Accuracy: {vsLastAccuracy > 0 ? '+' : ''}{vsLastAccuracy}%{' '}
                {vsLastAccuracy > 0 ? '↑' : vsLastAccuracy < 0 ? '↓' : '→'}
              </p>
            )}
            {vsLastSpeed !== null && vsLastSpeed !== 0 && (
              <p style={s.compareLine}>
                Speed: {vsLastSpeed > 0 ? `${vsLastSpeed}s faster` : `${Math.abs(vsLastSpeed)}s slower`}{' '}
                {vsLastSpeed > 0 ? '↑' : '↓'}
              </p>
            )}
          </div>
        )}

        <div style={s.buttonRow}>
          {onPlayAgain && (
            <button style={s.secondaryBtn} onClick={onPlayAgain}>
              Practice Again
            </button>
          )}
          <button style={s.primaryBtn} onClick={onDone}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color = '#1f2937' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: '#f9fafb',
      borderRadius: '10px',
      padding: '12px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '440px',
    margin: '24px auto',
    padding: '16px',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#fff',
    borderRadius: '20px',
    padding: '28px 24px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: '22px',
    fontWeight: 'bold',
    textAlign: 'center',
    margin: '8px 0 20px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '16px',
  },
  best: {
    textAlign: 'center',
    fontSize: '14px',
    color: '#f59e0b',
    fontWeight: '600',
    margin: '4px 0 16px',
  },
  missedBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    padding: '12px 14px',
    marginBottom: '16px',
  },
  missedTitle: {
    fontSize: '12px',
    color: '#b91c1c',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: '0 0 8px',
  },
  missedChips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  missedChip: {
    fontSize: '14px', fontWeight: '600', color: '#991b1b',
    background: '#fff', border: '1px solid #fecaca', borderRadius: '6px',
    padding: '3px 8px', fontVariantNumeric: 'tabular-nums',
  },
  missedMore: { fontSize: '13px', color: '#b91c1c', alignSelf: 'center' },
  compareBox: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '20px',
  },
  compareTitle: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: '0 0 6px',
  },
  compareLine: {
    fontSize: '15px',
    color: '#166534',
    margin: '3px 0',
    fontWeight: '500',
  },
  buttonRow: { display: 'flex', gap: '10px' },
  primaryBtn: {
    flex: 1,
    padding: '14px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1,
    padding: '14px',
    background: '#fff',
    color: '#4f46e5',
    border: '2px solid #4f46e5',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};
