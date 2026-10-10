import type { Metadata } from 'next';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { formatPhone } from '@/lib/phone';
import { CustomersView } from '@/components/features/customers/CustomersView';

export const metadata: Metadata = { title: 'Customers' };

const PAGE = 50;

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await params;
  const sp = await searchParams;
  const ctx = await requireTenantPage(tenant, 'customers.read');
  const db = getDb();
  const q = (sp.q ?? '').trim().slice(0, 80);
  const digits = q.replace(/\D/g, '');
  const limit = Math.min(1000, Math.max(PAGE, Number(sp.limit) || PAGE));
  const where = {
    tenantId: ctx.tenantId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            ...(digits.length >= 3 ? [{ phoneE164: { contains: digits } }] : []),
          ],
        }
      : {}),
  };
  const [customers, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      take: limit,
      select: { id: true, name: true, phoneE164: true, email: true },
    }),
    db.customer.count({ where }),
  ]);
  const ids = customers.map((c) => c.id);
  const now = new Date();
  const [stats, last, next] = await Promise.all([
    db.appointment.groupBy({
      by: ['customerId'],
      where: { tenantId: ctx.tenantId, customerId: { in: ids }, status: 'COMPLETED' },
      _count: { _all: true },
      _sum: { quotedPriceMinor: true },
    }),
    db.appointment.groupBy({
      by: ['customerId'],
      where: {
        tenantId: ctx.tenantId,
        customerId: { in: ids },
        status: { in: ['COMPLETED', 'NO_SHOW'] },
      },
      _max: { startAt: true },
    }),
    db.appointment.groupBy({
      by: ['customerId'],
      where: {
        tenantId: ctx.tenantId,
        customerId: { in: ids },
        status: { in: ['PENDING', 'CONFIRMED'] },
        startAt: { gt: now },
      },
      _min: { startAt: true },
    }),
  ]);
  return (
    <CustomersView
      q={q}
      total={total}
      limit={limit}
      rows={customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: formatPhone(c.phoneE164),
        email: c.email ?? '',
        completed: stats.find((s) => s.customerId === c.id)?._count._all ?? 0,
        valueMinor: stats.find((s) => s.customerId === c.id)?._sum.quotedPriceMinor ?? 0,
        lastVisit: last.find((s) => s.customerId === c.id)?._max.startAt?.toISOString() ?? null,
        nextVisit: next.find((s) => s.customerId === c.id)?._min.startAt?.toISOString() ?? null,
      }))}
    />
  );
}
