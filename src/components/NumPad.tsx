interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function NumPad({ value, onChange, onSubmit, disabled }: Props) {
  const press = (key: string) => {
    if (disabled) return;
    if (key === 'DEL') {
      onChange(value.slice(0, -1));
    } else if (key === 'ENTER') {
      if (value) onSubmit();
    } else if (value.length < 6) {
      onChange(value + key);
    }
  };

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'DEL', '0', 'ENTER'];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '10px',
      maxWidth: '280px',
      margin: '0 auto',
    }}>
      {keys.map(key => (
        <button
          key={key}
          onClick={() => press(key)}
          disabled={disabled}
          style={{
            padding: '20px 0',
            fontSize: key === 'ENTER' ? '14px' : '24px',
            fontWeight: 'bold',
            borderRadius: '12px',
            border: '2px solid #e5e7eb',
            background: key === 'ENTER' ? '#4f46e5' : key === 'DEL' ? '#f3f4f6' : '#ffffff',
            color: key === 'ENTER' ? '#ffffff' : '#1f2937',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            touchAction: 'manipulation',
            userSelect: 'none',
          }}
        >
          {key === 'DEL' ? '⌫' : key === 'ENTER' ? 'Check' : key}
        </button>
      ))}
    </div>
  );
}
