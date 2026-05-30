import { useEffect, useRef } from 'react';
import type { StudentSettings } from '../types/math';

interface Props {
  settings: StudentSettings;
  onChange: (updated: StudentSettings) => void;
  onClose: () => void;
}

export function SettingsOverlay({ settings, onChange, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Trap focus inside overlay; close on Escape
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (key: keyof StudentSettings) => {
    onChange({ ...settings, [key]: !settings[key] });
  };

  return (
    <div style={s.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Settings">
      <div style={s.panel} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <h2 style={s.title}>Settings</h2>
          <button ref={closeRef} style={s.closeBtn} onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <div style={s.items}>
          <ToggleRow
            label="Sound"
            description="Speak questions and feedback aloud"
            checked={settings.audioEnabled}
            onToggle={() => toggle('audioEnabled')}
          />
          <ToggleRow
            label="Auto-advance"
            description="On correct answer, skip to next question automatically"
            checked={settings.autoAdvance}
            onToggle={() => toggle('autoAdvance')}
          />
        </div>

        <p style={s.hint}>Press <kbd style={s.kbd}>Esc</kbd> to close</p>
      </div>
    </div>
  );
}

function ToggleRow({
  label, description, checked, onToggle,
}: {
  label: string; description: string; checked: boolean; onToggle: () => void;
}) {
  return (
    <label style={s.row}>
      <div style={s.rowText}>
        <span style={s.rowLabel}>{label}</span>
        <span style={s.rowDesc}>{description}</span>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        style={{
          ...s.toggle,
          background: checked ? '#4f46e5' : '#d1d5db',
        }}
      >
        <span style={{
          ...s.toggleKnob,
          transform: checked ? 'translateX(22px)' : 'translateX(2px)',
        }} />
      </button>
    </label>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 999,
  },
  panel: {
    width: '100%', maxWidth: '480px',
    background: '#fff',
    borderRadius: '20px 20px 0 0',
    padding: '24px 20px 40px',
    boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { fontSize: '20px', fontWeight: 'bold', margin: 0 },
  closeBtn: {
    background: '#f3f4f6', border: 'none', borderRadius: '50%',
    width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  items: { display: 'flex', flexDirection: 'column', gap: '4px' },
  row: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', gap: '16px',
  },
  rowText: { display: 'flex', flexDirection: 'column', gap: '2px' },
  rowLabel: { fontSize: '16px', fontWeight: '600', color: '#111827' },
  rowDesc: { fontSize: '13px', color: '#6b7280' },
  toggle: {
    position: 'relative', width: '46px', height: '26px',
    border: 'none', borderRadius: '13px', cursor: 'pointer',
    transition: 'background 0.2s', flexShrink: 0, padding: 0,
  },
  toggleKnob: {
    position: 'absolute', top: '2px',
    width: '22px', height: '22px',
    background: '#fff', borderRadius: '50%',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
    display: 'block',
  },
  hint: { textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '20px' },
  kbd: {
    background: '#f3f4f6', border: '1px solid #d1d5db',
    borderRadius: '4px', padding: '1px 6px', fontSize: '12px', fontFamily: 'monospace',
  },
};
