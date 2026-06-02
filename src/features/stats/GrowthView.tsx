import { useEffect, useState, useMemo } from 'react';
import type { AttemptLog, FactGrowth, GrowthSummary } from '../../types/math';
import { mathAnswerEventRepo } from '../../db/repositories';
import { computeFactGrowth, growthWindows, eventsToAttemptLogs, type GrowthPeriod } from './statsEngine';
import { appNow } from '../time/clock';

interface Props { studentId: string }

const PERIOD_LABELS: Record<GrowthPeriod, { title: string; vs: string }> = {
  day:   { title: 'Today',      vs: 'yesterday' },
  week:  { title: 'This Week',  vs: 'last week' },
  month: { title: 'This Month', vs: 'last month' },
};

export function GrowthView({ studentId }: Props) {
  const [attempts, setAttempts] = useState<AttemptLog[]>([]);
  const [period, setPeriod] = useState<GrowthPeriod>('day');

  useEffect(() => {
    // mathAnswerEvents is the source of truth; adapt to AttemptLog for statsEngine.
    mathAnswerEventRepo.getAll(studentId).then(evts => setAttempts(eventsToAttemptLogs(evts)));
  }, [studentId]);

  const summary: GrowthSummary = useMemo(() => {
    const [cs, ce, ps, pe] = growthWindows(period, appNow());
    return computeFactGrowth(attempts, cs, ce, ps, pe);
  }, [attempts, period]);

  const { title, vs } = PERIOD_LABELS[period];
  const hasAny = summary.stronger.length || summary.weaker.length ||
    summary.same.length || summary.newFacts.length;

  return (
    <div>
      {/* Period selector */}
      <div style={s.periodRow}>
        {(['day', 'week', 'month'] as GrowthPeriod[]).map(p => (
          <button
            key={p}
            style={{ ...s.periodBtn, ...(period === p ? s.periodOn : {}) }}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p].title}
          </button>
        ))}
      </div>

      <p style={s.intro}>
        Comparing <strong>{title.toLowerCase()}</strong> against <strong>{vs}</strong> — which facts changed.
      </p>

      {!hasAny ? (
        <p style={s.empty}>
          No practice {title.toLowerCase()} yet. Do a drill to see your growth!
        </p>
      ) : (
        <>
          {/* Counts banner */}
          <div style={s.banner}>
            <Counter n={summary.stronger.length} label="Stronger" color="#15803d" icon="▲" />
            <Counter n={summary.weaker.length} label="Weaker" color="#b91c1c" icon="▼" />
            <Counter n={summary.newFacts.length} label="New" color="#1e40af" icon="✦" />
          </div>

          <GrowthGroup
            title="💪 Got stronger"
            subtitle={`Better accuracy or speed than ${vs}`}
            facts={summary.stronger}
            accent="#15803d"
            emptyText={`No facts improved over ${vs} yet.`}
          />

          <GrowthGroup
            title="📉 Needs attention"
            subtitle={`Lower accuracy or slower than ${vs}`}
            facts={summary.weaker}
            accent="#b91c1c"
            emptyText={`Nothing slipped versus ${vs}. `}
          />

          {summary.newFacts.length > 0 && (
            <GrowthGroup
              title="✦ New this period"
              subtitle={`Practiced ${title.toLowerCase()} but not ${vs}`}
              facts={summary.newFacts}
              accent="#1e40af"
              emptyText=""
            />
          )}
        </>
      )}
    </div>
  );
}

function Counter({ n, label, color, icon }: { n: number; label: string; color: string; icon: string }) {
  return (
    <div style={s.counter}>
      <div style={{ fontSize: '22px', fontWeight: 'bold', color }}>
        <span style={{ fontSize: '14px' }}>{icon}</span> {n}
      </div>
      <div style={{ fontSize: '11px', color: '#6b7280' }}>{label}</div>
    </div>
  );
}

function GrowthGroup({ title, subtitle, facts, accent, emptyText }: {
  title: string; subtitle: string; facts: FactGrowth[]; accent: string; emptyText: string;
}) {
  if (facts.length === 0 && !emptyText) return null;
  return (
    <div style={s.group}>
      <div style={s.groupHeader}>
        <h3 style={{ ...s.groupTitle, color: accent }}>{title}</h3>
        <span style={s.groupSub}>{subtitle}</span>
      </div>
      {facts.length === 0 ? (
        <p style={s.groupEmpty}>{emptyText}</p>
      ) : (
        <div style={s.chips}>
          {facts.map(f => <FactChip key={f.itemId} fact={f} accent={accent} />)}
        </div>
      )}
    </div>
  );
}

function FactChip({ fact, accent }: { fact: FactGrowth; accent: string }) {
  const accPct = Math.round(fact.accuracyDelta * 100);
  const speedSec = (fact.speedDeltaMs / 1000).toFixed(1);

  let detail = '';
  if (fact.direction === 'new') {
    detail = `${Math.round(fact.current.accuracy * 100)}%`;
  } else if (Math.abs(accPct) >= 5) {
    detail = `${accPct > 0 ? '+' : ''}${accPct}%`;
  } else if (Math.abs(fact.speedDeltaMs) >= 400) {
    detail = `${fact.speedDeltaMs > 0 ? '−' : '+'}${Math.abs(Number(speedSec))}s`;
  }

  return (
    <div
      style={{ ...s.chip, borderColor: accent + '60', background: accent + '0e' }}
      title={chipTitle(fact)}
    >
      <span style={s.chipFact}>{fact.prompt}</span>
      {detail && <span style={{ ...s.chipDetail, color: accent }}>{detail}</span>}
    </div>
  );
}

function chipTitle(f: FactGrowth): string {
  const cur = `now: ${Math.round(f.current.accuracy * 100)}% acc`
    + (f.current.avgCorrectLatencyMs ? `, ${(f.current.avgCorrectLatencyMs / 1000).toFixed(1)}s` : '');
  if (!f.previous) return `New this period — ${cur}`;
  const prev = `before: ${Math.round(f.previous.accuracy * 100)}% acc`
    + (f.previous.avgCorrectLatencyMs ? `, ${(f.previous.avgCorrectLatencyMs / 1000).toFixed(1)}s` : '');
  return `${f.prompt}\n${cur}\n${prev}`;
}

const s: Record<string, React.CSSProperties> = {
  periodRow: { display: 'flex', gap: '8px', marginBottom: '12px' },
  periodBtn: { flex: 1, padding: '9px 4px', border: '2px solid #e5e7eb', borderRadius: '10px', background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '500' },
  periodOn: { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)' },
  intro: { fontSize: '13px', color: '#6b7280', margin: '0 0 14px' },
  empty: { textAlign: 'center', color: '#9ca3af', padding: '32px 16px', fontSize: '14px' },
  banner: { display: 'flex', gap: '8px', marginBottom: '16px' },
  counter: { flex: 1, background: '#fff', borderRadius: '10px', padding: '10px 4px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  group: { marginBottom: '20px' },
  groupHeader: { marginBottom: '8px' },
  groupTitle: { fontSize: '15px', fontWeight: 'bold', margin: 0 },
  groupSub: { fontSize: '12px', color: '#9ca3af' },
  groupEmpty: { fontSize: '13px', color: '#9ca3af', margin: '4px 0', fontStyle: 'italic' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  chip: { display: 'flex', alignItems: 'center', gap: '6px', border: '1.5px solid', borderRadius: '8px', padding: '5px 9px' },
  chipFact: { fontSize: '14px', fontWeight: '600', color: '#111827', fontVariantNumeric: 'tabular-nums' },
  chipDetail: { fontSize: '12px', fontWeight: '700' },
};
