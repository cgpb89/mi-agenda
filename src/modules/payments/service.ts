import 'server-only';
import { AppError } from '@/lib/errors';
import { withTransaction } from '@/lib/db/tx';
import { audit } from '@/modules/audit/audit';
import { ledgerEntryError, netCollectedMinor } from './ledger';
import { msg } from '@/i18n/message-ref';

export interface RecordPaymentInput {
  tenantId: string;
  appointmentId: string;
  kind: 'PAYMENT' | 'REFUND';
  amountMinor: number;
  method: 'CASH' | 'CARD' | 'OTHER';
  note?: string;
  actorUserId: string;
  guard?: (appt: { staffId: string }) => void;
}

/**
 * Record money explicitly collected (or refunded) for an appointment. The
 * appointment row is locked so concurrent entries cannot push the balance
 * below zero. Payments are allowed for any non-cancelled status; refunds are
 * allowed whenever something was collected (including after cancellation).
 */
export async function recordPayment(input: RecordPaymentInput) {
  return withTransaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM app.appointments
      WHERE id = ${input.appointmentId}::uuid AND tenant_id = ${input.tenantId}::uuid
      FOR UPDATE`;
    if (rows.length === 0) throw new AppError('NOT_FOUND', msg('appointmentNotFound'));
    const appt = await tx.appointment.findFirstOrThrow({
      where: { id: input.appointmentId, tenantId: input.tenantId },
      include: { payments: { select: { kind: true, amountMinor: true, voidedAt: true } } },
    });
    input.guard?.(appt);
    if (input.kind === 'PAYMENT' && appt.status === 'CANCELLED') {
      throw new AppError('CONFLICT', msg('cancelledRecordRefund'));
    }
    const collected = netCollectedMinor(appt.payments);
    const problem = ledgerEntryError(
      input.kind,
      input.amountMinor,
      collected,
      appt.quotedPriceMinor,
    );
    if (problem) throw new AppError('VALIDATION', problem, { fieldErrors: { amount: problem } });

    const rec = await tx.paymentRecord.create({
      data: {
        tenantId: input.tenantId,
        appointmentId: appt.id,
        kind: input.kind,
        amountMinor: input.amountMinor,
        currency: appt.currency,
        method: input.method,
        note: input.note ?? null,
        recordedByUserId: input.actorUserId,
      },
    });
    await audit(
      {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actorType: 'user',
        action: 'payment.recorded',
        targetType: 'appointment',
        targetId: appt.id,
        metadata: {
          paymentId: rec.id,
          kind: input.kind,
          amountMinor: input.amountMinor,
          method: input.method,
        },
      },
      tx,
    );
    return rec;
  });
}

export async function voidPayment(input: {
  tenantId: string;
  paymentId: string;
  reason: string;
  actorUserId: string;
}) {
  return withTransaction(async (tx) => {
    const rec = await tx.paymentRecord.findFirst({
      where: { id: input.paymentId, tenantId: input.tenantId },
    });
    if (!rec) throw new AppError('NOT_FOUND', msg('paymentNotFound'));
    if (rec.voidedAt) throw new AppError('CONFLICT', msg('alreadyVoided'));
    await tx.$queryRaw`SELECT id FROM app.appointments WHERE id = ${rec.appointmentId}::uuid AND tenant_id = ${input.tenantId}::uuid FOR UPDATE`;
    if (rec.kind === 'PAYMENT') {
      // Voiding a payment must not leave more refunded than collected.
      const others = await tx.paymentRecord.findMany({
        where: { appointmentId: rec.appointmentId, tenantId: input.tenantId, NOT: { id: rec.id } },
        select: { kind: true, amountMinor: true, voidedAt: true },
      });
      if (netCollectedMinor(others) < 0) {
        throw new AppError('CONFLICT', msg('voidRefundFirst'));
      }
    }
    const updated = await tx.paymentRecord.update({
      where: { id: rec.id },
      data: {
        voidedAt: new Date(),
        voidedByUserId: input.actorUserId,
        voidReason: input.reason.slice(0, 200),
      },
    });
    await audit(
      {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actorType: 'user',
        action: 'payment.voided',
        targetType: 'payment',
        targetId: rec.id,
        metadata: { appointmentId: rec.appointmentId, reason: input.reason.slice(0, 200) },
      },
      tx,
    );
    return updated;
  });
}
