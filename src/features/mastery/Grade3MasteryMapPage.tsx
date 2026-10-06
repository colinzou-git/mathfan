import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { StudentProfile, SessionConfig } from '../../types/math';
import { getCurriculum, getCurriculumSkill } from '../curriculum/curriculumRegistry';
import { planPracticeForSkill } from './skillPracticePlanner';
import type { Grade3Domain, MasterySkillNode } from './grade3MasteryMap';
import { deriveCurriculumSkillSummaries } from './skillMasteryEngine';
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
  initialSkillId?: string;
}

const DOMAIN_ORDER: Grade3Domain[] = [
  'addition_subtraction',
  'multiplication',
  'division',
  'fractions',
  'area_perimeter',
  'geometry',
  'measurement_data',
  'summer_bridge',
];
const EMPTY_SKILLS: readonly MasterySkillNode[] = [];

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

const DOMAIN_ICONS: Record<Grade3Domain, string> = {
  addition_subtraction: '➕',
  multiplication: '✖️',
  division: '➗',
  fractions: '🍕',
  area_perimeter: '📐',
  geometry: '🔷',
  measurement_data: '📏',
  summer_bridge: '🌉',
};

// Bug 3: Build a complete summary list (including stubs for unstarted skills) so
// planToday can pick any unlocked new skill, not only skills already seen.
function buildCompleteSummaries(
  derived: StudentSkillSummary[],
  studentId: string,
  skills: readonly MasterySkillNode[],
): StudentSkillSummary[] {
  const existing = new Map(derived.map(s => [s.skillId, s]));
  return skills.map(node => existing.get(node.id) ?? {
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

// Returns a map from skillId → names of prerequisites not yet mastered/strong.
// Empty array means all prerequisites are satisfied.
function computeUnmetPrereqNames(summaryMap: Map<string, StudentSkillSummary>, skills: readonly MasterySkillNode[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const node of skills) {
    if (node.prerequisites.length === 0) continue;
    const unmetIds = node.prerequisites.filter(prereqId => {
      const s = summaryMap.get(prereqId);
      return !(s && ['mastered', 'strong'].includes(s.learningState ?? s.status));
    });
    if (unmetIds.length > 0) {
      const names = unmetIds.map(id => {
        const prereqNode = getCurriculumSkill(id);
        return prereqNode?.title ?? id;
      });
      result.set(node.id, names);
    }
  }
  return result;
}

export function Grade3MasteryMapPage({ profile, onBack, onStartPractice, onStartDiagnostic, initialSkillId }: Props) {
  const curriculum = getCurriculum(profile.gradeLevel);
  const skills = curriculum?.skills ?? EMPTY_SKILLS;
  const [summaries, setSummaries] = useState<StudentSkillSummary[]>([]);
  const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<MasterySkillNode | null>(() => initialSkillId ? getCurriculumSkill(initialSkillId) ?? null : null);
  const [unmetPrereqsBySkill, setUnmetPrereqsBySkill] = useState<Map<string, string[]>>(new Map());
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
      for (const s of states) allItemIds.add(s.lastItemId ?? s.cardKey);

      // Build item resolver using makeItemFromId
      const itemCache = new Map<string, ReturnType<typeof makeItemFromId>>();
      for (const id of allItemIds) {
        const item = makeItemFromId(id);
        if (item) itemCache.set(id, item);
      }

      const derived = deriveCurriculumSkillSummaries({
        timezone: profile.timezone,
        studentId: profile.id,
        items: id => itemCache.get(id) ?? null,
        mathAnswerEvents: events,
        itemStates: states,
        now,
      });

      if (!cancelled) {
        setSummaries(derived);

        // Compute unmet prerequisites for soft recommendations (not hard locks).
        const derivedMap = new Map(derived.map(s => [s.skillId, s]));
        setUnmetPrereqsBySkill(computeUnmetPrereqNames(derivedMap, skills));

        // Bug 4: map due item IDs to the skill they belong to.
        const nowStr = appNow().toISOString();
        const computedDue = new Map<string, string[]>();
        for (const state of states) {
          if (state.nextDueAt != null && state.nextDueAt <= nowStr) {
            const itemId = state.lastItemId ?? state.cardKey;
            const item = itemCache.get(itemId);
            if (item) {
              const skillId = inferGrade3SkillId(item);
              if (skillId) {
                const arr = computedDue.get(skillId) ?? [];
                arr.push(itemId);
                computedDue.set(skillId, arr);
              }
            }
          }
        }
        setDueBySkill(computedDue);

        // Bug 3: planToday needs stubs for all skills so it can pick unlocked
        // new skills even before any events exist.
        const completeSummaries = buildCompleteSummaries(derived, profile.id, skills);
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
  }, [profile.id, profile.timezone, skills]);

  const summaryMap = new Map(summaries.map(s => [s.skillId, s]));

  const selectedSummary = selectedSkill ? summaryMap.get(selectedSkill.id) : undefined;

  return (
    <div style={s.container}>
      {/* Header */}
      <header style={s.header}>
        <button style={s.backBtn} onClick={onBack} aria-label="Back">← Back</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={s.pageTitle}>Grade {profile.gradeLevel} Math Map</h1>
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
          {/* Parent Next Action Card — shown whenever there is an actionable plan */}
          {todayPlan && (todayPlan.focus || todayPlan.warmup || todayPlan.review) && (
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
          {profile.gradeLevel === 4 && <p role="note">Units 1–2 are ready. Multiplication, division, fractions, measurement and geometry come in later phases. 4.OA.3 is only partially covered here.</p>}
          {(profile.gradeLevel === 4 ? curriculum?.units ?? [] : DOMAIN_ORDER.map(domain => ({ id: domain, title: `${DOMAIN_ICONS[domain]} ${DOMAIN_LABELS[domain]}`, skillIds: skills.filter(skill => skill.domain === domain).map(skill => skill.id) }))).map(unit => {
            const unitSkills = skills.filter(skill => unit.skillIds.includes(skill.id));
            return (
              <section key={unit.id} style={s.domainSection}>
                <h2 style={s.domainTitle}>
                  {unit.title}
                </h2>
                {unitSkills.map(skill => (
                  <SkillTile
                    key={skill.id}
                    skill={skill}
                    summary={summaryMap.get(skill.id)}
                    unmetPrereqs={unmetPrereqsBySkill.get(skill.id)}
                    onClick={setSelectedSkill.bind(null,
                      skills.find(sk => sk.id === skill.id) ?? null
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
          unmetPrereqNames={unmetPrereqsBySkill.get(selectedSkill.id)}
          onClose={() => setSelectedSkill(null)}
          onBridge={config => onStartPractice(config)}
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

const s: Record<string, CSSProperties> = {
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
