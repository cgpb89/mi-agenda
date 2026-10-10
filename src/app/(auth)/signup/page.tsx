import type { Metadata } from 'next';
import { SignupForm } from '@/components/features/auth/SignupForm';
import styles from '@/components/features/auth/Auth.module.scss';

export const metadata: Metadata = { title: 'Create your booking page' };

export default function SignupPage() {
  return (
    <div className={[styles.card, styles.wideCard].join(' ')}>
      <span className={styles.eyebrow}>Start free</span>
      <h1 className={styles.title}>Create your booking page</h1>
      <p className={styles.sub}>
        Set up your account and business. You can add services and hours in the next step.
      </p>
      <SignupForm />
    </div>
  );
}
