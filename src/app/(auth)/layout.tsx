import Link from 'next/link';
import styles from '@/components/features/auth/Auth.module.scss';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.logo} aria-label="Tempo home">
          tempo<span>.</span>
        </Link>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
