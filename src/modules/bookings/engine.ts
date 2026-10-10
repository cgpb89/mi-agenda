import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { isExclusionViolation, isUniqueViolation } from '@/lib/db/errors';
import { withTransaction, type Tx } from '@/lib/db/tx';
import { generateToken, hmacHex } from '@/lib/security/tokens';
import { normalizePhone } from '@/lib/phone';
import { audit } from '@/modules/audit/audit';
import {
  type BookingMode,
  type PolicyInput,
  type ServiceInput,
  type SlotReason,
  evaluateSlot,
  pickStaff,
} from '@/modules/scheduling/availability';
import { loadScheduleData } from '@/modules/scheduling/load';
import { isValidLocalDate, localMinutesToInstant, addDays } from '@/modules/scheduling/time';
import {
  PHONE_LIMIT_STATUSES,
  canReschedule,
  confirmationCode,
  wouldExceedPhoneLimit,
} from './rules';

/**
 * THE booking engine. Every appointment creation path (public booking page,
 * owner "New appointment", "Book again") and every reschedule goes through
 * here, so policy and conflict rules cannot diverge between entry points.
 *
 * Concurrency strategy (see docs/booking-engine.md):
 *  - Phone limit: inside a READ COMMITTED transaction we take
 *    pg_advisory_xact_lock(hashtextextended('phone:<tenant>:<e164>', 0)).
 *    Concurrent bookings for the same tenant+phone serialise on that lock, so
 *    "count active → insert" cannot be interleaved. The lock is transaction-
 *    scoped (released on commit/rollback), which is safe with the transaction
 *    pooler.
 *  - Staff overlap: the slot is re-validated inside the transaction, and the
 *    GiST exclusion constraint `appointments_no_staff_overlap` makes the
 *    database reject any overlapping active booking even under races. A
 *    violation maps to SLOT_TAKEN (no partial rows: the transaction rolls back,
 *    so a customer created in the same transaction is rolled back too).
 */

export interface CustomerInput {
  /** Staff mode only: book for an existing customer of this tenant. */
  existingCustomerId?: string;
  name: string;
  phoneRaw?: string;
  phoneCountry?: string;
  email?: string;
}

export interface CreateAppointmentInput {
  tenantId: string;
  mode: BookingMode;
  serviceId: string;
  /** null = "No preference" (server assigns). */
  staffId: string | null;
  date: string;
  startMin: number;
  customer: CustomerInput;
  customerNote?: string;
  internalNote?: string;
  source: 'ONLINE' | 'PHONE' | 'WALK_IN';
  idempotencyKey?: string;
  actorUserId?: string | null;
  now?: Date;
}

export interface CreatedAppointment {
  id: string;
  refNumber: number;
  confirmationCode: string;
  status: 'PENDING' | 'CONFIRMED';
  startAt: Date;
  endAt: Date;
  staffId: string;
  staffName: string;
  serviceName: string;
  durationMin: number;
  quotedPriceMinor: number;
  currency: string;
  /** Raw manage-link token. Returned once; only its HMAC is stored. */
  manageToken: string | null;
  replayed: boolean;
}

export function manageTokenHash(token: string): string {
  return hmacHex(getEnv().PASSWORD_RESET_TOKEN_SECRET, `manage:${token}`);
}

const PUBLIC_REASON_MESSAGE: Partial<Record<SlotReason, string>> = {
  past: 'That time has already passed. Please choose another time.',
  too_soon: 'That time is too soon to book online. Please choose a later time.',
  beyond_window: 'That date is too far ahead to book. Please choose an earlier date.',
  booked: 'That time was just taken. Please choose another time.',
};

export function slotProblem(reason: SlotReason): AppError {
  const message =
    PUBLIC_REASON_MESSAGE[reason] ?? "That time isn't available. Please choose another time.";
  return new AppError(reason === 'booked' ? 'SLOT_TAKEN' : 'POLICY', message, {
    fieldErrors: { slot: reason },
  });
}

async function lockPhoneKey(tx: Tx, tenantId: string, phoneE164: string): Promise<void> {
  const key = `phone:${tenantId}:${phoneE164}`;
  // Parameterised: the key is bound, never interpolated into SQL text.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

interface TenantBits {
  id: string;
  timezone: string;
  currency: string;
  country: string;
  status: string;
  pageStatus: string | null;
  policy: {
    maxActiveAppointmentsPerPhone: number;
    slotIntervalMin: number;
    minNoticeMin: number;
    maxAdvanceDays: number;
    autoConfirm: boolean;
    requireEmail: boolean;
  };
}

async function loadTenant(tx: Tx, tenantId: string): Promise<TenantBits> {
  const t = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      timezone: true,
      currency: true,
      country: true,
      status: true,
      profile: { select: { pageStatus: true } },
      policy: true,
    },
  });
  if (!t || !t.policy) throw new AppError('NOT_FOUND', 'Business not found.');
  return {
    id: t.id,
    timezone: t.timezone,
    currency: t.currency,
    country: t.country,
    status: t.status,
    pageStatus: t.profile?.pageStatus ?? null,
    policy: t.policy,
  };
}

function toServiceInput(s: {
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  availableOn: 'ALL' | 'WEEKDAYS' | 'SATURDAYS';
  maxAdvanceDays: number | null;
}): ServiceInput {
  return {
    durationMin: s.durationMin,
    bufferBeforeMin: s.bufferBeforeMin,
    bufferAfterMin: s.bufferAfterMin,
    availableOn: s.availableOn,
    maxAdvanceDays: s.maxAdvanceDays,
  };
}

function toPolicyInput(p: TenantBits['policy']): PolicyInput {
  return {
    slotIntervalMin: p.slotIntervalMin,
    minNoticeMin: p.minNoticeMin,
    maxAdvanceDays: p.maxAdvanceDays,
  };
}

function assertBookableTenant(t: TenantBits, mode: BookingMode) {
  if (t.status !== 'ACTIVE' && t.status !== 'TRIAL')
    throw new AppError('NOT_FOUND', 'Business not found.');
  if (mode === 'public' && t.pageStatus !== 'PUBLISHED')
    throw new AppError('NOT_FOUND', 'Business not found.');
}

function validateWhen(date: string, startMin: number) {
  if (!isValidLocalDate(date) || !Number.isInteger(startMin) || startMin < 0 || startMin >= 1440) {
    throw new AppError('VALIDATION', 'Choose a valid date and time.', {
      fieldErrors: { slot: 'invalid' },
    });
  }
}

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<CreatedAppointment> {
  validateWhen(input.date, input.startMin);
  // "No preference" may lose a race for the picked staff member; retry with a
  // fresh view so another free staff member can be assigned.
  const attempts = input.staffId === null ? 3 : 1;
  for (let attempt = 1; ; attempt++) {
    try {
      return await withTransaction((tx) => createInTx(tx, input));
    } catch (err) {
      // A concurrent duplicate of THIS submission may have committed first
      // (its booking then makes ours look like a conflict or a phone-limit
      // hit). If so, return the original result instead of an error.
      if (input.idempotencyKey) {
        const replay = await withTransaction((tx) =>
          replayIdempotent(tx, input.tenantId, input.idempotencyKey!),
        );
        if (replay) return replay;
      }
      if (isExclusionViolation(err)) {
        if (attempt < attempts) continue;
        throw slotProblem('booked');
      }
      if (isUniqueViolation(err, 'idempotency_key')) throw slotProblem('booked');
      throw err;
    }
  }
}

async function replayIdempotent(
  tx: Tx,
  tenantId: string,
  key: string,
): Promise<CreatedAppointment | null> {
  const existing = await tx.appointment.findFirst({
    where: { tenantId, idempotencyKey: key },
    include: { staff: { select: { displayName: true } } },
  });
  if (!existing) return null;
  // Rotate the manage token so the (legitimate) retrying client gets a usable link.
  const manageToken = existing.manageTokenHash ? generateToken(32) : null;
  if (manageToken) {
    await tx.appointment.update({
      where: { id: existing.id },
      data: { manageTokenHash: manageTokenHash(manageToken) },
    });
  }
  return {
    id: existing.id,
    refNumber: existing.refNumber,
    confirmationCode: confirmationCode(existing.refNumber),
    status: existing.status === 'PENDING' ? 'PENDING' : 'CONFIRMED',
    startAt: existing.startAt,
    endAt: existing.endAt,
    staffId: existing.staffId,
    staffName: existing.staff.displayName,
    serviceName: existing.serviceNameSnapshot,
    durationMin: existing.durationMin,
    quotedPriceMinor: existing.quotedPriceMinor,
    currency: existing.currency,
    manageToken,
    replayed: true,
  };
}

async function createInTx(tx: Tx, input: CreateAppointmentInput): Promise<CreatedAppointment> {
  const now = input.now ?? new Date();
  const tenant = await loadTenant(tx, input.tenantId);
  assertBookableTenant(tenant, input.mode);

  if (input.idempotencyKey) {
    const replay = await replayIdempotent(tx, tenant.id, input.idempotencyKey);
    if (replay) return replay;
  }

  // 1. Service: tenant-scoped, active (and online for public bookings). Price,
  //    duration and buffers come from the database only.
  const service = await tx.service.findFirst({
    where: {
      id: input.serviceId,
      tenantId: tenant.id,
      isActive: true,
      ...(input.mode === 'public' ? { isOnline: true } : {}),
    },
  });
  if (!service)
    throw new AppError('VALIDATION', 'Choose a service.', {
      fieldErrors: { serviceId: 'invalid' },
    });

  // 2. Eligible staff: active, same tenant, assigned to this service.
  const eligible = await tx.staff.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
      services: { some: { serviceId: service.id } },
      ...(input.staffId ? { id: input.staffId } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
    select: { id: true, displayName: true },
  });
  if (eligible.length === 0) {
    throw new AppError(
      'VALIDATION',
      input.staffId
        ? "That person doesn't offer this service."
        : 'Nobody offers this service right now.',
      {
        fieldErrors: { staffId: 'invalid' },
      },
    );
  }

  // 3. Customer identity & phone normalisation.
  let customerId: string | null = null;
  let phoneE164: string | null = null;
  let contactName = input.customer.name;
  let contactEmail = input.customer.email ?? null;

  if (input.customer.existingCustomerId) {
    if (input.mode !== 'staff')
      throw new AppError('FORBIDDEN', "You don't have access to do that.");
    const existing = await tx.customer.findFirst({
      where: { id: input.customer.existingCustomerId, tenantId: tenant.id },
    });
    if (!existing)
      throw new AppError('VALIDATION', 'Choose a customer.', {
        fieldErrors: { customerId: 'invalid' },
      });
    customerId = existing.id;
    phoneE164 = existing.phoneE164;
    contactName = existing.name;
    contactEmail = existing.email;
  } else if (input.customer.phoneRaw || input.mode === 'public') {
    const phone = normalizePhone(
      input.customer.phoneRaw,
      input.customer.phoneCountry ?? tenant.country,
    );
    if (!phone.ok) {
      throw new AppError('VALIDATION', 'Enter a phone number we can reach.', {
        fieldErrors: {
          phone:
            phone.reason === 'missing'
              ? 'Enter a phone number we can reach'
              : 'That phone number doesn’t look right for the selected country',
        },
      });
    }
    phoneE164 = phone.e164;
  }
  if (input.mode === 'public' && tenant.policy.requireEmail && !contactEmail) {
    throw new AppError('VALIDATION', 'Enter a valid email.', {
      fieldErrors: { email: 'Enter a valid email' },
    });
  }

  // 4. Per-phone active-appointment limit, serialised per tenant+phone.
  if (phoneE164) {
    await lockPhoneKey(tx, tenant.id, phoneE164);
    const active = await tx.appointment.count({
      where: {
        tenantId: tenant.id,
        customer: { phoneE164 },
        status: { in: [...PHONE_LIMIT_STATUSES] },
        endAt: { gt: now },
      },
    });
    const policy = await tx.bookingPolicy.findUnique({
      where: { tenantId: tenant.id },
      select: { maxActiveAppointmentsPerPhone: true },
    });
    const max =
      policy?.maxActiveAppointmentsPerPhone ?? tenant.policy.maxActiveAppointmentsPerPhone;
    if (wouldExceedPhoneLimit(active, max)) {
      throw new AppError(
        'PHONE_LIMIT',
        max === 1
          ? 'This phone number already has an upcoming appointment here. Cancel or finish it before booking another.'
          : `This phone number already has ${max} upcoming appointments here, which is the most this business allows.`,
        { fieldErrors: { phone: 'limit' } },
      );
    }
  }

  // 5. Authoritative availability re-check inside the transaction.
  const staffIds = eligible.map((s) => s.id);
  const schedule = await loadScheduleData(tx, {
    tenantId: tenant.id,
    tz: tenant.timezone,
    fromDate: input.date,
    toDate: input.date,
    staffIds,
  });
  const serviceInput = toServiceInput(service);
  const policyInput = toPolicyInput(tenant.policy);
  const okStaff: string[] = [];
  let firstFailure: SlotReason | null = null;
  let slot: { startMs: number; endMs: number; blockStartMs: number; blockEndMs: number } | null =
    null;
  for (const s of eligible) {
    const r = evaluateSlot(schedule, {
      staffId: s.id,
      date: input.date,
      startMin: input.startMin,
      service: serviceInput,
      policy: policyInput,
      nowMs: now.getTime(),
      mode: input.mode,
    });
    if (r.ok) {
      okStaff.push(s.id);
      slot ??= r;
    } else firstFailure ??= r.reason;
  }
  if (!slot || okStaff.length === 0) throw slotProblem(firstFailure ?? 'booked');

  const dayStart = localMinutesToInstant(input.date, 0, tenant.timezone);
  const dayEnd = localMinutesToInstant(addDays(input.date, 1), 0, tenant.timezone);
  const assignedId = input.staffId ?? pickStaff(okStaff, schedule.busy, dayStart, dayEnd)!;
  const assigned = eligible.find((s) => s.id === assignedId)!;

  // 6. Customer: one record per phone per tenant. Public submissions never
  //    overwrite an existing record (the phone is unverified) — the details as
  //    submitted are kept on the appointment as contact snapshots.
  if (!customerId) {
    if (phoneE164) {
      const found = await tx.customer.findUnique({
        where: { tenantId_phoneE164: { tenantId: tenant.id, phoneE164 } },
        select: { id: true },
      });
      customerId =
        found?.id ??
        (
          await tx.customer.create({
            data: { tenantId: tenant.id, name: contactName, phoneE164, email: contactEmail },
            select: { id: true },
          })
        ).id;
    } else {
      // Staff-created walk-in without a phone: no phone-limit key.
      customerId = (
        await tx.customer.create({
          data: { tenantId: tenant.id, name: contactName, phoneE164: null, email: contactEmail },
          select: { id: true },
        })
      ).id;
    }
  }

  const manageToken = input.mode === 'public' ? generateToken(32) : null;
  const status = input.mode === 'public' && !tenant.policy.autoConfirm ? 'PENDING' : 'CONFIRMED';

  const created = await tx.appointment.create({
    data: {
      tenantId: tenant.id,
      customerId,
      serviceId: service.id,
      staffId: assigned.id,
      startAt: new Date(slot.startMs),
      endAt: new Date(slot.endMs),
      blockStartAt: new Date(slot.blockStartMs),
      blockEndAt: new Date(slot.blockEndMs),
      status,
      source: input.source,
      serviceNameSnapshot: service.name,
      durationMin: service.durationMin,
      quotedPriceMinor: service.priceMinor,
      currency: service.currency,
      contactName,
      contactEmail,
      customerNote: input.customerNote ?? null,
      internalNote: input.internalNote ?? null,
      manageTokenHash: manageToken ? manageTokenHash(manageToken) : null,
      idempotencyKey: input.idempotencyKey ?? null,
      createdByUserId: input.actorUserId ?? null,
      confirmedAt: status === 'CONFIRMED' ? now : null,
    },
  });

  await audit(
    {
      tenantId: tenant.id,
      actorUserId: input.actorUserId ?? null,
      actorType: input.mode === 'public' ? 'customer' : 'user',
      action: 'appointment.created',
      targetType: 'appointment',
      targetId: created.id,
      metadata: {
        ref: created.refNumber,
        source: input.source,
        staffId: assigned.id,
        serviceId: service.id,
      },
    },
    tx,
  );

  return {
    id: created.id,
    refNumber: created.refNumber,
    confirmationCode: confirmationCode(created.refNumber),
    status,
    startAt: created.startAt,
    endAt: created.endAt,
    staffId: assigned.id,
    staffName: assigned.displayName,
    serviceName: service.name,
    durationMin: service.durationMin,
    quotedPriceMinor: service.priceMinor,
    currency: service.currency,
    manageToken,
    replayed: false,
  };
}

// ─────────────────────────────── Reschedule ───────────────────────────────

export interface RescheduleInput {
  tenantId: string;
  appointmentId: string;
  date: string;
  startMin: number;
  /** Optionally move to another staff member (staff mode only). */
  staffId?: string;
  mode: BookingMode;
  actorUserId?: string | null;
  now?: Date;
}

export async function rescheduleAppointment(input: RescheduleInput) {
  validateWhen(input.date, input.startMin);
  try {
    return await withTransaction(async (tx) => {
      const now = input.now ?? new Date();
      const tenant = await loadTenant(tx, input.tenantId);
      assertBookableTenant(tenant, input.mode);

      // Row lock: concurrent reschedule/cancel of the same appointment serialise.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM app.appointments
        WHERE id = ${input.appointmentId}::uuid AND tenant_id = ${tenant.id}::uuid
        FOR UPDATE`;
      if (locked.length === 0) throw new AppError('NOT_FOUND', 'Appointment not found.');

      const appt = await tx.appointment.findFirstOrThrow({
        where: { id: input.appointmentId, tenantId: tenant.id },
        include: { service: true },
      });
      if (!canReschedule(appt.status))
        throw new AppError('CONFLICT', 'This appointment can no longer be moved.');

      const staffId = input.mode === 'staff' && input.staffId ? input.staffId : appt.staffId;
      if (staffId !== appt.staffId) {
        const ok = await tx.staff.findFirst({
          where: {
            id: staffId,
            tenantId: tenant.id,
            isActive: true,
            services: { some: { serviceId: appt.serviceId } },
          },
          select: { id: true },
        });
        if (!ok) throw new AppError('VALIDATION', "That person doesn't offer this service.");
      }

      const schedule = await loadScheduleData(tx, {
        tenantId: tenant.id,
        tz: tenant.timezone,
        fromDate: input.date,
        toDate: input.date,
        staffIds: [staffId],
      });
      // Keep the booked duration (snapshot); use current buffers of the service.
      const serviceInput = { ...toServiceInput(appt.service), durationMin: appt.durationMin };
      const r = evaluateSlot(schedule, {
        staffId,
        date: input.date,
        startMin: input.startMin,
        service: serviceInput,
        policy: toPolicyInput(tenant.policy),
        nowMs: now.getTime(),
        mode: input.mode,
        excludeAppointmentId: appt.id,
      });
      if (!r.ok) throw slotProblem(r.reason);

      const updated = await tx.appointment.update({
        where: { id: appt.id },
        data: {
          staffId,
          startAt: new Date(r.startMs),
          endAt: new Date(r.endMs),
          blockStartAt: new Date(r.blockStartMs),
          blockEndAt: new Date(r.blockEndMs),
          status: appt.status === 'PENDING' ? 'PENDING' : 'CONFIRMED',
          rescheduleCount: { increment: 1 },
        },
      });
      await audit(
        {
          tenantId: tenant.id,
          actorUserId: input.actorUserId ?? null,
          actorType: input.mode === 'public' ? 'customer' : 'user',
          action: 'appointment.rescheduled',
          targetType: 'appointment',
          targetId: appt.id,
          metadata: {
            from: appt.startAt.toISOString(),
            to: updated.startAt.toISOString(),
            staffId,
          },
        },
        tx,
      );
      return updated;
    });
  } catch (err) {
    if (isExclusionViolation(err)) throw slotProblem('booked');
    throw err;
  }
}

/** Prisma type helper for callers. */
export type AppointmentRow = Prisma.AppointmentGetPayload<object>;
