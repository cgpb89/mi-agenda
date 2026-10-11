import Link from 'next/link';
import styles from '@/components/features/auth/Auth.module.scss';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';
import { getI18n } from '@/i18n/server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getI18n();
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.logo} aria-label={t.common.homeLabel}>
          tempo<span>.</span>
        </Link>
        <LocaleSwitcher />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
