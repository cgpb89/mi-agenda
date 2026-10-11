import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { getDb } from '@/lib/db/client';
import type { Tx } from '@/lib/db/tx';
import { redactForLog } from '@/lib/observability/logger';

export type AuditAction =
  // accounts
  | 'user.registered'
  | 'user.login'
  | 'user.login_failed'
  | 'user.logout'
  | 'user.password_reset_requested'
  | 'user.password_reset'
  | 'user.suspended'
  | 'user.reactivated'
  // tenancy
  | 'tenant.created'
  | 'tenant.updated'
  | 'tenant.suspended'
  | 'tenant.reactivated'
  | 'tenant.plan_changed'
  | 'tenant.payment_recorded'
  | 'tenant.deleted'
  | 'membership.role_changed'
  | 'membership.invited'
  | 'membership.invitation_revoked'
  | 'membership.joined'
  | 'membership.removed'
  // configuration
  | 'policy.updated'
  | 'booking_page.updated'
  | 'booking_page.published'
  | 'booking_page.photo_added'
  | 'booking_page.photo_removed'
  | 'service.created'
  | 'service.updated'
  | 'service.deactivated'
  | 'service.reactivated'
  | 'service.deleted'
  | 'staff.created'
  | 'staff.updated'
  | 'staff.deleted'
  | 'availability.updated'
  | 'availability.exception_added'
  | 'availability.exception_removed'
  // appointments
  | 'appointment.created'
  | 'appointment.confirmed'
  | 'appointment.rescheduled'
  | 'appointment.cancelled'
  | 'appointment.completed'
  | 'appointment.no_show'
  | 'customer.updated'
  | 'payment.recorded'
  | 'payment.voided'
  // platform
  | 'feature_flag.toggled'
  | 'plan.updated'
  | 'platform.admin_granted';

export interface AuditEntry {
  tenantId?: string | null;
  actorUserId?: string | null;
  actorType: 'user' | 'customer' | 'system';
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  /** Structured details. Sensitive-looking keys are redacted defensively. */
  metadata?: Record<string, unknown>;
}

/** Append an audit event. Pass the transaction so the event commits atomically with the change. */
export async function audit(
  entry: AuditEntry,
  db: Tx | ReturnType<typeof getDb> = getDb(),
): Promise<void> {
  await db.auditLog.create({
    data: {
      tenantId: entry.tenantId ?? null,
      actorUserId: entry.actorUserId ?? null,
      actorType: entry.actorType,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: (redactForLog(entry.metadata ?? {}) ?? {}) as Prisma.InputJsonValue,
    },
  });
}
