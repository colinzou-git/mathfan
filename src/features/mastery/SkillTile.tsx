import type { MasterySkillNode } from './grade3MasteryMap';
import type { StudentSkillSummary, SkillSummaryStatus } from './skillMasteryEngine';

interface Props {
  skill: MasterySkillNode;
  summary?: StudentSkillSummary;
  locked?: boolean;
  onClick: (skillId: string) => void;
}

const STATUS_CONFIG: Record<SkillSummaryStatus, { color: string; bg: string; icon: string; label: string }> = {
  new:            { color: '#6b7280', bg: '#f9fafb', icon: '🔵', label: 'Not started' },
  needs_practice: { color: '#b45309', bg: '#fef3c7', icon: '✏️', label: 'Keep practicing' },
  review_due:     { color: '#7c3aed', bg: '#ede9fe', icon: '⏰', label: 'Ready to review' },
  strong:         { color: '#1d4ed8', bg: '#eff6ff', icon: '💪', label: 'Getting strong' },
  mastered:       { color: '#15803d', bg: '#f0fdf4', icon: '⭐', label: 'Mastered' },
};

const NEW_CONFIG = STATUS_CONFIG.new;
const LOCKED_CONFIG = { color: '#9ca3af', bg: '#f9fafb', icon: '🔒', label: 'Locked' };

export function SkillTile({ skill, summary, locked, onClick }: Props) {
  const cfg = locked ? LOCKED_CONFIG : (summary ? STATUS_CONFIG[summary.status] : NEW_CONFIG);

  return (
    <button
      style={{
        ...s.tile,
        background: cfg.bg,
        borderColor: cfg.color + '44',
        opacity: locked ? 0.6 : 1,
        cursor: locked ? 'default' : 'pointer',
      }}
      onClick={locked ? undefined : () => onClick(skill.id)}
      disabled={locked}
      aria-label={`${skill.title}: ${cfg.label}`}
    >
      <div style={s.row}>
        <span style={{ fontSize: '18px' }}>{cfg.icon}</span>
        <div style={s.textBlock}>
          <div style={{ ...s.title, color: cfg.color }}>{skill.title}</div>
          {!locked && summary && summary.attemptCount > 0 && (
            <div style={s.stats}>
              {Math.round(summary.accuracy * 100)}% · {summary.attemptCount} tries
            </div>
          )}
          {!locked && (!summary || summary.attemptCount === 0) && (
            <div style={s.stats}>Not started yet</div>
          )}
          {locked && (
            <div style={s.stats}>Complete prerequisites first</div>
          )}
        </div>
        <span style={{ ...s.badge, color: cfg.color, background: cfg.color + '22' }}>
          {cfg.label}
        </span>
      </div>
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  tile: {
    width: '100%',
    textAlign: 'left',
    border: '1.5px solid',
    borderRadius: '12px',
    padding: '14px',
    cursor: 'pointer',
    marginBottom: '8px',
    touchAction: 'manipulation',
    transition: 'opacity 0.15s',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: '15px',
    fontWeight: '700',
    marginBottom: '2px',
  },
  stats: {
    fontSize: '12px',
    color: '#6b7280',
  },
  badge: {
    fontSize: '11px',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '20px',
    whiteSpace: 'nowrap',
  },
};
