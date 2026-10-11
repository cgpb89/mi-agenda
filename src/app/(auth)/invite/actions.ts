'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { toPublicError } from '@/lib/errors';
import { getLocale } from '@/i18n/server';
import { getSessionUser, startSession } from '@/lib/auth/session';
import { enforceRateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/security/request';
import { formToObject, nameSchema, parseInput, passwordSchema } from '@/lib/validation';
import {
  acceptInvitationAsUser,
  acceptInvitationWithNewAccount,
} from '@/modules/tenants/invitations';
import type { FormState } from '../actions';

const tokenSchema = z.string().min(20).max(128);

export async function acceptInviteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const values = formToObject(form);
  let slug: string;
  try {
    await enforceRateLimit('signupByIp', await clientIp());
    const token = parseInput(tokenSchema, values.token);
    const user = await getSessionUser();
    if (user) {
      slug = await acceptInvitationAsUser(token, user);
      // Rotate the session after the privilege change.
      await startSession(user.userId);
    } else {
      const input = parseInput(
        z.object({ name: nameSchema('name'), password: passwordSchema }),
        values,
      );
      const res = await acceptInvitationWithNewAccount(token, input.name, input.password);
      await startSession(res.userId);
      slug = res.slug;
    }
  } catch (err) {
    return {
      error: toPublicError(err, await getLocale(), 'acceptInvite'),
      values: { name: values.name ?? '' },
    };
  }
  redirect(`/app/${slug}/overview`);
}
