import { Spinner } from './Spinner';
import styles from './PageLoading.module.scss';

/**
 * Placeholder shown while a page loads (route `loading.tsx`). `variant="page"`
 * mimics a dashboard page (header + cards); `variant="center"` is a spinner.
 */
export function PageLoading({
  label,
  variant = 'page',
}: {
  label: string;
  variant?: 'page' | 'center';
}) {
  if (variant === 'center') {
    return (
      <div className={styles.center} role="status" aria-live="polite">
        <Spinner size={28} />
        <span>{label}</span>
      </div>
    );
  }
  return (
    <div className={styles.page} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.srOnly}>{label}</span>
      <div className={styles.header} aria-hidden="true">
        <span className={styles.bar} style={{ width: 180, height: 22 }} />
        <span className={styles.bar} style={{ width: 120, height: 12 }} />
      </div>
      <div className={styles.grid} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.card}>
            <span className={styles.bar} style={{ width: '40%', height: 14 }} />
            <span className={styles.bar} style={{ width: '90%' }} />
            <span className={styles.bar} style={{ width: '75%' }} />
            <span className={styles.bar} style={{ width: '60%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
