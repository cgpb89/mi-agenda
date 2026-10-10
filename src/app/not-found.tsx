import Link from 'next/link';
import styles from '@/components/features/auth/Auth.module.scss';

export default function NotFound() {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.logo}>
          tempo<span>.</span>
        </Link>
      </header>
      <main className={styles.main}>
        <div className={styles.card}>
          <span className={styles.eyebrow}>404</span>
          <h1 className={styles.title}>We couldn&rsquo;t find that page</h1>
          <p className={styles.sub}>The link may be wrong, or the page is no longer available.</p>
          <Link href="/">Go to the home page</Link>
        </div>
      </main>
    </div>
  );
}
