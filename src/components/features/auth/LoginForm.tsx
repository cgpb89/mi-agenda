'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, type FormState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input } from '@/components/ui/Form';
import styles from './Auth.module.scss';
import { useI18n } from '@/i18n/client';

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  const fe = state.error?.fieldErrors ?? {};
  const { t } = useI18n();
  return (
    <form action={action} className={styles.form} noValidate>
      {notice ? <FormMessage kind="success">{notice}</FormMessage> : null}
      {state.error && !Object.keys(fe).length ? (
        <FormMessage kind="error">{state.error.message}</FormMessage>
      ) : null}
      <input type="hidden" name="next" value={next ?? ''} />
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
      <Field label={t.auth.password} error={fe.password}>
        {(p) => (
          <Input {...p} name="password" type="password" autoComplete="current-password" required />
        )}
      </Field>
      <Button loading={pending} type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? t.auth.login.submitting : t.auth.login.submit}
      </Button>
      <div className={styles.footer}>
        <Link href="/forgot-password">{t.auth.login.forgot}</Link>
        <span>
          {t.auth.login.newHere} <Link href="/signup">{t.auth.login.createPage}</Link>
        </span>
      </div>
    </form>
  );
}
