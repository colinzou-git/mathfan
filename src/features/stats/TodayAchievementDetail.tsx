import type { AchievementFilter, TodayAchievementData, TodayQuestionDetail } from './todayAchievement';
import { filterTodayQuestions } from './todayAchievement';

interface Props {
  filter: AchievementFilter;
  data: TodayAchievementData;
  onBack: () => void;
}

const FILTER_TITLES: Record<AchievementFilter, string> = {
  total:      'Total',
  due:        'Reviewed',
  practice:   'Practice',
  quiz:       'Quiz',
  improved:   'Improved',
  needsFocus: 'Need Focus',
};

const GROUP_LABELS: Record<string, string> = {
  mul:     'Multiply',
  unk:     'Multiply',
  div:     'Divide',
  add:     'Add',
  sub:     'Subtract',
  frac:    'Fractions',
  word:    'Word Problems',
  round:   'Rounding',
  factors: 'Primes & Factors',
  dec:     'Decimals',
  other:   'Other',
};

const GROUP_ORDER = ['mul', 'unk', 'div', 'add', 'sub', 'frac', 'word', 'round', 'factors', 'dec', 'other'];

function fmtSec(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function QuestionRow({ q }: { q: TodayQuestionDetail }) {
  if (q.isSkipped) {
    return (
      <div style={s.row}>
        <span style={s.prompt}>{q.prompt}</span>
        <span style={s.answer}>= {String(q.correctAnswer)}</span>
        <span style={s.skippedBadge}>SKIPPED</span>
      </div>
    );
  }

  return (
    <div style={s.row}>
      <span style={s.prompt}>{q.prompt}</span>
      <span style={s.answer}>= {String(q.correctAnswer)}</span>
      <span style={s.meta}>
        {q.tries === 1 ? '1 try' : `${q.tries} tries`}
        {q.latencyMs > 0 && <span style={s.time}> · {fmtSec(q.latencyMs)}</span>}
        {q.encouragingIcon && <span style={s.spark} title="Faster than before!"> ⚡</span>}
        {!q.encouragingIcon && q.improved && (
          <span style={s.improved} title="Improved"> 💪</span>
        )}
        {q.needsFocus && !q.improved && (
          <span style={s.focus} title="Needs more practice"> 🔴</span>
        )}
      </span>
    </div>
  );
}

export function TodayAchievementDetail({ filter, data, onBack }: Props) {
  const questions = filterTodayQuestions(data.questions, filter);
  const summary = data[filter];

  // Group by display group (merge 'unk' → 'mul')
  const normalizeGroup = (g: string) => (g === 'unk' ? 'mul' : g);
  const grouped = new Map<string, TodayQuestionDetail[]>();
  for (const q of questions) {
    const g = normalizeGroup(q.group);
    const arr = grouped.get(g) ?? [];
    arr.push(q);
    grouped.set(g, arr);
  }

  // Sort within each group: non-skipped first (firstCorrect first, then by latency),
  // skipped at end
  for (const [g, qs] of grouped) {
    grouped.set(g, [
      ...qs.filter(q => !q.isSkipped).sort((a, b) => {
        if (a.firstCorrect !== b.firstCorrect) return a.firstCorrect ? -1 : 1;
        return a.latencyMs - b.latencyMs;
      }),
      ...qs.filter(q => q.isSkipped),
    ]);
  }

  const orderedGroups = GROUP_ORDER.filter(g => grouped.has(g));

  return (
    <div style={s.container}>
      <header style={s.header}>
        <button style={s.backBtn} onClick={onBack}>← Back</button>
        <div style={s.headerCenter}>
          <h2 style={s.title}>{FILTER_TITLES[filter]}</h2>
          <span style={s.subtitle}>
            {summary.count} question{summary.count !== 1 ? 's' : ''} · {Math.round(summary.accuracy * 100)}% first-try
          </span>
        </div>
      </header>

      {questions.length === 0 ? (
        <p style={s.empty}>No questions for this category today.</p>
      ) : (
        <div style={s.content}>
          {orderedGroups.map(g => {
            const qs = grouped.get(g)!;
            return (
              <div key={g} style={s.group}>
                <p style={s.groupLabel}>
                  {GROUP_LABELS[g] ?? g}
                  <span style={s.groupCount}> ({qs.length})</span>
                </p>
                <div style={s.groupRows}>
                  {qs.map(q => <QuestionRow key={q.key} q={q} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '480px', margin: '0 auto', padding: '0', fontFamily: 'system-ui, sans-serif',
    minHeight: '100dvh', background: '#fff',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '16px', borderBottom: '1.5px solid #f3f4f6',
    position: 'sticky', top: 0, background: '#fff', zIndex: 10,
  },
  backBtn: {
    background: 'none', border: 'none', fontSize: '16px', fontWeight: '600',
    color: 'var(--primary)', cursor: 'pointer', padding: '6px 0', flexShrink: 0,
    fontFamily: 'inherit',
  },
  headerCenter: { flex: 1 },
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#1f2937' },
  subtitle: { fontSize: '13px', color: '#6b7280' },
  content: { padding: '12px 16px 32px' },
  empty: { padding: '48px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '15px' },
  group: { marginBottom: '20px' },
  groupLabel: {
    fontSize: '13px', fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px',
  },
  groupCount: { fontWeight: '400', color: '#9ca3af' },
  groupRows: {
    background: '#f9fafb', borderRadius: '12px', overflow: 'hidden',
    border: '1px solid #f3f4f6',
  },
  row: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', borderBottom: '1px solid #f3f4f6',
    fontSize: '15px',
  },
  prompt: { fontWeight: '600', color: '#1f2937', minWidth: '72px' },
  answer: { color: '#6b7280', flex: 1 },
  meta: { color: '#6b7280', fontSize: '13px', display: 'flex', alignItems: 'center', flexShrink: 0 },
  time: { color: '#9ca3af' },
  spark: { color: '#f59e0b', marginLeft: '4px', fontSize: '14px' },
  improved: { marginLeft: '4px', fontSize: '14px' },
  focus: { marginLeft: '4px', fontSize: '12px' },
  skippedBadge: {
    fontSize: '11px', fontWeight: '700', color: '#9ca3af',
    background: '#f3f4f6', borderRadius: '6px', padding: '2px 8px',
    flexShrink: 0,
  },
};
