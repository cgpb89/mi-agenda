import type { Metadata } from 'next';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { daysAgo, now } from '@/lib/time';
import { StaffView } from '@/components/features/staff/StaffView';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.app.nav.staff };
}

export default async function StaffPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const ctx = await requireTenantPage(tenant, 'staff.manage');
  const db = getDb();
  const since = daysAgo(30);
  const [staff, services, memberships, counts, upcoming] = await Promise.all([
    db.staff.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { displayName: 'asc' }],
      include: { services: { select: { serviceId: true } }, user: { select: { email: true } } },
    }),
    db.service.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.membership.findMany({
      where: { tenantId: ctx.tenantId },
      select: { userId: true, role: true },
    }),
    db.appointment.groupBy({
      by: ['staffId'],
      where: { tenantId: ctx.tenantId, status: 'COMPLETED', startAt: { gte: since } },
      _count: { _all: true },
      _sum: { quotedPriceMinor: true },
    }),
    db.appointment.groupBy({
      by: ['staffId'],
      where: {
        tenantId: ctx.tenantId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startAt: { gt: now() },
      },
      _count: { _all: true },
    }),
  ]);
  const role = Object.fromEntries(memberships.map((m) => [m.userId, m.role]));
  return (
    <StaffView
      currency={ctx.currency}
      services={services}
      staff={staff.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        title: s.title ?? '',
        bio: s.bio ?? '',
        isActive: s.isActive,
        serviceIds: s.services.map((x) => x.serviceId),
        login: s.userId ? { email: s.user?.email ?? '', role: role[s.userId] ?? null } : null,
        completed30: counts.find((c) => c.staffId === s.id)?._count._all ?? 0,
        value30: counts.find((c) => c.staffId === s.id)?._sum.quotedPriceMinor ?? 0,
        upcoming: upcoming.find((c) => c.staffId === s.id)?._count._all ?? 0,
      }))}
    />
  );
}
