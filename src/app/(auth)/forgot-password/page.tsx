import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/features/auth/PasswordForms';
import styles from '@/components/features/auth/Auth.module.scss';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.forgot.metaTitle };
}

export default async function ForgotPasswordPage() {
  const { t } = await getI18n();
  return (
    <div className={styles.card}>
      <span className={styles.eyebrow}>{t.auth.accountHelp}</span>
      <h1 className={styles.title}>{t.auth.forgot.title}</h1>
      <p className={styles.sub}>{t.auth.forgot.sub}</p>
      <ForgotPasswordForm />
    </div>
  );
}
