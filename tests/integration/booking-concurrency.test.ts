import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import {
  createAppointment,
  rescheduleAppointment,
  type CreateAppointmentInput,
} from '@/modules/bookings/engine';
import { transitionAppointment } from '@/modules/bookings/lifecycle';
import { adminDb, makeTenant, nextWeekday, PHONE, resetDb, type TenantFixture } from './factories';

let t: TenantFixture;
let date: string;

beforeEach(async () => {
  await resetDb();
  t = await makeTenant({ maxPerPhone: 5 });
  date = nextWeekday(3); // a Wednesday ≥ 2 days ahead
});

function book(over: Partial<CreateAppointmentInput> & { phone?: string } = {}) {
  const { phone, ...rest } = over;
  return createAppointment({
    tenantId: t.tenantId,
    mode: 'public',
    serviceId: t.services.cut,
    staffId: t.staff.a,
    date,
    startMin: 600, // 10:00
    customer: { name: 'Jordan Lee', phoneRaw: phone ?? PHONE(1), phoneCountry: 'US' },
    source: 'ONLINE',
    ...rest,
  });
}

async function settle<T>(ps: Promise<T>[]) {
  const res = await Promise.allSettled(ps);
  return {
    ok: res
      .filter((r): r is PromiseFulfilledResult<Awaited<T>> => r.status === 'fulfilled')
      .map((r) => r.value),
    errors: res
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason as AppError),
  };
}

describe('atomic conflict prevention (real PostgreSQL)', () => {
  it('accepts exactly one of many concurrent bookings for the same staff and time', async () => {
    const { ok, errors } = await settle(
      Array.from({ length: 10 }, (_, i) => book({ phone: PHONE(i + 10) })),
    );
    expect(ok).toHaveLength(1);
    expect(errors).toHaveLength(9);
    for (const e of errors) expect(e).toBeInstanceOf(AppError);
    expect(errors.every((e) => e.code === 'SLOT_TAKEN')).toBe(true);
    const rows = await adminDb().appointment.count({
      where: { tenantId: t.tenantId, status: { not: 'CANCELLED' } },
    });
    expect(rows).toBe(1);
  });

  it('lets different staff members take the same time concurrently', async () => {
    const { ok } = await settle([
      book({ staffId: t.staff.a, phone: PHONE(20) }),
      book({ staffId: t.staff.b, phone: PHONE(21) }),
    ]);
    expect(ok).toHaveLength(2);
  });

  it('"No preference" assigns distinct staff under concurrency and never double-books', async () => {
    const { ok, errors } = await settle(
      Array.from({ length: 4 }, (_, i) => book({ staffId: null, phone: PHONE(30 + i) })),
    );
    expect(ok).toHaveLength(2); // two staff → two bookings at 10:00
    expect(new Set(ok.map((a) => a.staffId)).size).toBe(2);
    expect(errors.every((e) => e.code === 'SLOT_TAKEN')).toBe(true);
  });

  it('respects buffers: back-to-back is allowed only after the buffer', async () => {
    await book({ serviceId: t.services.long, startMin: 600 }); // 10:00–11:00 + 15 min buffer
    await expect(book({ startMin: 660, phone: PHONE(2) })).rejects.toMatchObject({
      code: 'SLOT_TAKEN',
    });
    await expect(book({ startMin: 690, phone: PHONE(3) })).resolves.toBeTruthy(); // 11:30 is free
  });

  it('a cancelled appointment releases its slot', async () => {
    const first = await book();
    await transitionAppointment({
      tenantId: t.tenantId,
      appointmentId: first.id,
      action: 'cancel',
      actorType: 'customer',
    });
    await expect(book({ phone: PHONE(4) })).resolves.toBeTruthy();
  });

  it('rescheduling cannot create a conflict, even when two moves race for one slot', async () => {
    const a = await book({ startMin: 540, phone: PHONE(5) });
    const b = await book({ startMin: 600, phone: PHONE(6) });
    const c = await book({ startMin: 720, phone: PHONE(7) });
    await expect(
      rescheduleAppointment({
        tenantId: t.tenantId,
        appointmentId: a.id,
        date,
        startMin: 600,
        mode: 'staff',
      }),
    ).rejects.toMatchObject({ code: 'SLOT_TAKEN' });
    const { ok, errors } = await settle([
      rescheduleAppointment({
        tenantId: t.tenantId,
        appointmentId: a.id,
        date,
        startMin: 840,
        mode: 'staff',
      }),
      rescheduleAppointment({
        tenantId: t.tenantId,
        appointmentId: c.id,
        date,
        startMin: 840,
        mode: 'staff',
      }),
    ]);
    expect(ok).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: 'SLOT_TAKEN' });
    // Moving an appointment onto (part of) its own current time is fine.
    await expect(
      rescheduleAppointment({
        tenantId: t.tenantId,
        appointmentId: b.id,
        date,
        startMin: 615,
        mode: 'staff',
      }),
    ).resolves.toBeTruthy();
  });

  it('the database itself rejects overlapping active appointments (exclusion constraint)', async () => {
    const a = await book();
    const row = await adminDb().appointment.findUniqueOrThrow({ where: { id: a.id } });
    const {
      id: _id,
      refNumber: _r,
      manageTokenHash: _m,
      idempotencyKey: _k,
      createdAt: _c,
      updatedAt: _u,
      ...copy
    } = row;
    await expect(adminDb().appointment.create({ data: { ...copy } })).rejects.toThrow();
    // …but a cancelled copy does not occupy time.
    await expect(
      adminDb().appointment.create({
        data: { ...copy, status: 'CANCELLED', cancelledAt: new Date() },
      }),
    ).resolves.toBeTruthy();
  });
});

describe('per-phone active appointment limit', () => {
  it('cannot be exceeded by concurrent requests (limit 1)', async () => {
    await adminDb().bookingPolicy.update({
      where: { tenantId: t.tenantId },
      data: { maxActiveAppointmentsPerPhone: 1 },
    });
    const starts = [540, 600, 660, 720, 780, 840];
    const { ok, errors } = await settle(
      starts.map((s, i) =>
        book({ startMin: s, staffId: i % 2 ? t.staff.b : t.staff.a, phone: PHONE(50) }),
      ),
    );
    expect(ok).toHaveLength(1);
    expect(errors.every((e) => e.code === 'PHONE_LIMIT')).toBe(true);
  });

  it('treats differently formatted numbers as the same phone', async () => {
    await adminDb().bookingPolicy.update({
      where: { tenantId: t.tenantId },
      data: { maxActiveAppointmentsPerPhone: 1 },
    });
    await book({ phone: '202-555-0199' });
    await expect(book({ startMin: 720, phone: '+1 (202) 555 0199' })).rejects.toMatchObject({
      code: 'PHONE_LIMIT',
    });
  });

  it('is scoped per tenant', async () => {
    await adminDb().bookingPolicy.update({
      where: { tenantId: t.tenantId },
      data: { maxActiveAppointmentsPerPhone: 1 },
    });
    const other = await makeTenant({ maxPerPhone: 1 });
    await book({ phone: PHONE(60) });
    await expect(
      createAppointment({
        tenantId: other.tenantId,
        mode: 'public',
        serviceId: other.services.cut,
        staffId: other.staff.a,
        date,
        startMin: 600,
        customer: { name: 'Jordan Lee', phoneRaw: PHONE(60), phoneCountry: 'US' },
        source: 'ONLINE',
      }),
    ).resolves.toBeTruthy();
  });

  it('follows policy changes for subsequent bookings and ignores past/cancelled ones', async () => {
    await adminDb().bookingPolicy.update({
      where: { tenantId: t.tenantId },
      data: { maxActiveAppointmentsPerPhone: 2 },
    });
    const first = await book({ phone: PHONE(70) });
    await book({ startMin: 720, phone: PHONE(70) });
    await expect(book({ startMin: 780, phone: PHONE(70) })).rejects.toMatchObject({
      code: 'PHONE_LIMIT',
    });
    await transitionAppointment({
      tenantId: t.tenantId,
      appointmentId: first.id,
      action: 'cancel',
      actorType: 'customer',
    });
    await expect(book({ startMin: 780, phone: PHONE(70) })).resolves.toBeTruthy();
    // A stale past CONFIRMED appointment (status never updated) does not count.
    await adminDb().bookingPolicy.update({
      where: { tenantId: t.tenantId },
      data: { maxActiveAppointmentsPerPhone: 3 },
    });
    const cust = await adminDb().customer.findFirstOrThrow({ where: { tenantId: t.tenantId } });
    const svc = await adminDb().service.findUniqueOrThrow({ where: { id: t.services.cut } });
    const past = new Date(Date.now() - 7 * 86_400_000);
    await adminDb().appointment.create({
      data: {
        tenantId: t.tenantId,
        customerId: cust.id,
        serviceId: svc.id,
        staffId: t.staff.b,
        startAt: past,
        endAt: new Date(past.getTime() + 30 * 60_000),
        blockStartAt: past,
        blockEndAt: new Date(past.getTime() + 30 * 60_000),
        status: 'CONFIRMED',
        source: 'PHONE',
        serviceNameSnapshot: 'Cut',
        durationMin: 30,
        quotedPriceMinor: 3000,
        currency: 'USD',
        contactName: 'Jordan Lee',
      },
    });
    await expect(book({ startMin: 840, phone: PHONE(70) })).resolves.toBeTruthy();
  });

  it('applies to owner-created appointments too', async () => {
    await adminDb().bookingPolicy.update({
      where: { tenantId: t.tenantId },
      data: { maxActiveAppointmentsPerPhone: 1 },
    });
    await book({ phone: PHONE(80) });
    await expect(
      book({ mode: 'staff', source: 'PHONE', startMin: 720, phone: PHONE(80) }),
    ).rejects.toMatchObject({ code: 'PHONE_LIMIT' });
  });
});

describe('integrity of failed and repeated submissions', () => {
  it('a failed booking leaves no partial customer behind', async () => {
    await book({ phone: PHONE(90) });
    const before = await adminDb().customer.count({ where: { tenantId: t.tenantId } });
    await expect(book({ phone: PHONE(91) })).rejects.toMatchObject({ code: 'SLOT_TAKEN' }); // new phone, taken slot
    expect(await adminDb().customer.count({ where: { tenantId: t.tenantId } })).toBe(before);
  });

  it('idempotency key: a double submit creates one appointment', async () => {
    const key = randomUUID();
    const { ok } = await settle([book({ idempotencyKey: key }), book({ idempotencyKey: key })]);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(new Set(ok.map((a) => a.id)).size).toBe(1);
    expect(await adminDb().appointment.count({ where: { tenantId: t.tenantId } })).toBe(1);
  });

  it('uses server prices and durations, never client values, and snapshots them', async () => {
    const a = await book({ serviceId: t.services.long });
    expect(a.quotedPriceMinor).toBe(6000);
    expect(a.durationMin).toBe(60);
    await adminDb().service.update({
      where: { id: t.services.long },
      data: { priceMinor: 9999, name: 'Renamed' },
    });
    const row = await adminDb().appointment.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.quotedPriceMinor).toBe(6000);
    expect(row.serviceNameSnapshot).toBe('Long');
  });

  it('rejects public bookings outside working hours, on closed days and for unpublished pages', async () => {
    await expect(book({ startMin: 1000 })).rejects.toMatchObject({ code: 'POLICY' }); // 16:40 + 30 > 17:00
    await expect(book({ date: nextWeekday(7) })).rejects.toBeInstanceOf(AppError); // Sunday closed
    await adminDb().businessProfile.update({
      where: { tenantId: t.tenantId },
      data: { pageStatus: 'DRAFT' },
    });
    await expect(book()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects invalid phone numbers instead of storing them', async () => {
    await expect(book({ phone: '12' })).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(await adminDb().customer.count({ where: { tenantId: t.tenantId } })).toBe(0);
  });
});
