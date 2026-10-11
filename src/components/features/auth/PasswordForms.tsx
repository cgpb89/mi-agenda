'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { forgotPasswordAction, resetPasswordAction, type FormState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input } from '@/components/ui/Form';
import styles from './Auth.module.scss';
import { useI18n } from '@/i18n/client';

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, {});
  const fe = state.error?.fieldErrors ?? {};
  const { t } = useI18n();
  if (state.done) {
    return (
      <div className={styles.form}>
        <FormMessage kind="success">{t.auth.forgot.sent}</FormMessage>
        <Link href="/login">{t.auth.backToSignIn}</Link>
      </div>
    );
  }
  return (
    <form action={action} className={styles.form} noValidate>
      {state.error && !Object.keys(fe).length ? (
        <FormMessage kind="error">{state.error.message}</FormMessage>
      ) : null}
      <Field label={t.auth.email} error={fe.email}>
        {(p) => (
          <Input
            {...p}
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.values?.email ?? ''}
          />
        )}
      </Field>
      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? t.auth.forgot.submitting : t.auth.forgot.submit}
      </Button>
      <div className={styles.footer}>
        <Link href="/login">{t.auth.backToSignIn}</Link>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, {});
  const fe = state.error?.fieldErrors ?? {};
  const { t } = useI18n();
  return (
    <form action={action} className={styles.form} noValidate>
      {state.error && (!Object.keys(fe).length || fe.token) ? (
        <FormMessage kind="error">{state.error.message}</FormMessage>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <Field label={t.auth.reset.newPassword} hint={t.auth.atLeast10} error={fe.password}>
        {(p) => (
          <Input
            {...p}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
          />
        )}
      </Field>
      <Field label={t.auth.reset.confirm} error={fe.confirm}>
        {(p) => (
          <Input {...p} name="confirm" type="password" autoComplete="new-password" required />
        )}
      </Field>
      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? t.auth.reset.submitting : t.auth.reset.submit}
      </Button>
    </form>
  );
}
