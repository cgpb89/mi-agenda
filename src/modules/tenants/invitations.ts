import 'server-only';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { withTransaction, type Tx } from '@/lib/db/tx';
import { hashPassword } from '@/lib/auth/password';
import { hmacHex } from '@/lib/security/tokens';
import { audit } from '@/modules/audit/audit';

export const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

export function inviteTokenHash(token: string): string {
  return hmacHex(getEnv().PASSWORD_RESET_TOKEN_SECRET, `invite:${token}`);
}

export async function findValidInvitation(tx: Tx, token: string) {
  const inv = await tx.invitation.findUnique({
    where: { tokenHash: inviteTokenHash(token) },
    include: { tenant: { select: { id: true, name: true, slug: true, status: true } } },
  });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt <= new Date()) return null;
  if (inv.tenant.status !== 'ACTIVE' && inv.tenant.status !== 'TRIAL') return null;
  return inv;
}

/** Join the tenant: create (or reactivate) the membership; STAFF also get a calendar. */
async function join(
  tx: Tx,
  inv: NonNullable<Awaited<ReturnType<typeof findValidInvitation>>>,
  user: { id: string; name: string },
) {
  const consumed = await tx.invitation.updateMany({
    where: { id: inv.id, acceptedAt: null },
    data: { acceptedAt: new Date() },
  });
  if (consumed.count !== 1) throw new AppError('CONFLICT', 'This invitation was already used.');
  await tx.membership.upsert({
    where: { tenantId_userId: { tenantId: inv.tenantId, userId: user.id } },
    create: { tenantId: inv.tenantId, userId: user.id, role: inv.role },
    update: { role: inv.role, status: 'ACTIVE' },
  });
  if (inv.role === 'STAFF') {
    const existing = await tx.staff.findFirst({
      where: { tenantId: inv.tenantId, userId: user.id },
      select: { id: true },
    });
    if (!existing)
      await tx.staff.create({
        data: { tenantId: inv.tenantId, userId: user.id, displayName: user.name },
      });
  }
  await audit(
    {
      tenantId: inv.tenantId,
      actorUserId: user.id,
      actorType: 'user',
      action: 'membership.joined',
      targetType: 'user',
      targetId: user.id,
      metadata: { role: inv.role },
    },
    tx,
  );
  return inv.tenant.slug;
}

export async function acceptInvitationAsUser(
  token: string,
  user: { userId: string; email: string; name: string },
): Promise<string> {
  return withTransaction(async (tx) => {
    const inv = await findValidInvitation(tx, token);
    if (!inv) throw new AppError('VALIDATION', 'This invitation is invalid or has expired.');
    if (inv.email !== user.email)
      throw new AppError(
        'FORBIDDEN',
        `This invitation is for a different email address. Sign in as the invited person.`,
      );
    return join(tx, inv, { id: user.userId, name: user.name });
  });
}

export async function acceptInvitationWithNewAccount(
  token: string,
  name: string,
  password: string,
): Promise<{ userId: string; slug: string }> {
  const passwordHash = await hashPassword(password);
  return withTransaction(async (tx) => {
    const inv = await findValidInvitation(tx, token);
    if (!inv) throw new AppError('VALIDATION', 'This invitation is invalid or has expired.');
    const exists = await tx.user.findUnique({ where: { email: inv.email }, select: { id: true } });
    if (exists)
      throw new AppError(
        'CONFLICT',
        'An account with this email already exists. Sign in to accept the invitation.',
      );
    const user = await tx.user.create({ data: { email: inv.email, name, passwordHash } });
    await audit(
      {
        actorUserId: user.id,
        actorType: 'user',
        action: 'user.registered',
        targetType: 'user',
        targetId: user.id,
        metadata: { via: 'invitation' },
      },
      tx,
    );
    const slug = await join(tx, inv, { id: user.id, name });
    return { userId: user.id, slug };
  });
}
