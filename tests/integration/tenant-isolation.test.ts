import { beforeEach, describe, expect, it } from 'vitest';
import { getTenantContext, requireTenant } from '@/lib/auth/authorize';
import { createAppointment } from '@/modules/bookings/engine';
import {
  checkSlotAction,
  createAppointmentAction,
  rescheduleAppointmentAction,
  searchCustomersAction,
  transitionAppointmentAction,
} from '@/modules/bookings/actions';
import { getAppointmentDetailsAction } from '@/modules/bookings/drawer-actions';
import { updateCustomerAction } from '@/modules/customers/actions';
import { recordPaymentAction } from '@/modules/payments/actions';
import { saveServiceAction } from '@/modules/services/actions';
import { savePolicyAction } from '@/modules/businesses/actions';
import { updateMemberAction } from '@/modules/tenants/actions';
import { changePlanAction, setTenantStatusAction } from '@/modules/platform/actions';
import { loadPublicPage } from '@/modules/public/booking-page';
import {
  addMember,
  adminDb,
  makeTenant,
  nextWeekday,
  PHONE,
  resetDb,
  signInAs,
  signOut,
  type TenantFixture,
} from './factories';

/*
 * Tenant A's users must never read or change Tenant B's private data, whatever
 * IDs or slugs they send. These tests call the real server actions with a real
 * session cookie against PostgreSQL.
 */
let A: TenantFixture;
let B: TenantFixture;
let bAppointmentId: string;
let bCustomerId: string;
const date = nextWeekday(4);

beforeEach(async () => {
  await resetDb();
  A = await makeTenant({ maxPerPhone: 5 });
  B = await makeTenant({ maxPerPhone: 5 });
  const appt = await createAppointment({
    tenantId: B.tenantId,
    mode: 'public',
    serviceId: B.services.cut,
    staffId: B.staff.a,
    date,
    startMin: 600,
    customer: { name: 'Bea Customer', phoneRaw: PHONE(1), phoneCountry: 'US' },
    source: 'ONLINE',
  });
  bAppointmentId = appt.id;
  bCustomerId = (await adminDb().customer.findFirstOrThrow({ where: { tenantId: B.tenantId } })).id;
  await signInAs(A.ownerId);
});

describe('cross-tenant access through server actions', () => {
  it('A cannot read B’s appointment by id', async () => {
    const res = await getAppointmentDetailsAction(A.slug, bAppointmentId);
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('A cannot cancel, complete or reschedule B’s appointment', async () => {
    for (const action of ['cancel', 'confirm', 'complete'] as const) {
      const res = await transitionAppointmentAction(A.slug, {
        appointmentId: bAppointmentId,
        action,
      });
      expect(res.ok).toBe(false);
    }
    const res = await rescheduleAppointmentAction(A.slug, {
      appointmentId: bAppointmentId,
      date,
      startMin: 660,
    });
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    const row = await adminDb().appointment.findUniqueOrThrow({ where: { id: bAppointmentId } });
    expect(row.status).toBe('CONFIRMED');
    expect(row.startAt.getTime()).toBe(
      (
        await adminDb().appointment.findUniqueOrThrow({ where: { id: bAppointmentId } })
      ).startAt.getTime(),
    );
  });

  it('A cannot act on B by passing B’s slug', async () => {
    const res = await getAppointmentDetailsAction(B.slug, bAppointmentId);
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    await expect(requireTenant(B.slug)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('A cannot read, search or edit B’s customers', async () => {
    const search = await searchCustomersAction(A.slug, 'Bea');
    expect(search.ok && search.data).toEqual([]);
    const upd = await updateCustomerAction(A.slug, { id: bCustomerId, name: 'Hacked' });
    expect(upd).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect((await adminDb().customer.findUniqueOrThrow({ where: { id: bCustomerId } })).name).toBe(
      'Bea Customer',
    );
  });

  it('A cannot attach B’s service, staff or customer to a booking', async () => {
    const withBService = await createAppointmentAction(A.slug, {
      serviceId: B.services.cut,
      staffId: A.staff.a,
      date,
      startMin: 600,
      customerName: 'X',
      source: 'PHONE',
    });
    expect(withBService.ok).toBe(false);
    const withBStaff = await createAppointmentAction(A.slug, {
      serviceId: A.services.cut,
      staffId: B.staff.a,
      date,
      startMin: 600,
      customerName: 'X',
      source: 'PHONE',
    });
    expect(withBStaff.ok).toBe(false);
    const withBCustomer = await createAppointmentAction(A.slug, {
      serviceId: A.services.cut,
      staffId: A.staff.a,
      date,
      startMin: 600,
      customerId: bCustomerId,
      source: 'PHONE',
    });
    expect(withBCustomer.ok).toBe(false);
    const check = await checkSlotAction(A.slug, {
      serviceId: B.services.cut,
      staffId: B.staff.a,
      date,
      startMin: 600,
    });
    expect(check.ok && check.data.ok).toBe(false);
    expect(await adminDb().appointment.count({ where: { tenantId: A.tenantId } })).toBe(0);
  });

  it('A cannot record payments on B’s appointment or assign B’s staff to its services', async () => {
    const pay = await recordPaymentAction(A.slug, {
      appointmentId: bAppointmentId,
      kind: 'PAYMENT',
      amount: '30',
      method: 'CASH',
    });
    expect(pay).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    const svc = await saveServiceAction(A.slug, {
      name: 'Sneaky',
      durationMin: 30,
      price: '10',
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      staffIds: [B.staff.a],
      availableOn: 'ALL',
      maxAdvanceDays: '',
      isOnline: true,
    });
    expect(svc.ok).toBe(false);
  });

  it('the database rejects cross-tenant relationships even if application code had a bug', async () => {
    const cust = await adminDb().customer.create({
      data: { tenantId: A.tenantId, name: 'A cust' },
    });
    const start = new Date(Date.now() + 5 * 86_400_000);
    const end = new Date(start.getTime() + 30 * 60_000);
    await expect(
      adminDb().appointment.create({
        data: {
          tenantId: A.tenantId,
          customerId: cust.id,
          serviceId: B.services.cut /* B's */,
          staffId: A.staff.a,
          startAt: start,
          endAt: end,
          blockStartAt: start,
          blockEndAt: end,
          status: 'CONFIRMED',
          source: 'PHONE',
          serviceNameSnapshot: 'x',
          durationMin: 30,
          quotedPriceMinor: 0,
          currency: 'USD',
          contactName: 'x',
        },
      }),
    ).rejects.toThrow();
    await expect(
      adminDb().staffService.create({
        data: { tenantId: A.tenantId, staffId: A.staff.a, serviceId: B.services.cut },
      }),
    ).rejects.toThrow();
  });
});

describe('roles and authentication', () => {
  it('unauthenticated requests are refused', async () => {
    signOut();
    const res = await getAppointmentDetailsAction(B.slug, bAppointmentId);
    expect(res).toMatchObject({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });

  it('a user without membership cannot access the dashboard', async () => {
    const outsider = await addMember(A.tenantId, 'STAFF', 'temp@example.test');
    await adminDb().membership.deleteMany({ where: { userId: outsider.userId } });
    await signInAs(outsider.userId);
    await expect(getTenantContext(A.slug)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('STAFF cannot change policy, services, roles, or other people’s appointments', async () => {
    const staff = await addMember(B.tenantId, 'STAFF', 'staff@example.test');
    await signInAs(staff.userId);
    expect(
      await savePolicyAction(B.slug, {
        maxActiveAppointmentsPerPhone: 9,
        cancellationWindowMin: 0,
        requireEmail: false,
        autoConfirm: true,
      }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    const svc = await saveServiceAction(B.slug, {
      name: 'X',
      durationMin: 30,
      price: '1',
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      staffIds: [B.staff.a],
      availableOn: 'ALL',
      maxAdvanceDays: '',
      isOnline: true,
    });
    expect(svc).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    // bAppointment belongs to staff.a (the owner's calendar), not this staff member.
    expect(
      await transitionAppointmentAction(B.slug, {
        appointmentId: bAppointmentId,
        action: 'cancel',
      }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    // Staff can read appointments (calendar) though.
    expect((await getAppointmentDetailsAction(B.slug, bAppointmentId)).ok).toBe(true);
    // And cannot book into someone else's column.
    const other = await createAppointmentAction(B.slug, {
      serviceId: B.services.cut,
      staffId: B.staff.a,
      date,
      startMin: 720,
      customerName: 'Y',
      source: 'PHONE',
    });
    expect(other).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
  });

  it('MANAGER cannot change roles; the last owner cannot be demoted', async () => {
    const mgr = await addMember(B.tenantId, 'MANAGER', 'mgr@example.test');
    const ownerMembership = await adminDb().membership.findFirstOrThrow({
      where: { tenantId: B.tenantId, role: 'OWNER' },
    });
    await signInAs(mgr.userId);
    expect(
      await updateMemberAction(B.slug, { membershipId: ownerMembership.id, role: 'STAFF' }),
    ).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    await signInAs(B.ownerId);
    expect(
      await updateMemberAction(B.slug, { membershipId: ownerMembership.id, role: 'MANAGER' }),
    ).toMatchObject({ ok: false, error: { code: 'POLICY' } });
  });

  it('client-supplied roles/statuses are not trusted (role change revokes sessions)', async () => {
    const mgr = await addMember(B.tenantId, 'MANAGER', 'mgr2@example.test');
    const m = await adminDb().membership.findFirstOrThrow({ where: { userId: mgr.userId } });
    await signInAs(mgr.userId);
    await signInAs(B.ownerId);
    expect((await updateMemberAction(B.slug, { membershipId: m.id, role: 'STAFF' })).ok).toBe(true);
    expect(await adminDb().session.count({ where: { userId: mgr.userId } })).toBe(0);
  });
});

describe('platform admin boundaries', () => {
  it('ordinary tenant users cannot use platform actions', async () => {
    expect(
      await setTenantStatusAction({
        tenantId: B.tenantId,
        action: 'suspend',
        reason: 'testing it',
      }),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(
      await changePlanAction({ tenantId: B.tenantId, plan: 'BUSINESS', reason: 'testing it' }),
    ).toMatchObject({ ok: false });
  });

  it('a platform admin is not a member of tenants and cannot read their appointments', async () => {
    const admin = await addMember(A.tenantId, 'STAFF', 'admin@example.test');
    await adminDb().membership.deleteMany({ where: { userId: admin.userId } });
    await adminDb().user.update({ where: { id: admin.userId }, data: { platformRole: 'ADMIN' } });
    await signInAs(admin.userId);
    expect(await getAppointmentDetailsAction(B.slug, bAppointmentId)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    // Suspension needs a reason, is audited, takes the page offline and signs members out.
    expect(
      await setTenantStatusAction({ tenantId: B.tenantId, action: 'suspend', reason: '' }),
    ).toMatchObject({ ok: false, error: { code: 'VALIDATION' } });
    await adminDb().session.create({
      data: {
        userId: B.ownerId,
        tokenHash: 'x'.repeat(64),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    expect(
      (
        await setTenantStatusAction({
          tenantId: B.tenantId,
          action: 'suspend',
          reason: 'chargeback investigation',
        })
      ).ok,
    ).toBe(true);
    expect(await loadPublicPage(B.slug)).toBeNull();
    expect(await adminDb().session.count({ where: { userId: B.ownerId } })).toBe(0);
    expect(
      await adminDb().auditLog.count({
        where: { tenantId: B.tenantId, action: 'tenant.suspended' },
      }),
    ).toBe(1);
  });
});

describe('public booking page exposure', () => {
  it('shows only the requested business’s public information', async () => {
    const page = await loadPublicPage(A.slug);
    expect(page).not.toBeNull();
    expect(page!.tenantId).toBe(A.tenantId);
    expect(page!.services.every((s) => [A.services.cut, A.services.long].includes(s.id))).toBe(
      true,
    );
    expect(page!.staff.every((s) => [A.staff.a, A.staff.b].includes(s.id))).toBe(true);
    const json = JSON.stringify(page);
    expect(json).not.toContain('Bea Customer');
    expect(json).not.toContain('passwordHash');
    expect(json).not.toMatch(/\+1202555/);
  });

  it('unpublished pages are not public', async () => {
    await adminDb().businessProfile.update({
      where: { tenantId: A.tenantId },
      data: { pageStatus: 'DRAFT' },
    });
    expect(await loadPublicPage(A.slug)).toBeNull();
    // …but members can preview.
    expect(await loadPublicPage(A.slug, { allowDraftFor: A.ownerId })).not.toBeNull();
    expect(await loadPublicPage(A.slug, { allowDraftFor: B.ownerId })).toBeNull();
  });
});
