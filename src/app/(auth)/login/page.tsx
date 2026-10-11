import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/features/auth/LoginForm';
import styles from '@/components/features/auth/Auth.module.scss';
import { getSessionUser } from '@/lib/auth/session';
import { safeRedirectPath } from '@/lib/security/request';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.login.metaTitle };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const next = sp.next ? safeRedirectPath(sp.next, '') : '';
  if (await getSessionUser()) redirect(next || '/app');
  const { t } = await getI18n();
  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>{t.auth.login.eyebrow}</span>
      <h1 className={styles.title}>{t.auth.login.title}</h1>
      <LoginForm next={next} notice={sp.reset ? t.auth.login.passwordChanged : undefined} />
    </div>
  );
}
