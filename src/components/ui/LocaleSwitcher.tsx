'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALES, LOCALE_NAMES } from '@/i18n/config';
import { setLocaleAction } from '@/i18n/actions';
import { useI18n } from '@/i18n/client';
import styles from './LocaleSwitcher.module.scss';

/** Compact EN / ES toggle. Saves the choice in a cookie and re-renders the page. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div
      role="group"
      aria-label={t.common.language}
      className={[styles.group, className].filter(Boolean).join(' ')}
      aria-busy={pending}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          className={styles.item}
          aria-pressed={l === locale}
          title={LOCALE_NAMES[l]}
          disabled={pending}
          onClick={() => {
            if (l === locale) return;
            start(async () => {
              await setLocaleAction(l);
              router.refresh();
            });
          }}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
