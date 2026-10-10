'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction, type FormState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input } from '@/components/ui/Form';
import styles from './Auth.module.scss';

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  const fe = state.error?.fieldErrors ?? {};
  return (
    <form action={action} className={styles.form} noValidate>
      {notice ? <FormMessage kind="success">{notice}</FormMessage> : null}
      {state.error && !Object.keys(fe).length ? (
        <FormMessage kind="error">{state.error.message}</FormMessage>
      ) : null}
      <input type="hidden" name="next" value={next ?? ''} />
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
      <Field label="Password" error={fe.password}>
        {(p) => (
          <Input {...p} name="password" type="password" autoComplete="current-password" required />
        )}
      </Field>
      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
      <div className={styles.footer}>
        <Link href="/forgot-password">Forgot your password?</Link>
        <span>
          New to Tempo? <Link href="/signup">Create your booking page</Link>
        </span>
      </div>
    </form>
  );
}
