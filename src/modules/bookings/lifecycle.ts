import 'server-only';
import { AppError } from '@/lib/errors';
import { withTransaction, type Tx } from '@/lib/db/tx';
import { audit } from '@/modules/audit/audit';
import { type Transition, targetStatus, transitionError } from './rules';

export interface TransitionInput {
  tenantId: string;
  appointmentId: string;
  action: Transition;
  actorType: 'user' | 'customer';
  actorUserId?: string | null;
  reason?: string;
  now?: Date;
  /** Optional extra guard evaluated on the locked row (e.g. STAFF owns it). */
  guard?: (appt: { staffId: string; startAt: Date }) => void;
}

const ACTION_AUDIT = {
  confirm: 'appointment.confirmed',
  cancel: 'appointment.cancelled',
  complete: 'appointment.completed',
  no_show: 'appointment.no_show',
} as const;

async function lockAppointment(tx: Tx, tenantId: string, appointmentId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM app.appointments
    WHERE id = ${appointmentId}::uuid AND tenant_id = ${tenantId}::uuid
    FOR UPDATE`;
  if (rows.length === 0) throw new AppError('NOT_FOUND', 'Appointment not found.');
  return tx.appointment.findFirstOrThrow({ where: { id: appointmentId, tenantId } });
}

/** Apply a status transition atomically (row-locked, validated, audited). */
export async function transitionAppointment(input: TransitionInput) {
  return withTransaction(async (tx) => {
    const now = input.now ?? new Date();
    const appt = await lockAppointment(tx, input.tenantId, input.appointmentId);
    input.guard?.(appt);
    const err = transitionError(appt.status, input.action, appt.startAt, now);
    if (err) throw new AppError('CONFLICT', err);
    const to = targetStatus(input.action);
    const updated = await tx.appointment.update({
      where: { id: appt.id },
      data: {
        status: to,
        ...(to === 'CONFIRMED' ? { confirmedAt: now } : {}),
        ...(to === 'COMPLETED' ? { completedAt: now } : {}),
        ...(to === 'NO_SHOW' ? { noShowAt: now } : {}),
        ...(to === 'CANCELLED'
          ? {
              cancelledAt: now,
              cancelledBy: input.actorType === 'customer' ? 'CUSTOMER' : 'BUSINESS',
              cancelReason: input.reason?.slice(0, 200) ?? null,
              // A cancelled booking can no longer be self-managed.
              manageTokenHash: null,
            }
          : {}),
      },
    });
    await audit(
      {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType,
        action: ACTION_AUDIT[input.action],
        targetType: 'appointment',
        targetId: appt.id,
        metadata: {
          from: appt.status,
          to,
          ...(input.reason ? { reason: input.reason.slice(0, 200) } : {}),
        },
      },
      tx,
    );
    return updated;
  });
}
