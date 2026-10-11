import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { can } from '@/lib/auth/permissions';
import { netCollectedMinor } from '@/modules/payments/ledger';
import { CustomerProfile } from '@/components/features/customers/CustomerProfile';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.app.titles.customer };
}

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ tenant: string; id: string }>;
}) {
  const { tenant, id } = await params;
  const ctx = await requireTenantPage(tenant, 'customers.read');
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  // Tenant-scoped lookup: an ID from another tenant is simply "not found".
  const customer = await db.customer.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!customer) notFound();
  const appts = await db.appointment.findMany({
    where: { tenantId: ctx.tenantId, customerId: customer.id },
    orderBy: { startAt: 'desc' },
    take: 200,
    select: {
      id: true,
      refNumber: true,
      startAt: true,
      status: true,
      serviceNameSnapshot: true,
      quotedPriceMinor: true,
      currency: true,
      staff: { select: { displayName: true } },
      payments: { select: { kind: true, amountMinor: true, voidedAt: true } },
    },
  });
  return (
    <CustomerProfile
      canEdit={can(ctx.role, 'customers.write')}
      customer={{
        id: customer.id,
        name: customer.name,
        phoneE164: customer.phoneE164 ?? '',
        email: customer.email ?? '',
        notes: customer.notes ?? '',
        createdAt: customer.createdAt.toISOString(),
      }}
      appointments={appts.map((a) => ({
        id: a.id,
        ref: `A-${a.refNumber}`,
        startAt: a.startAt.toISOString(),
        status: a.status,
        service: a.serviceNameSnapshot,
        staff: a.staff.displayName,
        priceMinor: a.quotedPriceMinor,
        currency: a.currency,
        collectedMinor: netCollectedMinor(a.payments),
      }))}
    />
  );
}
