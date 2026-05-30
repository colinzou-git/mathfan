interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  allowDecimal?: boolean;
}

export function NumPad({ value, onChange, onSubmit, disabled, allowDecimal }: Props) {
  const press = (key: string) => {
    if (disabled) return;
    if (key === 'DEL') {
      onChange(value.slice(0, -1));
    } else if (key === 'ENTER') {
      if (value) onSubmit();
    } else if (key === '.') {
      if (!value.includes('.') && value.length < 6) onChange(value === '' ? '0.' : value + '.');
    } else if (value.length < 6) {
      onChange(value + key);
    }
  };

  // Bottom-left key is a decimal point when decimals are allowed, else hidden.
  const leftKey = allowDecimal ? '.' : '';
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', leftKey, '0', 'DEL'];

  return (
    <div className="numpad">
      <div className="numpad-grid">
        {keys.map((key, i) => (
          <button
            key={`${key}-${i}`}
            onClick={() => press(key)}
            disabled={disabled || key === ''}
            className={`numpad-key${key === 'DEL' ? ' numpad-del' : ''}`}
            style={{ visibility: key === '' ? 'hidden' : 'visible' }}
            aria-label={key === 'DEL' ? 'Delete' : key === '.' ? 'Decimal point' : key}
          >
            {key === 'DEL' ? '⌫' : key}
          </button>
        ))}
      </div>
      <button
        onClick={() => press('ENTER')}
        disabled={disabled || !value}
        className="numpad-check"
      >
        Check
      </button>
    </div>
  );
}
