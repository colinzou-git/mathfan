import type { CSSProperties } from 'react';
import type { Grade3Domain, MasterySkillNode } from './grade3MasteryMap';
import type { StudentSkillSummary } from './skillMasteryEngine';
import { CURRICULUM_MISCONCEPTION_LABELS, getCurriculumSkill } from '../curriculum/curriculumRegistry';
import { makeFoundationItem } from '../curriculum/foundationItems';
import { planPracticeForSkill } from './skillPracticePlanner';
import { VisualModel } from '../visuals/VisualModel';
import type { SessionConfig } from '../../types/math';

interface Props {
  skill: MasterySkillNode;
  summary?: StudentSkillSummary;
  /** Names of prerequisites not yet mastered/strong, for soft advisory display. */
  unmetPrereqNames?: string[];
  onClose: () => void;
  onPracticeSkill: (skillId: string) => void;
  onReviewDue: (skillId: string) => void;
  onBridge?: (config: SessionConfig) => void;
}

const DOMAIN_LABELS: Record<Grade3Domain, string> = {
  addition_subtraction: 'Add & Subtract',
  multiplication: 'Multiplication',
  division: 'Division',
  fractions: 'Fractions',
  area_perimeter: 'Area & Perimeter',
  geometry: 'Geometry',
  measurement_data: 'Measurement & Data',
  summer_bridge: 'Summer Bridge',
};

export function SkillDetailPanel({ skill, summary, unmetPrereqNames, onClose, onPracticeSkill, onReviewDue, onBridge }: Props) {
  const curriculumSkill = getCurriculumSkill(skill.id);
  const instruction = curriculumSkill?.instruction;
  const example = instruction ? makeFoundationItem(skill.id, 'model', 0, 21) : undefined;
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
        {instruction && <section aria-label="Learn this skill">
          <h3>Learn this skill</h3>
          <p>{instruction.activate}</p><p>{instruction.model}</p><p>{instruction.connect}</p>
          {example && <details><summary>Worked example</summary><p>{example.prompt}</p><VisualModel item={example} revealAnswer /><p>{example.explanation}</p></details>}
          <p>{instruction.guided}</p><p>{instruction.reflection}</p>
          {summary?.evidenceGaps?.length ? <p>Next evidence: {summary.evidenceGaps.join('; ')}.</p> : null}
          {summary?.provisionalPlacement && <p>Your quick check suggests a starting point. Independent practice and later-day checks build mastery.</p>}
        </section>}

        {skill.track === 'summer_bridge' && (
          <div style={s.summerNote} role="note">
            <strong>Grade 3 Summer Bridge</strong>
            {' '}— preparation for Grade 4, not required Grade 3 core mastery.
            {skill.optionalExtension ? ' This activity is an optional challenge.' : ''}
          </div>
        )}

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

        {/* Prerequisite advisory note */}
        {unmetPrereqNames && unmetPrereqNames.length > 0 && (
          <div style={s.prereqNote} role="note">
            <span style={s.prereqNoteIcon}>💡</span>
            <p style={s.prereqNoteText}>
              This skill may be easier after reviewing:{' '}
              <strong>{unmetPrereqNames.join(', ')}</strong>.
              {' '}Continue below when ready.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div style={s.actions}>
          {instruction && onBridge && curriculumSkill?.prerequisites.length ? <button style={s.reviewBtn} onClick={() => {
            const base = planPracticeForSkill(curriculumSkill.prerequisites[0], { sessionLength: 3 });
            const ids = base.specificItemIds?.slice(0, 3) ?? [];
            onBridge({ ...base, returnToSkillId: skill.id, specificItemIds: ids, sessionLength: ids.length || 3 });
          }}>Quick refresh · then return here</button> : null}
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
  if (CURRICULUM_MISCONCEPTION_LABELS[pattern]) return CURRICULUM_MISCONCEPTION_LABELS[pattern];
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
  summerNote: {
    background: '#ecfeff',
    border: '1px solid #a5f3fc',
    borderRadius: '10px',
    color: '#155e75',
    fontSize: '12px',
    lineHeight: 1.45,
    marginBottom: '14px',
    padding: '10px 12px',
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
  prereqNote: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '16px',
  },
  prereqNoteIcon: {
    fontSize: '16px',
    flexShrink: 0,
  },
  prereqNoteText: {
    fontSize: '13px',
    color: '#78350f',
    margin: 0,
    lineHeight: 1.5,
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
