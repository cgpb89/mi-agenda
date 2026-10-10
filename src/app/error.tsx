'use client';

import Link from 'next/link';
import styles from '@/components/features/auth/Auth.module.scss';

/** Generic error boundary. Never shows error details to the user. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.logo}>
          tempo<span>.</span>
        </Link>
      </header>
      <main className={styles.main}>
        <div className={styles.card}>
          <span className={styles.eyebrow}>Something went wrong</span>
          <h1 className={styles.title}>We hit a problem</h1>
          <p className={styles.sub}>
            Please try again. If it keeps happening, wait a minute and reload the page.
          </p>
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
              Try again
            </button>
            <Link href="/" style={{ alignSelf: 'center' }}>
              Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
