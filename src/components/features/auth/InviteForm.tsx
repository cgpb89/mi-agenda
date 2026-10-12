'use client';

import { useActionState } from 'react';
import { acceptInviteAction } from '@/app/(auth)/invite/actions';
import type { FormState } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/Button';
import { Field, FormMessage, Input } from '@/components/ui/Form';
import { PasswordInput } from '@/components/ui/PasswordInput';
import styles from './Auth.module.scss';
import { useI18n } from '@/i18n/client';

export function InviteForm({ token, signedIn }: { token: string; signedIn: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInviteAction, {});
  const fe = state.error?.fieldErrors ?? {};
  const { t } = useI18n();
  return (
    <form action={action} className={styles.form} noValidate>
      {state.error ? <FormMessage kind="error">{state.error.message}</FormMessage> : null}
      <input type="hidden" name="token" value={token} />
      {signedIn ? null : (
        <>
          <Field label={t.auth.yourName} error={fe.name}>
            {(p) => (
              <Input
                {...p}
                name="name"
                autoComplete="name"
                defaultValue={state.values?.name ?? ''}
              />
            )}
          </Field>
          <Field label={t.auth.invite.choosePassword} hint={t.auth.atLeast10} error={fe.password}>
            {(p) => (
              <PasswordInput {...p} name="password" autoComplete="new-password" minLength={10} />
            )}
          </Field>
        </>
      )}
      <Button loading={pending} type="submit" variant="primary" size="lg" block disabled={pending}>
        {pending ? t.auth.invite.submitting : t.auth.invite.submit}
      </Button>
    </form>
  );
}
