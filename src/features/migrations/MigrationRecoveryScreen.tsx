interface Props {
  error: string;
  retrying: boolean;
  onRetry: () => void;
  onExportDiagnostics: () => void;
}

export function MigrationRecoveryScreen({ error, retrying, onRetry, onExportDiagnostics }: Props) {
  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '48px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24 }}>Practice history needs attention</h1>
      <p>Your saved learning history has not been changed. MathFan paused before practice so it can protect your review schedule.</p>
      <p role="alert" style={{ padding: 12, borderRadius: 8, background: '#fff7ed', color: '#9a3412' }}>{error}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button onClick={onRetry} disabled={retrying}>{retrying ? 'Checking again…' : 'Retry safely'}</button>
        <button onClick={onExportDiagnostics}>Export diagnostics</button>
      </div>
    </main>
  );
}
