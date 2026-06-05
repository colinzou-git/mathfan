import type { CSSProperties } from 'react';

interface LastSession {
  firstTryAccuracy: number | null; // 0–1
  averageLatencyMs: number;
}

interface Props {
  completedCount: number;
  correctCount: number;
  firstTryCount?: number;
  correctedCount?: number;
  repeatedCount?: number;
  slowFirstTryCount?: number;
  attemptCount?: number;
  plannedCount?: number;
  latencies: number[];
  fastestMs: number | null;
  missedFacts?: string[];
  lastSession?: LastSession | null;
  wasQuit?: boolean;
  onDone: () => void;
  onPlayAgain?: () => void;
  onBack?: () => void;
}

export function SessionSummary({
  completedCount,
  firstTryCount = 0,
  correctedCount = 0,
  repeatedCount = 0,
  slowFirstTryCount = 0,
  attemptCount,
  plannedCount,
  latencies,
  fastestMs,
  missedFacts = [],
  lastSession,
  wasQuit,
  onDone,
  onPlayAgain,
  onBack,
}: Props) {
  const firstTryPct = completedCount ? Math.round((firstTryCount / completedCount) * 100) : 0;
  const learningMoments = correctedCount + repeatedCount;
  const avgMs = latencies.length
    ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
    : 0;
  const retries = attemptCount !== undefined ? attemptCount - completedCount : null;
  const attemptAccPct = attemptCount ? Math.round((completedCount / attemptCount) * 100) : null;
  const showAttemptAcc = attemptAccPct !== null && attemptAccPct !== firstTryPct;
  const eventualPct = plannedCount ? Math.round((completedCount / plannedCount) * 100) : null;

  const lastFirstTryPct = lastSession && lastSession.firstTryAccuracy !== null
    ? Math.round(lastSession.firstTryAccuracy * 100)
    : null;
  const vsLastAccuracy = lastFirstTryPct !== null ? firstTryPct - lastFirstTryPct : null;
  const vsLastSpeed = lastSession && avgMs && lastSession.averageLatencyMs
    ? Math.round((lastSession.averageLatencyMs - avgMs) / 1000 * 10) / 10
    : null;

  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={{ fontSize: '52px', textAlign: 'center' }}>
          {firstTryPct >= 90 ? '🌟' : firstTryPct >= 70 ? '👍' : '💪'}
        </div>
        <h2 style={s.title}>{wasQuit ? 'Session Ended' : 'Session Complete!'}</h2>
        {wasQuit && <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', margin: '-8px 0 12px' }}>You stopped early — nice work on what you did!</p>}

        <p style={s.headline}>
          You solved {completedCount} {completedCount === 1 ? 'problem' : 'problems'}.
        </p>

        {/* Kid-friendly, non-shaming framing */}
        <div style={s.buckets}>
          <div style={s.bucket}>
            <div style={s.bucketValue}>⚡ {firstTryCount}</div>
            <div style={s.bucketLabel}>{firstTryCount === 1 ? 'instant win' : 'instant wins'}</div>
          </div>
          <div style={s.bucket}>
            <div style={s.bucketValue}>🌱 {learningMoments}</div>
            <div style={s.bucketLabel}>{learningMoments === 1 ? 'learning moment' : 'learning moments'}</div>
          </div>
        </div>

        <div style={s.statsGrid}>
          <StatBox label="First-try" value={`${firstTryPct}%`} color={firstTryPct >= 80 ? '#22c55e' : '#f59e0b'} />
          <StatBox label="Avg Speed" value={avgMs ? `${(avgMs / 1000).toFixed(1)}s` : '—'} />
        </div>

        {fastestMs && (
          <p style={s.best}>⚡ Fastest answer: {(fastestMs / 1000).toFixed(1)}s</p>
        )}

        {/* Honest breakdown for grown-ups */}
        <details style={s.grownup}>
          <summary style={s.grownupSummary}>For grown-ups</summary>
          <ul style={s.grownupList}>
            <li>First-try accuracy: {firstTryPct}% ({firstTryCount}/{completedCount})</li>
            {showAttemptAcc && <li>Attempt accuracy: {attemptAccPct}% (correct submissions / all submissions)</li>}
            {eventualPct !== null && eventualPct < 100 && (
              <li>Completed: {completedCount}/{plannedCount} ({eventualPct}%)</li>
            )}
            <li>Corrected after feedback: {correctedCount}</li>
            {repeatedCount > 0 && <li>Needed several tries: {repeatedCount}</li>}
            {slowFirstTryCount > 0 && <li>Right but slow (build fluency): {slowFirstTryCount}</li>}
            {retries !== null && retries > 0 && <li>Total re-tries: {retries}</li>}
          </ul>
        </details>

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
                First-try accuracy: {vsLastAccuracy > 0 ? '+' : ''}{vsLastAccuracy}%{' '}
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
          {onBack && (
            <button style={s.secondaryBtn} onClick={onBack}>
              ← Back
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

const s: Record<string, CSSProperties> = {
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
    margin: '8px 0 16px',
  },
  headline: {
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
    margin: '0 0 16px',
  },
  buckets: {
    display: 'flex',
    justifyContent: 'center',
    gap: '28px',
    marginBottom: '18px',
  },
  bucket: { textAlign: 'center' },
  bucketValue: { fontSize: '26px', fontWeight: 'bold', color: '#4f46e5' },
  bucketLabel: { fontSize: '13px', color: '#6b7280' },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '12px',
  },
  best: {
    textAlign: 'center',
    fontSize: '14px',
    color: '#f59e0b',
    fontWeight: '600',
    margin: '4px 0 12px',
  },
  grownup: {
    background: '#f9fafb',
    borderRadius: '10px',
    padding: '10px 14px',
    marginBottom: '16px',
    fontSize: '13px',
    color: '#6b7280',
  },
  grownupSummary: { cursor: 'pointer', fontWeight: 600, color: '#4b5563' },
  grownupList: { margin: '8px 0 0', paddingLeft: '18px' },
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
