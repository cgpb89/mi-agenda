import type { Metadata } from 'next';
import type { Prisma } from '@/generated/prisma/client';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { can } from '@/lib/auth/permissions';
import { parseRef } from '@/modules/bookings/rules';
import { netCollectedMinor } from '@/modules/payments/ledger';
import { AppointmentsView } from '@/components/features/appointments/AppointmentsView';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.app.nav.appointments };
}

const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
type Status = (typeof STATUSES)[number];
const PAGE = 30;

export default async function AppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await params;
  const sp = await searchParams;
  const ctx = await requireTenantPage(tenant, 'appointments.read');
  const db = getDb();

  const scope = sp.when === 'past' || sp.when === 'all' ? sp.when : 'upcoming';
  const status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : null;
  const q = (sp.q ?? '').trim().slice(0, 80);
  const limit = Math.min(600, Math.max(PAGE, Number(sp.limit) || PAGE));
  const now = new Date();

  const staff = await db.staff.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
    select: { id: true, displayName: true },
  });
  const staffId = staff.some((s) => s.id === sp.staff) ? sp.staff! : null;

  const ref = parseRef(q);
  const base: Prisma.AppointmentWhereInput = {
    tenantId: ctx.tenantId,
    ...(scope === 'upcoming'
      ? { endAt: { gt: now } }
      : scope === 'past'
        ? { endAt: { lte: now } }
        : {}),
    ...(staffId ? { staffId } : {}),
    ...(q
      ? {
          OR: [
            { contactName: { contains: q, mode: 'insensitive' } },
            { serviceNameSnapshot: { contains: q, mode: 'insensitive' } },
            ...(ref !== null ? [{ refNumber: ref }] : []),
          ],
        }
      : {}),
  };

  const [rows, counts] = await Promise.all([
    db.appointment.findMany({
      where: { ...base, ...(status ? { status } : {}) },
      orderBy: { startAt: scope === 'upcoming' ? 'asc' : 'desc' },
      take: limit + 1,
      select: {
        id: true,
        refNumber: true,
        contactName: true,
        serviceNameSnapshot: true,
        startAt: true,
        durationMin: true,
        quotedPriceMinor: true,
        currency: true,
        status: true,
        source: true,
        staff: { select: { displayName: true } },
        payments: { select: { kind: true, amountMinor: true, voidedAt: true } },
      },
    }),
    db.appointment.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
  ]);

  const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<
    Record<Status, number>
  >;
  const total = status ? (countBy[status] ?? 0) : counts.reduce((s, c) => s + c._count._all, 0);
  const showPayments = can(ctx.role, 'revenue.read') || can(ctx.role, 'payments.record.own');

  return (
    <AppointmentsView
      rows={rows.slice(0, limit).map((r) => ({
        id: r.id,
        ref: `A-${r.refNumber}`,
        customer: r.contactName,
        service: r.serviceNameSnapshot,
        staff: r.staff.displayName,
        startAt: r.startAt.toISOString(),
        durationMin: r.durationMin,
        priceMinor: r.quotedPriceMinor,
        currency: r.currency,
        status: r.status,
        source: r.source,
        collectedMinor: netCollectedMinor(r.payments),
      }))}
      total={total}
      hasMore={rows.length > limit}
      counts={countBy}
      filters={{ scope, status, q, staffId, limit }}
      staff={staff.map((s) => ({ id: s.id, name: s.displayName }))}
      showPayments={showPayments}
    />
  );
}
