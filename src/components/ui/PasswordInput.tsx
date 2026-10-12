'use client';

import { useState, type ComponentProps } from 'react';
import { Input } from './Form';
import styles from './PasswordInput.module.scss';
import { useI18n } from '@/i18n/client';

/** Password field with an eye button to show/hide what was typed. */
export function PasswordInput(props: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();
  const label = visible ? t.common.hidePassword : t.common.showPassword;
  return (
    <span className={styles.wrap}>
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={[styles.input, props.className].filter(Boolean).join(' ')}
      />
      <button
        type="button"
        className={styles.toggle}
        aria-label={label}
        title={label}
        aria-pressed={visible}
        aria-controls={props.id}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? (
          // Eye with a slash: password is visible, click to hide.
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3.2 4.2M6.2 6.2C3.9 7.7 2.5 10 2 12c1 2.5 5 7 10 7a9.7 9.7 0 0 0 4.4-1"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z"
            />
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
      </button>
    </span>
  );
}
