import { useState } from 'react';
import type { StudentProfile, GradeLevel } from '../../types/math';
import { studentRepo } from '../../db/repositories';
import { generateId } from '../../utils/id';

interface Props {
  onCreated: (profile: StudentProfile) => void;
}

export function ProfileSetup({ onCreated }: Props) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState<GradeLevel>(3);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a name.');
      return;
    }
    const profile: StudentProfile = {
      id: generateId(),
      displayName: name.trim(),
      gradeLevel: grade,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      createdAt: new Date().toISOString(),
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
    await studentRepo.save(profile);
    onCreated(profile);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '8px' }}>🧮</div>
        <h1 style={styles.title}>Welcome to MathFan</h1>
        <p style={styles.subtitle}>Let's get started. Who's practicing today?</p>
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
};
