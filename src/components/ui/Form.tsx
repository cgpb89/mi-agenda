import { useId, type ComponentProps, type ReactNode } from 'react';
import styles from './Form.module.scss';

export const formStyles = styles;

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  full?: boolean;
  children: (props: {
    id: string;
    'aria-invalid'?: true;
    'aria-describedby'?: string;
  }) => ReactNode;
}

/** Label + control + error, wired for accessibility. */
export function Field({ label, hint, error, full, children }: FieldProps) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <label htmlFor={id} className={[styles.field, full && styles.full].filter(Boolean).join(' ')}>
      <span>
        {label} {hint ? <span className={styles.hint}>{hint}</span> : null}
      </span>
      {children({
        id,
        ...(error ? { 'aria-invalid': true as const, 'aria-describedby': errId } : {}),
      })}
      {error ? (
        <span id={errId} className={styles.error}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Input(props: ComponentProps<'input'>) {
  return (
    <input {...props} className={[styles.control, props.className].filter(Boolean).join(' ')} />
  );
}

export function Select(props: ComponentProps<'select'>) {
  return (
    <select {...props} className={[styles.control, props.className].filter(Boolean).join(' ')} />
  );
}

export function Textarea(props: ComponentProps<'textarea'>) {
  return (
    <textarea {...props} className={[styles.control, props.className].filter(Boolean).join(' ')} />
  );
}

export function FormMessage({
  kind,
  children,
}: {
  kind: 'error' | 'success' | 'warning';
  children: ReactNode;
}) {
  const cls =
    kind === 'error'
      ? styles.formError
      : kind === 'success'
        ? styles.formSuccess
        : styles.formWarning;
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={cls}>
      {children}
    </div>
  );
}
