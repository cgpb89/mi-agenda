import styles from './Switch.module.scss';

/** On/off toggle (`role="switch"`). Pair it with a visible label via `aria-labelledby` or `label`. */
export function Switch({
  checked,
  onChange,
  label,
  labelledBy,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  labelledBy?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      className={[styles.switch, checked && styles.on].filter(Boolean).join(' ')}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
