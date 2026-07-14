import { useState } from 'react';
import type { StudentProfile, GradeLevel } from '../../types/math';
import { createLearnerKey, profileCreationMatch } from '../profile/learnerIdentity';
import { generateId } from '../../utils/id';

export type RestoreState = 'idle' | 'checking' | 'available' | 'unavailable';

interface Props {
  /** Profiles already on this device/account. Empty on a genuinely fresh setup. */
  existingProfiles: StudentProfile[];
  restoreState: RestoreState;
  onSelectExisting: (profile: StudentProfile) => void;
  onCreate: (profile: StudentProfile) => Promise<void>;
  onRestore?: () => Promise<void>;
}

function buildProfile(name: string, grade: GradeLevel): StudentProfile {
  return {
    id: generateId(),
    learnerKey: createLearnerKey(),
    identityVersion: 1,
    displayName: name.trim(),
    gradeLevel: grade,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      audioEnabled: true,
      speechRate: 0.9,
      dailyGoalMinutes: 10,
      sessionLength: 10,
      autoAdvance: true,
      theme: 'indigo' as const,
      allowTimedMode: true,
      competitionModeEnabled: false,
      parentModeEnabled: false,
    },
  };
}

export function ProfileSetup({ existingProfiles, restoreState, onSelectExisting, onCreate, onRestore }: Props) {
  const [showCreateForm, setShowCreateForm] = useState(existingProfiles.length === 0);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<GradeLevel>(3);
  const [error, setError] = useState('');
  const [pendingMatches, setPendingMatches] = useState<StudentProfile[] | null>(null);
  const [pendingProfile, setPendingProfile] = useState<StudentProfile | null>(null);

  const createProfile = async (profile: StudentProfile) => {
    setError('');
    try {
      await onCreate(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create profile. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a name.');
      return;
    }
    const draft = buildProfile(name, grade);
    const matches = profileCreationMatch({ displayName: draft.displayName, gradeLevel: draft.gradeLevel }, existingProfiles);
    if (matches.length > 0) {
      setPendingMatches(matches);
      setPendingProfile(draft);
      return;
    }
    await createProfile(draft);
  };

  if (pendingMatches && pendingProfile) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Is this the same learner?</h1>
          <p style={styles.subtitle}>
            We found {pendingMatches.length === 1 ? 'a profile' : 'profiles'} with the same name and grade.
          </p>
          <div style={styles.form}>
            {pendingMatches.map(p => (
              <button
                key={p.id}
                type="button"
                style={styles.existingBtn}
                onClick={() => onSelectExisting(p)}
              >
                Use existing profile — {p.displayName} (Grade {p.gradeLevel})
              </button>
            ))}
            <button
              type="button"
              style={styles.submitBtn}
              onClick={() => createProfile(pendingProfile)}
            >
              Create a separate learner
            </button>
            <button
              type="button"
              style={styles.linkBtn}
              onClick={() => { setPendingMatches(null); setPendingProfile(null); }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!showCreateForm) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '8px' }}>🧮</div>
          <h1 style={styles.title}>Welcome back to MathFan</h1>
          <p style={styles.subtitle}>Who's practicing today?</p>
          {restoreState === 'unavailable' && onRestore && (
            <div style={styles.restoreBanner}>
              <p style={{ margin: 0, fontSize: '14px' }}>We couldn't reach your saved data.</p>
              <button type="button" style={styles.linkBtn} onClick={onRestore}>Try restoring again</button>
            </div>
          )}
          <div style={styles.form}>
            {existingProfiles.map(p => (
              <button
                key={p.id}
                type="button"
                style={styles.existingBtn}
                onClick={() => onSelectExisting(p)}
              >
                {p.displayName} (Grade {p.gradeLevel})
              </button>
            ))}
            <button type="button" style={styles.linkBtn} onClick={() => setShowCreateForm(true)}>
              Create a separate learner
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '8px' }}>🧮</div>
        <h1 style={styles.title}>Welcome to MathFan</h1>
        <p style={styles.subtitle}>Let's get started. Who's practicing today?</p>
        {restoreState === 'checking' && (
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>Checking for existing data…</p>
        )}
        {restoreState === 'unavailable' && onRestore && (
          <div style={styles.restoreBanner}>
            <p style={{ margin: 0, fontSize: '14px' }}>We couldn't reach your saved data.</p>
            <button type="button" style={styles.linkBtn} onClick={onRestore}>Try restoring again</button>
          </div>
        )}
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Name
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex"
              style={styles.input}
              autoFocus
              maxLength={40}
            />
          </label>
          <label style={styles.label}>
            Grade
            <div style={styles.gradeRow}>
              {([3, 4, 5] as GradeLevel[]).map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrade(g)}
                  style={{
                    ...styles.gradeBtn,
                    ...(grade === g ? styles.gradeBtnActive : {}),
                  }}
                >
                  Grade {g}
                </button>
              ))}
            </div>
          </label>
          {error && <p style={{ color: '#ef4444', fontSize: '14px' }}>{error}</p>}
          <button type="submit" style={styles.submitBtn}>
            Start Learning →
          </button>
          {existingProfiles.length > 0 && (
            <button type="button" style={styles.linkBtn} onClick={() => setShowCreateForm(false)}>
              ← Back to existing profiles
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: '#f5f3ff',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: '#fff',
    borderRadius: '20px',
    padding: '32px 28px',
    boxShadow: '0 8px 32px rgba(79,70,229,0.12)',
  },
  title: { fontSize: '26px', fontWeight: 'bold', textAlign: 'center', marginBottom: '6px' },
  subtitle: { color: '#6b7280', textAlign: 'center', marginBottom: '28px', fontSize: '15px' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  label: { display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '15px', fontWeight: '600', color: '#374151' },
  input: {
    padding: '12px 14px',
    fontSize: '18px',
    borderRadius: '10px',
    border: '2px solid #e5e7eb',
    outline: 'none',
    fontFamily: 'inherit',
  },
  gradeRow: { display: 'flex', gap: '8px' },
  gradeBtn: {
    flex: 1,
    padding: '12px 0',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    background: '#fff',
    fontSize: '15px',
    cursor: 'pointer',
    fontWeight: '500',
  },
  gradeBtnActive: {
    borderColor: '#4f46e5',
    background: '#eef2ff',
    color: '#4f46e5',
  },
  submitBtn: {
    padding: '14px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '17px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '4px',
  },
  existingBtn: {
    padding: '14px',
    background: '#eef2ff',
    color: '#4f46e5',
    border: '2px solid #c7d2fe',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
  },
  linkBtn: {
    padding: '8px',
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: '14px',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  restoreBanner: {
    background: '#fef3c7',
    border: '1px solid #fde68a',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
};
