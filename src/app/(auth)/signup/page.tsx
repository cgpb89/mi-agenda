import type { Metadata } from 'next';
import { SignupForm } from '@/components/features/auth/SignupForm';
import styles from '@/components/features/auth/Auth.module.scss';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.signup.metaTitle };
}

export default async function SignupPage() {
  const { t } = await getI18n();
  return (
    <div className={[styles.card, styles.wideCard].join(' ')}>
      <span className={styles.eyebrow}>{t.auth.signup.eyebrow}</span>
      <h1 className={styles.title}>{t.auth.signup.title}</h1>
      <p className={styles.sub}>{t.auth.signup.sub}</p>
      <SignupForm />
    </div>
  );
}
