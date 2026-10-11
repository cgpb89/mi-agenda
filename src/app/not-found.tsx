import Link from 'next/link';
import styles from '@/components/features/auth/Auth.module.scss';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { getI18n } from '@/i18n/server';

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.logo} aria-label={t.common.homeLabel}>
          tempo<span>.</span>
        </Link>
        <LocaleSwitcher />
      </header>
      <main className={styles.main}>
        <div className={styles.card}>
          <span className={styles.eyebrow}>404</span>
          <h1 className={styles.title}>{t.common.notFound.title}</h1>
          <p className={styles.sub}>{t.common.notFound.body}</p>
          <Link href="/">{t.common.notFound.home}</Link>
        </div>
      </main>
    </div>
  );
}
