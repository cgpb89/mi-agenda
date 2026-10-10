'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { forgotPasswordAction, resetPasswordAction, type FormState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input } from '@/components/ui/Form';
import styles from './Auth.module.scss';

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, {});
  const fe = state.error?.fieldErrors ?? {};
  if (state.done) {
    return (
      <div className={styles.form}>
        <FormMessage kind="success">
          If an account exists for that email, we sent a link to reset the password. It works for 30
          minutes.
        </FormMessage>
        <Link href="/login">Back to sign in</Link>
      </div>
    );
  }
  return (
    <form action={action} className={styles.form} noValidate>
      {state.error && !Object.keys(fe).length ? (
        <FormMessage kind="error">{state.error.message}</FormMessage>
      ) : null}
      <Field label="Email" error={fe.email}>
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
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
      <div className={styles.footer}>
        <Link href="/login">Back to sign in</Link>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, {});
  const fe = state.error?.fieldErrors ?? {};
  return (
    <form action={action} className={styles.form} noValidate>
      {state.error && (!Object.keys(fe).length || fe.token) ? (
        <FormMessage kind="error">{state.error.message}</FormMessage>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <Field label="New password" hint="At least 10 characters" error={fe.password}>
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
      <Field label="Confirm new password" error={fe.confirm}>
        {(p) => (
          <Input {...p} name="confirm" type="password" autoComplete="new-password" required />
        )}
      </Field>
      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
