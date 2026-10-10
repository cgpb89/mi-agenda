import type { Metadata } from 'next';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { can } from '@/lib/auth/permissions';
import { loadOverview, resolveRange } from '@/modules/analytics/service';
import { OverviewView } from '@/components/features/overview/OverviewView';

export const metadata: Metadata = { title: 'Overview' };

export default async function OverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await params;
  const sp = await searchParams;
  const ctx = await requireTenantPage(tenant);
  const range = resolveRange(sp.range, ctx.timezone, new Date(), sp.from, sp.to);
  const db = getDb();
  const [data, serviceCount, ruleCount, profile] = await Promise.all([
    loadOverview(ctx, range),
    db.service.count({ where: { tenantId: ctx.tenantId, isActive: true } }),
    db.availabilityRule.count({ where: { tenantId: ctx.tenantId } }),
    db.businessProfile.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { pageStatus: true },
    }),
  ]);
  return (
    <OverviewView
      data={data}
      canRevenue={can(ctx.role, 'revenue.read')}
      setupNeeded={{
        services: serviceCount === 0,
        hours: ruleCount === 0,
        published: profile?.pageStatus === 'PUBLISHED',
      }}
    />
  );
}
