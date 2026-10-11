'use client';

import Link from 'next/link';
import styles from '@/components/features/auth/Auth.module.scss';
import { useI18n } from '@/i18n/client';

/** Generic error boundary. Never shows error details to the user. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.logo} aria-label={t.common.homeLabel}>
          tempo<span>.</span>
        </Link>
      </header>
      <main className={styles.main}>
        <div className={styles.card}>
          <span className={styles.eyebrow}>{t.common.error.eyebrow}</span>
          <h1 className={styles.title}>{t.common.error.title}</h1>
          <p className={styles.sub}>{t.common.error.body}</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                border: 0,
                background: '#1c1a17',
                color: '#fff',
                borderRadius: 8,
                padding: '10px 14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.common.error.retry}
            </button>
            <Link href="/" style={{ alignSelf: 'center' }}>
              {t.common.error.home}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
