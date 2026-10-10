import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/features/auth/PasswordForms';
import styles from '@/components/features/auth/Auth.module.scss';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>Account help</span>
      <h1 className={styles.title}>Reset your password</h1>
      <p className={styles.sub}>
        Enter the email you use for Tempo and we&rsquo;ll send you a link.
      </p>
      <ForgotPasswordForm />
    </div>
  );
}
