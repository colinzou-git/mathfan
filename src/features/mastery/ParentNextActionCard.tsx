/**
 * ParentNextActionCard — parent-facing summary of skill progress and next actions.
 *
 * Shows:
 * - Strongest 2 skills (encouraging tone)
 * - Top 2 skills that need more practice
 * - Suggested today plan
 * - One clear parent action sentence
 *
 * Wording is positive, encouraging, and non-shaming.
 */

import type { StudentSkillSummary } from './skillMasteryEngine';
import type { TodayPlan } from './todayPlanEngine';
import { getGrade3Skill } from './grade3MasteryMap';

interface Props {
  summaries: StudentSkillSummary[];
  todayPlan: TodayPlan;
  studentName: string;
}

function skillTitle(skillId: string): string {
  return getGrade3Skill(skillId)?.title ?? skillId;
}

function parentActionText(todayPlan: TodayPlan, studentName: string): string {
  if (todayPlan.focusSkillId) {
    const title = skillTitle(todayPlan.focusSkillId);
    return `Try doing ${todayPlan.estimatedMinutes} minutes of "${title}" with ${studentName} today.`;
  }
  if (todayPlan.review) {
    return `${studentName} has items ready to review — a short session today will help lock them in.`;
  }
  return `${studentName} is doing great! Encourage a short daily practice to keep things sharp.`;
}

export function ParentNextActionCard({ summaries, todayPlan, studentName }: Props) {
  // Strongest: mastered or strong, sorted by accuracy desc
  const strongest = summaries
    .filter(s => s.status === 'mastered' || s.status === 'strong')
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 2);

  // Needs practice: needs_practice or review_due, sorted by accuracy asc (weakest first)
  const needsPractice = summaries
    .filter(s => s.status === 'needs_practice' || s.status === 'review_due')
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 2);

  const actionText = parentActionText(todayPlan, studentName);

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.headerIcon}>👨‍👩‍👧</span>
        <span style={s.headerTitle}>Parent Summary</span>
      </div>

      {/* Strongest skills */}
      {strongest.length > 0 && (
        <section style={s.section}>
          <div style={s.sectionLabel}>⭐ Going strong</div>
          {strongest.map(s => (
            <div key={s.skillId} style={skillStyle.item}>
              <span style={skillStyle.title}>{skillTitle(s.skillId)}</span>
              <span style={{ ...skillStyle.badge, background: '#f0fdf4', color: '#15803d' }}>
                {Math.round(s.accuracy * 100)}% accurate
              </span>
            </div>
          ))}
          {strongest.length === 0 && (
            <p style={s.emptyNote}>Keep practicing — strong skills are on the way!</p>
          )}
        </section>
      )}

      {/* Needs practice skills */}
      {needsPractice.length > 0 && (
        <section style={s.section}>
          <div style={s.sectionLabel}>✏️ Still building</div>
          {needsPractice.map(sk => (
            <div key={sk.skillId} style={skillStyle.item}>
              <span style={skillStyle.title}>{skillTitle(sk.skillId)}</span>
              <span style={{ ...skillStyle.badge, background: '#fef9c3', color: '#92400e' }}>
                Needs practice
              </span>
            </div>
          ))}
        </section>
      )}

      {/* Today's plan */}
      {(todayPlan.focus || todayPlan.review) && (
        <section style={s.section}>
          <div style={s.sectionLabel}>📅 Today's suggestion</div>
          <div style={s.planRow}>
            {todayPlan.focus && (
              <div style={s.planChip}>
                <span style={s.planChipIcon}>✏️</span>
                <span>{skillTitle(todayPlan.focusSkillId!)}</span>
              </div>
            )}
            {todayPlan.review && (
              <div style={{ ...s.planChip, background: '#ede9fe', borderColor: '#c4b5fd' }}>
                <span style={s.planChipIcon}>⏰</span>
                <span>Review {todayPlan.review.sessionLength} items</span>
              </div>
            )}
          </div>
          <p style={s.estMinutes}>
            About {todayPlan.estimatedMinutes} minute{todayPlan.estimatedMinutes !== 1 ? 's' : ''}
          </p>
        </section>
      )}

      {/* Parent action */}
      <div style={s.actionBox}>
        <p style={s.actionText}>{actionText}</p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    border: '1.5px solid #e5e7eb',
    borderRadius: '16px',
    padding: '18px',
    marginBottom: '20px',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '14px',
  },
  headerIcon: {
    fontSize: '20px',
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#1f2937',
  },
  section: {
    marginBottom: '14px',
  },
  sectionLabel: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
  },
  emptyNote: {
    fontSize: '13px',
    color: '#9ca3af',
    margin: 0,
    fontStyle: 'italic',
  },
  planRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '6px',
  },
  planChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '20px',
    fontSize: '13px',
    color: '#0369a1',
    fontWeight: '600',
  },
  planChipIcon: {
    fontSize: '14px',
  },
  estMinutes: {
    fontSize: '12px',
    color: '#9ca3af',
    margin: 0,
  },
  actionBox: {
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '10px',
    padding: '12px 14px',
  },
  actionText: {
    fontSize: '14px',
    color: '#15803d',
    fontWeight: '600',
    margin: 0,
    lineHeight: 1.5,
  },
};

const skillStyle: Record<string, React.CSSProperties> = {
  item: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  title: {
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500',
  },
  badge: {
    fontSize: '11px',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '20px',
  },
};
