import { beforeEach, describe, expect, it } from 'vitest';
import { createAppointment } from '@/modules/bookings/engine';
import { transitionAppointment } from '@/modules/bookings/lifecycle';
import { recordPayment, voidPayment } from '@/modules/payments/service';
import { loadPeriod, resolveRange } from '@/modules/analytics/service';
import { collectedMinor, totals } from '@/modules/analytics/aggregate';
import { savePolicyAction } from '@/modules/businesses/actions';
import {
  adminDb,
  makeTenant,
  nextWeekday,
  PHONE,
  resetDb,
  signInAs,
  TZ,
  type TenantFixture,
} from './factories';

let t: TenantFixture;
let apptId: string;

beforeEach(async () => {
  await resetDb();
  t = await makeTenant({ maxPerPhone: 5 });
  const a = await createAppointment({
    tenantId: t.tenantId,
    mode: 'staff',
    serviceId: t.services.long,
    staffId: t.staff.a,
    date: nextWeekday(2),
    startMin: 600,
    customer: { name: 'Pay Er', phoneRaw: PHONE(1), phoneCountry: 'US' },
    source: 'PHONE',
    actorUserId: t.ownerId,
  });
  apptId = a.id;
});

describe('collected money is explicit and separate from estimated value', () => {
  it('completing an appointment does not record a payment', async () => {
    await adminDb().appointment.update({
      where: { id: apptId },
      data: {
        startAt: new Date(Date.now() - 3600_000),
        endAt: new Date(Date.now() - 1800_000),
        blockStartAt: new Date(Date.now() - 3600_000),
        blockEndAt: new Date(Date.now() - 900_000),
        durationMin: 30,
      },
    });
    await transitionAppointment({
      tenantId: t.tenantId,
      appointmentId: apptId,
      action: 'complete',
      actorType: 'user',
      actorUserId: t.ownerId,
    });
    expect(await adminDb().paymentRecord.count({ where: { appointmentId: apptId } })).toBe(0);
  });

  it('supports partial payments, refunds and voids without double counting', async () => {
    const base = {
      tenantId: t.tenantId,
      appointmentId: apptId,
      method: 'CASH' as const,
      actorUserId: t.ownerId,
    };
    const p1 = await recordPayment({ ...base, kind: 'PAYMENT', amountMinor: 2000 });
    await recordPayment({ ...base, kind: 'PAYMENT', amountMinor: 4000 });
    await expect(
      recordPayment({ ...base, kind: 'REFUND', amountMinor: 7000 }),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await recordPayment({ ...base, kind: 'REFUND', amountMinor: 1000 });
    await voidPayment({
      tenantId: t.tenantId,
      paymentId: p1.id,
      reason: 'entered twice',
      actorUserId: t.ownerId,
    });
    await expect(
      voidPayment({
        tenantId: t.tenantId,
        paymentId: p1.id,
        reason: 'again',
        actorUserId: t.ownerId,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    const range = resolveRange('7d', TZ, new Date());
    const { payments } = await loadPeriod({ tenantId: t.tenantId, timezone: TZ }, range);
    expect(collectedMinor(payments)).toBe(4000 - 1000);
  });

  it('cancelled appointments cannot take new payments but can be refunded', async () => {
    const base = {
      tenantId: t.tenantId,
      appointmentId: apptId,
      method: 'CARD' as const,
      actorUserId: t.ownerId,
    };
    await recordPayment({ ...base, kind: 'PAYMENT', amountMinor: 6000 });
    await transitionAppointment({
      tenantId: t.tenantId,
      appointmentId: apptId,
      action: 'cancel',
      actorType: 'user',
      actorUserId: t.ownerId,
    });
    await expect(
      recordPayment({ ...base, kind: 'PAYMENT', amountMinor: 100 }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      recordPayment({ ...base, kind: 'REFUND', amountMinor: 6000 }),
    ).resolves.toBeTruthy();
  });

  it('estimated value counts only completed appointments by their snapshot price', async () => {
    const range = resolveRange('90d', TZ, new Date());
    const { rows } = await loadPeriod(
      { tenantId: t.tenantId, timezone: TZ },
      { ...range, to: nextWeekday(2) },
    );
    expect(totals(rows, new Date()).estimatedMinor).toBe(0); // confirmed, not completed
  });
});

describe('audit trail', () => {
  it('records appointment, payment and policy changes; the runtime role cannot rewrite it', async () => {
    await recordPayment({
      tenantId: t.tenantId,
      appointmentId: apptId,
      kind: 'PAYMENT',
      amountMinor: 6000,
      method: 'CASH',
      actorUserId: t.ownerId,
    });
    await signInAs(t.ownerId);
    expect(
      (
        await savePolicyAction(t.slug, {
          maxActiveAppointmentsPerPhone: 3,
          cancellationWindowMin: 240,
          requireEmail: true,
          autoConfirm: true,
        })
      ).ok,
    ).toBe(true);
    const actions = (
      await adminDb().auditLog.findMany({
        where: { tenantId: t.tenantId },
        select: { action: true, metadata: true },
      })
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(['appointment.created', 'payment.recorded', 'policy.updated']),
    );
    const policyEvent = await adminDb().auditLog.findFirstOrThrow({
      where: { tenantId: t.tenantId, action: 'policy.updated' },
    });
    expect(policyEvent.metadata).toMatchObject({
      maxActiveAppointmentsPerPhone: { from: 5, to: 3 },
    });

    // Runtime role (tempo_app) has no UPDATE/DELETE on audit_logs — only verifiable when connected as that role.
    const role = await adminDb().$queryRaw<
      { ok: boolean }[]
    >`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tempo_app') AS ok`;
    if (role[0]?.ok) {
      const priv = await adminDb().$queryRaw<{ upd: boolean; del: boolean }[]>`
        SELECT has_table_privilege('tempo_app', 'app.audit_logs', 'UPDATE') AS upd,
               has_table_privilege('tempo_app', 'app.audit_logs', 'DELETE') AS del`;
      expect(priv[0]).toEqual({ upd: false, del: false });
    }
  });

  it('rejects out-of-range phone limits server-side', async () => {
    await signInAs(t.ownerId);
    expect(
      await savePolicyAction(t.slug, {
        maxActiveAppointmentsPerPhone: 0,
        cancellationWindowMin: 240,
        requireEmail: true,
        autoConfirm: true,
      }),
    ).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    expect(
      await savePolicyAction(t.slug, {
        maxActiveAppointmentsPerPhone: 21,
        cancellationWindowMin: 240,
        requireEmail: true,
        autoConfirm: true,
      }),
    ).toMatchObject({ ok: false });
    expect(
      await savePolicyAction(t.slug, {
        maxActiveAppointmentsPerPhone: 2.5,
        cancellationWindowMin: 240,
        requireEmail: true,
        autoConfirm: true,
      }),
    ).toMatchObject({ ok: false });
    // The CHECK constraint is the backstop.
    await expect(
      adminDb().bookingPolicy.update({
        where: { tenantId: t.tenantId },
        data: { maxActiveAppointmentsPerPhone: 50 },
      }),
    ).rejects.toThrow();
  });
});

describe('database exposure (Supabase API roles)', () => {
  it('anon/authenticated roles cannot read application tables', async () => {
    const roles = await adminDb().$queryRaw<
      { rolname: string }[]
    >`SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')`;
    for (const { rolname } of roles) {
      const r = await adminDb().$queryRawUnsafe<{ ok: boolean }[]>(
        `SELECT has_schema_privilege('${rolname}', 'app', 'USAGE') AS ok`,
      );
      expect(r[0]?.ok).toBe(false);
    }
    const rls = await adminDb().$queryRaw<
      { n: bigint }[]
    >`SELECT count(*)::bigint AS n FROM pg_tables WHERE schemaname = 'app' AND tablename <> '_prisma_migrations' AND NOT rowsecurity`;
    expect(Number(rls[0]?.n)).toBe(0);
  });
});
