import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/features/auth/PasswordForms';
import styles from '@/components/features/auth/Auth.module.scss';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.reset.metaTitle, referrer: 'no-referrer' };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = typeof token === 'string' && token.length >= 20 && token.length <= 128;
  const { t } = await getI18n();
  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>{t.auth.accountHelp}</span>
      <h1 className={styles.title}>{t.auth.reset.title}</h1>
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className={styles.sub}>
          {t.auth.reset.invalid} <Link href="/forgot-password">{t.auth.reset.requestNew}</Link>.
        </p>
      )}
    </div>
  );
}
