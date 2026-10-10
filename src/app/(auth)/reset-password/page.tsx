import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from '@/components/features/auth/PasswordForms';
import styles from '@/components/features/auth/Auth.module.scss';

export const metadata: Metadata = { title: 'Choose a new password', referrer: 'no-referrer' };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = typeof token === 'string' && token.length >= 20 && token.length <= 128;
  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>Account help</span>
      <h1 className={styles.title}>Choose a new password</h1>
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className={styles.sub}>
          This reset link is invalid or has expired.{' '}
          <Link href="/forgot-password">Request a new one</Link>.
        </p>
      )}
    </div>
  );
}
