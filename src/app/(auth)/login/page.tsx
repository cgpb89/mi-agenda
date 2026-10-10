import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/features/auth/LoginForm';
import styles from '@/components/features/auth/Auth.module.scss';
import { getSessionUser } from '@/lib/auth/session';
import { safeRedirectPath } from '@/lib/security/request';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const next = sp.next ? safeRedirectPath(sp.next, '') : '';
  if (await getSessionUser()) redirect(next || '/app');
  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>Welcome back</span>
      <h1 className={styles.title}>Sign in to Tempo</h1>
      <LoginForm
        next={next}
        notice={sp.reset ? 'Your password was changed. Sign in with the new one.' : undefined}
      />
    </div>
  );
}
