'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getEnv } from '@/lib/env';
import { AppError, runAction, type ActionResult } from '@/lib/errors';
import { assertCan, requireTenant } from '@/lib/auth/authorize';
import { revokeAllSessions } from '@/lib/auth/session';
import { withTransaction } from '@/lib/db/tx';
import { sendMail } from '@/lib/mail';
import { enforceRateLimit } from '@/lib/rate-limit';
import { generateToken } from '@/lib/security/tokens';
import { emailSchema, parseInput, uuidSchema } from '@/lib/validation';
import { audit } from '@/modules/audit/audit';
import { INVITE_TTL_MS, inviteTokenHash } from './invitations';
import { msg } from '@/i18n/message-ref';
import { getI18n } from '@/i18n/server';

const inviteSchema = z.object({ email: emailSchema, role: z.enum(['MANAGER', 'STAFF']) });

export async function inviteMemberAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<{ emailed: boolean }>> {
  return runAction('inviteMember', async () => {
    const ctx = await requireTenant(tenantSlug, 'team.invite');
    const input = parseInput(inviteSchema, raw);
    // Only owners may grant manager rights.
    if (input.role === 'MANAGER') assertCan(ctx, 'team.roles');
    await enforceRateLimit('inviteByTenant', ctx.tenantId);
    const token = generateToken(32);
    await withTransaction(async (tx) => {
      const member = await tx.membership.findFirst({
        where: { tenantId: ctx.tenantId, user: { email: input.email } },
        select: { id: true },
      });
      if (member)
        throw new AppError('CONFLICT', msg('alreadyOnTeam'), {
          fieldErrors: { email: msg('alreadyOnTeamField') },
        });
      // Supersede earlier pending invites for the same email.
      await tx.invitation.updateMany({
        where: { tenantId: ctx.tenantId, email: input.email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const inv = await tx.invitation.create({
        data: {
          tenantId: ctx.tenantId,
          email: input.email,
          role: input.role,
          tokenHash: inviteTokenHash(token),
          invitedByUserId: ctx.userId,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      });
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'membership.invited',
          targetType: 'invitation',
          targetId: inv.id,
          metadata: { role: input.role },
        },
        tx,
      );
    });
    const link = `${getEnv().APP_URL}/invite?token=${encodeURIComponent(token)}`;
    const { t } = await getI18n();
    const mail = await sendMail({
      kind: 'auth',
      to: input.email,
      subject: t.emails.inviteSubject({ business: ctx.tenantName }),
      text: t.emails.inviteBody({
        inviter: ctx.user.name,
        business: ctx.tenantName,
        role: input.role,
        link,
      }),
    });
    revalidatePath(`/app/${tenantSlug}/settings`);
    return { emailed: mail.sent };
  });
}

export async function revokeInvitationAction(
  tenantSlug: string,
  id: string,
): Promise<ActionResult<undefined>> {
  return runAction('revokeInvitation', async () => {
    const ctx = await requireTenant(tenantSlug, 'team.invite');
    const invId = parseInput(uuidSchema, id);
    await withTransaction(async (tx) => {
      const res = await tx.invitation.updateMany({
        where: { id: invId, tenantId: ctx.tenantId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (res.count !== 1) throw new AppError('NOT_FOUND', msg('invitationNotFound'));
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'membership.invitation_revoked',
          targetType: 'invitation',
          targetId: invId,
        },
        tx,
      );
    });
    revalidatePath(`/app/${tenantSlug}/settings`);
    return undefined;
  });
}

const memberSchema = z.object({
  membershipId: uuidSchema,
  role: z.enum(['OWNER', 'MANAGER', 'STAFF']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
});

/** Change a member's role or access. Owner-only; the last active owner cannot be demoted or suspended. */
export async function updateMemberAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return runAction('updateMember', async () => {
    const ctx = await requireTenant(tenantSlug, 'team.roles');
    const input = parseInput(memberSchema, raw);
    await withTransaction(async (tx) => {
      const m = await tx.membership.findFirst({
        where: { id: input.membershipId, tenantId: ctx.tenantId },
      });
      if (!m) throw new AppError('NOT_FOUND', msg('memberNotFound'));
      const losingOwner =
        m.role === 'OWNER' &&
        m.status === 'ACTIVE' &&
        ((input.role && input.role !== 'OWNER') || input.status === 'SUSPENDED');
      if (losingOwner) {
        const owners = await tx.membership.count({
          where: { tenantId: ctx.tenantId, role: 'OWNER', status: 'ACTIVE' },
        });
        if (owners <= 1) throw new AppError('POLICY', msg('needsOwner'));
      }
      await tx.membership.update({
        where: { id: m.id },
        data: {
          ...(input.role ? { role: input.role } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
      });
      // Privilege changed → force re-authentication of that user.
      await revokeAllSessions([m.userId], tx);
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: input.status === 'SUSPENDED' ? 'membership.removed' : 'membership.role_changed',
          targetType: 'user',
          targetId: m.userId,
          metadata: {
            from: { role: m.role, status: m.status },
            to: { role: input.role ?? m.role, status: input.status ?? m.status },
          },
        },
        tx,
      );
    });
    revalidatePath(`/app/${tenantSlug}/settings`);
    return undefined;
  });
}
