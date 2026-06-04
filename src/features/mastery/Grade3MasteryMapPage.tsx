import { useEffect, useState } from 'react';
import type { StudentProfile } from '../../types/math';
import { GRADE3_MASTERY_MAP, getGrade3SkillsByDomain } from './grade3MasteryMap';
import type { Grade3Domain, MasterySkillNode } from './grade3MasteryMap';
import { deriveGrade3SkillSummaries } from './skillMasteryEngine';
import type { StudentSkillSummary } from './skillMasteryEngine';
import { planToday } from './todayPlanEngine';
import type { TodayPlan } from './todayPlanEngine';
import { mathAnswerEventRepo, itemStateRepo } from '../../db/repositories';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { appNow } from '../time/clock';
import { SkillTile } from './SkillTile';
import { SkillDetailPanel } from './SkillDetailPanel';
import { ParentNextActionCard } from './ParentNextActionCard';

interface Props {
  profile: StudentProfile;
  onBack: () => void;
  onPracticeSkill?: (skillId: string) => void;
  onReviewSkill?: (skillId: string) => void;
}

const DOMAIN_ORDER: Grade3Domain[] = [
  'multiplication',
  'division',
  'fractions',
  'area_perimeter',
  'geometry',
];

const DOMAIN_LABELS: Record<Grade3Domain, string> = {
  multiplication: 'Multiplication',
  division: 'Division',
  fractions: 'Fractions',
  area_perimeter: 'Area & Perimeter',
  geometry: 'Geometry',
};

const DOMAIN_ICONS: Record<Grade3Domain, string> = {
  multiplication: '✖️',
  division: '➗',
  fractions: '🍕',
  area_perimeter: '📐',
  geometry: '🔷',
};

export function Grade3MasteryMapPage({ profile, onBack, onPracticeSkill, onReviewSkill }: Props) {
  const [summaries, setSummaries] = useState<StudentSkillSummary[]>([]);
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<MasterySkillNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = appNow().toISOString();
      const [events, states] = await Promise.all([
        mathAnswerEventRepo.getAll(profile.id),
        itemStateRepo.getForStudent(profile.id),
      ]);

      if (cancelled) return;

      // Collect all item IDs we need to resolve
      const allItemIds = new Set<string>();
      for (const e of events) allItemIds.add(e.itemId);
      for (const s of states) allItemIds.add(s.itemId);

      // Build item resolver using makeItemFromId
      const itemCache = new Map<string, ReturnType<typeof makeItemFromId>>();
      for (const id of allItemIds) {
        const item = makeItemFromId(id);
        if (item) itemCache.set(id, item);
      }

      const derived = deriveGrade3SkillSummaries({
        studentId: profile.id,
        items: id => itemCache.get(id) ?? null,
        mathAnswerEvents: events,
        itemStates: states,
        now,
      });

      if (!cancelled) {
        setSummaries(derived);
        // Compute today's plan from derived summaries
        const plan = planToday({
          studentId: profile.id,
          skillSummaries: derived,
          itemStates: states,
          now: appNow(),
        });
        setTodayPlan(plan);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile.id]);

  const summaryMap = new Map(summaries.map(s => [s.skillId, s]));

  const selectedSummary = selectedSkill ? summaryMap.get(selectedSkill.id) : undefined;

  return (
    <div style={s.container}>
      {/* Header */}
      <header style={s.header}>
        <button style={s.backBtn} onClick={onBack} aria-label="Back">← Back</button>
        <div>
          <h1 style={s.pageTitle}>Grade 3 Math Map</h1>
          <p style={s.subtitle}>See what is strong, learning, and ready to review.</p>
        </div>
      </header>

      {loading ? (
        <div style={s.loading}>Loading your progress…</div>
      ) : (
        <>
          {/* Parent Next Action Card — shown when parentModeEnabled or when there's useful data */}
          {todayPlan && (summaries.length > 0 || todayPlan.review) && (
            <ParentNextActionCard
              summaries={summaries}
              todayPlan={todayPlan}
              studentName={profile.displayName}
            />
          )}

          {/* Legend */}
          <div style={s.legend}>
            {['new', 'needs_practice', 'review_due', 'strong', 'mastered'].map(status => (
              <LegendItem key={status} status={status as SkillSummaryStatus} />
            ))}
          </div>

          {/* Domain sections */}
          {DOMAIN_ORDER.map(domain => {
            const skills = getGrade3SkillsByDomain(domain);
            return (
              <section key={domain} style={s.domainSection}>
                <h2 style={s.domainTitle}>
                  {DOMAIN_ICONS[domain]} {DOMAIN_LABELS[domain]}
                </h2>
                {skills.map(skill => (
                  <SkillTile
                    key={skill.id}
                    skill={skill}
                    summary={summaryMap.get(skill.id)}
                    onClick={setSelectedSkill.bind(null,
                      GRADE3_MASTERY_MAP.find(sk => sk.id === skill.id) ?? null
                    )}
                  />
                ))}
              </section>
            );
          })}
        </>
      )}

      {/* Detail panel */}
      {selectedSkill && (
        <SkillDetailPanel
          skill={selectedSkill}
          summary={selectedSummary}
          onClose={() => setSelectedSkill(null)}
          onPractice={skillId => {
            setSelectedSkill(null);
            onPracticeSkill?.(skillId);
          }}
          onReview={skillId => {
            setSelectedSkill(null);
            onReviewSkill?.(skillId);
          }}
        />
      )}
    </div>
  );
}

type SkillSummaryStatus = 'new' | 'needs_practice' | 'review_due' | 'strong' | 'mastered';

const STATUS_LEGEND: Record<SkillSummaryStatus, { icon: string; label: string; color: string }> = {
  new:            { icon: '🔵', label: 'Not started', color: '#6b7280' },
  needs_practice: { icon: '✏️', label: 'Keep practicing', color: '#b45309' },
  review_due:     { icon: '⏰', label: 'Review due', color: '#7c3aed' },
  strong:         { icon: '💪', label: 'Getting strong', color: '#1d4ed8' },
  mastered:       { icon: '⭐', label: 'Mastered', color: '#15803d' },
};

function LegendItem({ status }: { status: SkillSummaryStatus }) {
  const cfg = STATUS_LEGEND[status];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
      <span>{cfg.icon}</span>
      <span style={{ color: cfg.color, fontWeight: '600' }}>{cfg.label}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '480px',
    margin: '0 auto',
    padding: '16px',
    fontFamily: 'system-ui, sans-serif',
    minHeight: '100dvh',
  },
  header: {
    marginBottom: '20px',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--primary, #4f46e5)',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '4px 0',
    marginBottom: '8px',
  },
  pageTitle: {
    fontSize: '24px',
    fontWeight: '800',
    margin: '0 0 4px',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  loading: {
    textAlign: 'center',
    padding: '60px 0',
    color: '#9ca3af',
    fontSize: '16px',
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '20px',
    padding: '12px',
    background: '#f9fafb',
    borderRadius: '10px',
  },
  domainSection: {
    marginBottom: '24px',
  },
  domainTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: '0 0 10px',
  },
};
