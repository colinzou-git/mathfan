import type { CSSProperties } from 'react';
import type { Grade3Domain, MasterySkillNode } from './grade3MasteryMap';
import type { StudentSkillSummary } from './skillMasteryEngine';

interface Props {
  skill: MasterySkillNode;
  summary?: StudentSkillSummary;
  onClose: () => void;
  onPracticeSkill: (skillId: string) => void;
  onReviewDue: (skillId: string) => void;
}

const DOMAIN_LABELS: Record<Grade3Domain, string> = {
  addition_subtraction: 'Add & Subtract',
  multiplication: 'Multiplication',
  division: 'Division',
  fractions: 'Fractions',
  area_perimeter: 'Area & Perimeter',
  geometry: 'Geometry',
  measurement_data: 'Measurement & Data',
};

export function SkillDetailPanel({ skill, summary, onClose, onPracticeSkill, onReviewDue }: Props) {
  const accuracy = summary && summary.attemptCount > 0
    ? Math.round(summary.accuracy * 100)
    : null;

  const hasDueItems = summary ? summary.dueItemCount > 0 : false;

  return (
    <div style={s.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={skill.title}>
      <div style={s.panel} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.domain}>{DOMAIN_LABELS[skill.domain] ?? skill.domain}</div>
            <h2 style={s.title}>{skill.title}</h2>
          </div>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Description */}
        <p style={s.description}>{skill.description}</p>

        {/* Stats */}
        {summary && (
          <div style={s.statsRow}>
            <div style={s.stat}>
              <div style={s.statValue}>{summary.attemptCount}</div>
              <div style={s.statLabel}>Tries</div>
            </div>
            <div style={s.stat}>
              <div style={s.statValue}>{accuracy !== null ? `${accuracy}%` : '—'}</div>
              <div style={s.statLabel}>Accuracy</div>
            </div>
            <div style={s.stat}>
              <div style={{ ...s.statValue, color: hasDueItems ? '#7c3aed' : '#6b7280' }}>
                {summary.dueItemCount}
              </div>
              <div style={s.statLabel}>Due</div>
            </div>
          </div>
        )}

        {/* Mistake patterns */}
        {summary && summary.mistakePatterns.length > 0 && (
          <div style={s.mistakesBox}>
            <div style={s.mistakesTitle}>Common challenges</div>
            {summary.mistakePatterns.map(p => (
              <div key={p} style={s.mistakeTag}>{formatPattern(p)}</div>
            ))}
          </div>
        )}

        {/* Standard IDs */}
        <div style={s.standards}>
          {skill.californiaStandardIds.map(id => (
            <span key={id} style={s.standardChip}>{id}</span>
          ))}
        </div>

        {/* Action buttons */}
        <div style={s.actions}>
          <button
            style={s.practiceBtn}
            onClick={() => onPracticeSkill(skill.id)}
          >
            ✏️ Practice this skill
          </button>
          {hasDueItems && (
            <button
              style={s.reviewBtn}
              onClick={() => onReviewDue(skill.id)}
            >
              ⏰ Review due items ({summary!.dueItemCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPattern(pattern: string): string {
  return pattern
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

const s: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 200,
  },
  panel: {
    background: '#fff',
    borderRadius: '20px 20px 0 0',
    padding: '24px 20px 32px',
    width: '100%',
    maxWidth: '480px',
    maxHeight: '80dvh',
    overflowY: 'auto',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  domain: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    margin: 0,
    color: '#1f2937',
  },
  closeBtn: {
    background: '#f3f4f6',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  description: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: 1.5,
    margin: '0 0 16px',
  },
  statsRow: {
    display: 'flex',
    gap: '10px',
    marginBottom: '14px',
  },
  stat: {
    flex: 1,
    background: '#f9fafb',
    borderRadius: '10px',
    padding: '10px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: '11px',
    color: '#9ca3af',
    marginTop: '2px',
  },
  mistakesBox: {
    background: '#fef9c3',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '14px',
  },
  mistakesTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#92400e',
    marginBottom: '6px',
  },
  mistakeTag: {
    display: 'inline-block',
    background: '#fef3c7',
    color: '#92400e',
    borderRadius: '8px',
    padding: '3px 10px',
    fontSize: '12px',
    marginRight: '6px',
    marginBottom: '4px',
  },
  standards: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '20px',
  },
  standardChip: {
    background: '#f3f4f6',
    color: '#6b7280',
    borderRadius: '8px',
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: '600',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  practiceBtn: {
    width: '100%',
    padding: '14px',
    background: 'var(--primary, #4f46e5)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  reviewBtn: {
    width: '100%',
    padding: '14px',
    background: '#ede9fe',
    color: '#7c3aed',
    border: '1.5px solid #c4b5fd',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
};
