import 'server-only';
import { AppError } from '@/lib/errors';
import { getDb } from '@/lib/db/client';
import { withTransaction, type Tx } from '@/lib/db/tx';
import { logger } from '@/lib/observability/logger';
import { audit } from '@/modules/audit/audit';
import { msg } from '@/i18n/message-ref';
import { DEPOSIT_HOLD_HOURS } from './rules';

/*
 * Staff review of SINPE deposits. Each operation locks the appointment row and
 * checks it is still a PENDING booking with an AWAITING deposit, so a deposit
 * is confirmed or rejected exactly once (two staff clicking at the same time,
 * or the expiry job racing a confirmation, can't both win).
 */

async function lockAwaiting(tx: Tx, tenantId: string, appointmentId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM app.appointments
    WHERE id = ${appointmentId}::uuid AND tenant_id = ${tenantId}::uuid
    FOR UPDATE`;
  if (rows.length === 0) throw new AppError('NOT_FOUND', msg('appointmentNotFound'));
  const appt = await tx.appointment.findFirstOrThrow({ where: { id: appointmentId, tenantId } });
  if (appt.depositStatus !== 'AWAITING' || appt.status !== 'PENDING' || !appt.depositMinor) {
    throw new AppError('CONFLICT', msg('depositNotAwaiting'));
  }
  return appt;
}

/**
 * Deposit verified: record it as a SINPE payment (reference as the note) and
 * confirm the appointment, in one transaction.
 */
export async function confirmDeposit(input: {
  tenantId: string;
  appointmentId: string;
  actorUserId: string;
  guard?: (appt: { staffId: string }) => void;
}): Promise<void> {
  await withTransaction(async (tx) => {
    const appt = await lockAwaiting(tx, input.tenantId, input.appointmentId);
    input.guard?.(appt);
    const now = new Date();
    const rec = await tx.paymentRecord.create({
      data: {
        tenantId: input.tenantId,
        appointmentId: appt.id,
        kind: 'PAYMENT',
        amountMinor: appt.depositMinor!,
        currency: appt.currency,
        method: 'SINPE',
        note: `SINPE ${appt.depositReference ?? ''}`.trim(),
        recordedByUserId: input.actorUserId,
      },
    });
    await tx.appointment.update({
      where: { id: appt.id },
      data: { status: 'CONFIRMED', confirmedAt: now, depositStatus: 'CONFIRMED' },
    });
    for (const [action, targetType, targetId, metadata] of [
      ['payment.recorded', 'payment', rec.id, { method: 'SINPE', amountMinor: appt.depositMinor }],
      ['appointment.confirmed', 'appointment', appt.id, { deposit: true }],
    ] as const) {
      await audit(
        {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          actorType: 'user',
          action,
          targetType,
          targetId,
          metadata: { ...metadata },
        },
        tx,
      );
    }
  });
}

/** Cancel a booking whose deposit could not be verified (by staff, or expired). */
async function failDeposit(
  tx: Tx,
  input: { tenantId: string; appointmentId: string; actorUserId: string | null },
  outcome: 'REJECTED' | 'EXPIRED',
  reason: string,
  guard?: (appt: { staffId: string }) => void,
) {
  const appt = await lockAwaiting(tx, input.tenantId, input.appointmentId);
  guard?.(appt);
  await tx.appointment.update({
    where: { id: appt.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: 'BUSINESS',
      cancelReason: reason.slice(0, 200),
      depositStatus: outcome,
      manageTokenHash: null,
    },
  });
  await audit(
    {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorType: input.actorUserId ? 'user' : 'system',
      action: 'appointment.cancelled',
      targetType: 'appointment',
      targetId: appt.id,
      metadata: { deposit: outcome },
    },
    tx,
  );
  return appt;
}

export async function rejectDeposit(input: {
  tenantId: string;
  appointmentId: string;
  actorUserId: string;
  reason: string;
  guard?: (appt: { staffId: string }) => void;
}): Promise<{ startAt: Date }> {
  return withTransaction((tx) => failDeposit(tx, input, 'REJECTED', input.reason, input.guard));
}

/**
 * Hourly: cancel bookings whose deposit is still unverified after
 * DEPOSIT_HOLD_HOURS, freeing their slots. Returns what was expired so callers
 * can email customers and notify the waitlist.
 */
export async function expireDeposits(
  reason: string,
  now: Date = new Date(),
): Promise<{ id: string; tenantId: string; startAt: Date }[]> {
  const cutoff = new Date(now.getTime() - DEPOSIT_HOLD_HOURS * 60 * 60 * 1000);
  const due = await getDb().appointment.findMany({
    where: { depositStatus: 'AWAITING', status: 'PENDING', createdAt: { lt: cutoff } },
    select: { id: true, tenantId: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  const expired: { id: string; tenantId: string; startAt: Date }[] = [];
  for (const d of due) {
    try {
      const appt = await withTransaction((tx) =>
        failDeposit(
          tx,
          { tenantId: d.tenantId, appointmentId: d.id, actorUserId: null },
          'EXPIRED',
          reason,
        ),
      );
      expired.push({ id: d.id, tenantId: d.tenantId, startAt: appt.startAt });
    } catch (err) {
      // Already confirmed or handled in the meantime: nothing to do.
      if (err instanceof AppError && err.code === 'CONFLICT') continue;
      logger.error('deposits: expiry failed', {
        appointmentId: d.id,
        error: err instanceof Error ? err : String(err),
      });
    }
  }
  return expired;
}
