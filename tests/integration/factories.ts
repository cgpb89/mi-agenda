import { PrismaPg } from '@prisma/adapter-pg';
import { DateTime } from 'luxon';
import { PrismaClient } from '@/generated/prisma/client';
import { getDb } from '@/lib/db/client';
import { createSessionRecord, sessionCookieName } from '@/lib/auth/session';
import { registerOwner } from '@/modules/auth/service';
import { testRequest } from '../support/next-mocks';

let admin: PrismaClient | undefined;

/** Owner-role connection (TEST_DIRECT_URL) for setup/teardown only. */
export function adminDb(): PrismaClient {
  admin ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL!, max: 2 }, { schema: 'app' }),
  });
  return admin;
}

/** Wipe all application data (test database only — guarded in setup.ts). */
export async function resetDb(): Promise<void> {
  await adminDb().$executeRawUnsafe(`
    TRUNCATE app.payment_records, app.appointments, app.customers, app.staff_services,
      app.availability_exceptions, app.availability_rules, app.services, app.staff,
      app.booking_policies, app.business_profiles, app.invitations, app.memberships,
      app.audit_logs, app.sessions, app.password_reset_tokens, app.rate_limit_buckets,
      app.feature_flags, app.tenants, app.users
    RESTART IDENTITY CASCADE`);
}

export const TZ = 'America/New_York';

/** Next local date (in TZ) that is the given ISO weekday, at least `minDaysAhead` days ahead. */
export function nextWeekday(isoWeekday: number, minDaysAhead = 2): string {
  let d = DateTime.now().setZone(TZ).startOf('day').plus({ days: minDaysAhead });
  while (d.weekday !== isoWeekday) d = d.plus({ days: 1 });
  return d.toISODate()!;
}

export interface TenantFixture {
  tenantId: string;
  slug: string;
  ownerId: string;
  ownerEmail: string;
  staff: { a: string; b: string };
  services: { cut: string; long: string };
}

let counter = 0;

/**
 * A published tenant: Mon–Sat 9:00–17:00 business hours, two staff who both
 * offer two services, phone limit 1 by default.
 */
export async function makeTenant(
  opts: { slug?: string; maxPerPhone?: number; minNoticeMin?: number } = {},
): Promise<TenantFixture> {
  counter += 1;
  const slug = opts.slug ?? `biz-${counter}-${Math.random().toString(36).slice(2, 7)}`;
  const ownerEmail = `owner-${slug}@example.test`;
  const { userId } = await registerOwner({
    name: `Owner ${counter}`,
    email: ownerEmail,
    password: 'correct horse battery staple',
    businessName: `Business ${counter}`,
    slug,
    category: 'BARBER',
    timezone: TZ,
    country: 'US',
  });
  const db = adminDb();
  const tenant = await db.tenant.findUniqueOrThrow({ where: { slug } });
  await db.availabilityRule.deleteMany({ where: { tenantId: tenant.id } });
  await db.availabilityRule.createMany({
    data: [1, 2, 3, 4, 5, 6].map((d) => ({
      tenantId: tenant.id,
      staffId: null,
      dayOfWeek: d,
      startMin: 540,
      endMin: 1020,
    })),
  });
  await db.bookingPolicy.update({
    where: { tenantId: tenant.id },
    data: {
      maxActiveAppointmentsPerPhone: opts.maxPerPhone ?? 1,
      minNoticeMin: opts.minNoticeMin ?? 0,
      slotIntervalMin: 30,
      maxAdvanceDays: 60,
      requireEmail: false,
    },
  });
  const ownerStaff = await db.staff.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const b = await db.staff.create({
    data: { tenantId: tenant.id, displayName: `Second ${counter}` },
  });
  const cut = await db.service.create({
    data: { tenantId: tenant.id, name: 'Cut', durationMin: 30, priceMinor: 3000, currency: 'USD' },
  });
  const long = await db.service.create({
    data: {
      tenantId: tenant.id,
      name: 'Long',
      durationMin: 60,
      priceMinor: 6000,
      currency: 'USD',
      bufferAfterMin: 15,
    },
  });
  await db.staffService.createMany({
    data: [ownerStaff.id, b.id].flatMap((staffId) =>
      [cut.id, long.id].map((serviceId) => ({ tenantId: tenant.id, staffId, serviceId })),
    ),
  });
  await db.businessProfile.update({
    where: { tenantId: tenant.id },
    data: { pageStatus: 'PUBLISHED' },
  });
  return {
    tenantId: tenant.id,
    slug,
    ownerId: userId,
    ownerEmail,
    staff: { a: ownerStaff.id, b: b.id },
    services: { cut: cut.id, long: long.id },
  };
}

/** Create a session for a user and put its cookie in the mocked request jar. */
export async function signInAs(userId: string): Promise<void> {
  testRequest.clearCookies();
  const { token } = await createSessionRecord(userId, 'vitest', getDb());
  testRequest.setCookie(sessionCookieName(), token);
}

export function signOut(): void {
  testRequest.clearCookies();
}

/** Add a member with a role (and staff profile for STAFF). */
export async function addMember(tenantId: string, role: 'MANAGER' | 'STAFF', email: string) {
  const db = adminDb();
  const { hashPassword } = await import('@/lib/auth/password');
  const user = await db.user.create({
    data: {
      email,
      name: email.split('@')[0]!,
      passwordHash: await hashPassword('correct horse battery staple'),
    },
  });
  await db.membership.create({ data: { tenantId, userId: user.id, role } });
  const staff =
    role === 'STAFF'
      ? await db.staff.create({ data: { tenantId, userId: user.id, displayName: user.name } })
      : null;
  return { userId: user.id, staffId: staff?.id ?? null };
}

export const PHONE = (n: number) => `(202) 555-${String(100 + n).padStart(4, '0')}`;
