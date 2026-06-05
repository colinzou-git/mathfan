import { useEffect, useState } from 'react';
import type { StudentProfile, SessionConfig } from '../../types/math';
import { GRADE3_MASTERY_MAP, getGrade3SkillsByDomain } from './grade3MasteryMap';
import { planPracticeForSkill } from './skillPracticePlanner';
import type { Grade3Domain, MasterySkillNode } from './grade3MasteryMap';
import { deriveGrade3SkillSummaries } from './skillMasteryEngine';
import type { StudentSkillSummary } from './skillMasteryEngine';
import { planToday } from './todayPlanEngine';
import type { TodayPlan } from './todayPlanEngine';
import { mathAnswerEventRepo, itemStateRepo } from '../../db/repositories';
import { makeItemFromId } from '../curriculum/makeItemFromId';
import { inferGrade3SkillId } from './skillMapping';
import { appNow } from '../time/clock';
import { SkillTile } from './SkillTile';
import { SkillDetailPanel } from './SkillDetailPanel';
import { ParentNextActionCard } from './ParentNextActionCard';

interface Props {
  profile: StudentProfile;
  onBack: () => void;
  onStartPractice: (config: SessionConfig) => void;
  onStartDiagnostic?: () => void;
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

// Bug 3: Build a complete summary list (including stubs for unstarted skills) so
// planToday can pick any unlocked new skill, not only skills already seen.
function buildCompleteSummaries(
  derived: StudentSkillSummary[],
  studentId: string,
): StudentSkillSummary[] {
  const existing = new Map(derived.map(s => [s.skillId, s]));
  return GRADE3_MASTERY_MAP.map(node => existing.get(node.id) ?? {
    skillId: node.id,
    studentId,
    status: 'new' as const,
    attemptCount: 0,
    correctCount: 0,
    accuracy: 0,
    dueItemCount: 0,
    itemCount: 0,
    mistakePatterns: [],
  });
}

// Bug 7: A skill is locked when any prerequisite is not yet mastered or strong.
function computeLockedSkills(summaryMap: Map<string, StudentSkillSummary>): Set<string> {
  const locked = new Set<string>();
  for (const node of GRADE3_MASTERY_MAP) {
    if (node.prerequisites.length === 0) continue;
    const prereqsMet = node.prerequisites.every(prereqId => {
      const s = summaryMap.get(prereqId);
      return s != null && (s.status === 'mastered' || s.status === 'strong');
    });
    if (!prereqsMet) locked.add(node.id);
  }
  return locked;
}

export function Grade3MasteryMapPage({ profile, onBack, onStartPractice, onStartDiagnostic }: Props) {
  const [summaries, setSummaries] = useState<StudentSkillSummary[]>([]);
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<MasterySkillNode | null>(null);
  const [lockedSkills, setLockedSkills] = useState<Set<string>>(new Set());
  // Bug 4: map from skillId → due item IDs for that skill
  const [dueBySkill, setDueBySkill] = useState<Map<string, string[]>>(new Map());

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

        // Bug 7: derived summary map (real data only; missing entries → locked).
        const derivedMap = new Map(derived.map(s => [s.skillId, s]));
        setLockedSkills(computeLockedSkills(derivedMap));

        // Bug 4: map due item IDs to the skill they belong to.
        const nowStr = appNow().toISOString();
        const computedDue = new Map<string, string[]>();
        for (const state of states) {
          if (state.nextDueAt != null && state.nextDueAt <= nowStr) {
            const item = itemCache.get(state.itemId);
            if (item) {
              const skillId = inferGrade3SkillId(item);
              if (skillId) {
                const arr = computedDue.get(skillId) ?? [];
                arr.push(state.itemId);
                computedDue.set(skillId, arr);
              }
            }
          }
        }
        setDueBySkill(computedDue);

        // Bug 3: planToday needs stubs for all skills so it can pick unlocked
        // new skills even before any events exist.
        const completeSummaries = buildCompleteSummaries(derived, profile.id);
        const plan = planToday({
          studentId: profile.id,
          skillSummaries: completeSummaries,
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={s.pageTitle}>Grade 3 Math Map</h1>
            <p style={s.subtitle}>See what is strong, learning, and ready to review.</p>
          </div>
          {onStartDiagnostic && (
            <button style={s.diagBtn} onClick={onStartDiagnostic} aria-label="Take a quick check">
              🔍 Quick Check
            </button>
          )}
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
              onStartPractice={onStartPractice}
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
                    locked={lockedSkills.has(skill.id)}
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
          onPracticeSkill={skillId => {
            setSelectedSkill(null);
            onStartPractice(planPracticeForSkill(skillId));
          }}
          onReviewDue={skillId => {
            setSelectedSkill(null);
            // Bug 4: use the actual due item IDs rather than a broad skill session.
            const dueIds = dueBySkill.get(skillId) ?? [];
            if (dueIds.length > 0) {
              onStartPractice({ mode: 'daily_review', specificItemIds: dueIds, sessionLength: dueIds.length });
            } else {
              onStartPractice(planPracticeForSkill(skillId));
            }
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
  diagBtn: {
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#4b5563',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    touchAction: 'manipulation',
    flexShrink: 0,
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
