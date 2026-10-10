import type { Metadata } from 'next';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { daysAgo, now } from '@/lib/time';
import { ServicesView } from '@/components/features/services/ServicesView';

export const metadata: Metadata = { title: 'Services' };

export default async function ServicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await params;
  const sp = await searchParams;
  const ctx = await requireTenantPage(tenant, 'services.manage');
  const db = getDb();
  const since = daysAgo(30);
  const current = now();
  const [services, staff, counts, upcoming] = await Promise.all([
    db.service.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { staff: { select: { staffId: true } } },
    }),
    db.staff.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      select: { id: true, displayName: true },
    }),
    db.appointment.groupBy({
      by: ['serviceId'],
      where: {
        tenantId: ctx.tenantId,
        status: { not: 'CANCELLED' },
        startAt: { gte: since, lte: current },
      },
      _count: { _all: true },
    }),
    db.appointment.groupBy({
      by: ['serviceId'],
      where: {
        tenantId: ctx.tenantId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startAt: { gt: current },
      },
      _count: { _all: true },
    }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.serviceId, x._count._all]));
  const u = Object.fromEntries(upcoming.map((x) => [x.serviceId, x._count._all]));
  return (
    <ServicesView
      openNew={sp.new === '1'}
      currency={ctx.currency}
      staff={staff.map((s) => ({ id: s.id, name: s.displayName }))}
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? '',
        durationMin: s.durationMin,
        priceMinor: s.priceMinor,
        bufferBeforeMin: s.bufferBeforeMin,
        bufferAfterMin: s.bufferAfterMin,
        availableOn: s.availableOn,
        maxAdvanceDays: s.maxAdvanceDays,
        isActive: s.isActive,
        isOnline: s.isOnline,
        staffIds: s.staff.map((x) => x.staffId),
        booked30: c[s.id] ?? 0,
        upcoming: u[s.id] ?? 0,
      }))}
    />
  );
}
