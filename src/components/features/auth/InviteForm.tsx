'use client';

import { useActionState } from 'react';
import { acceptInviteAction } from '@/app/(auth)/invite/actions';
import type { FormState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input } from '@/components/ui/Form';
import styles from './Auth.module.scss';

export function InviteForm({ token, signedIn }: { token: string; signedIn: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInviteAction, {});
  const fe = state.error?.fieldErrors ?? {};
  return (
    <form action={action} className={styles.form} noValidate>
      {state.error ? <FormMessage kind="error">{state.error.message}</FormMessage> : null}
      <input type="hidden" name="token" value={token} />
      {signedIn ? null : (
        <>
          <Field label="Your name" error={fe.name}>
            {(p) => (
              <Input
                {...p}
                name="name"
                autoComplete="name"
                defaultValue={state.values?.name ?? ''}
              />
            )}
          </Field>
          <Field label="Choose a password" hint="At least 10 characters" error={fe.password}>
            {(p) => (
              <Input
                {...p}
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
              />
            )}
          </Field>
        </>
      )}
      <Button type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? 'Joining…' : 'Accept invitation'}
      </Button>
    </form>
  );
}
