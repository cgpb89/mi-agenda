import type { Metadata } from 'next';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { can } from '@/lib/auth/permissions';
import { SettingsView } from '@/components/features/settings/SettingsView';
import { getI18n } from '@/i18n/server';
import type { DepositMode } from '@/modules/deposits/rules';
import { cheapestPlanWith, hasFeature } from '@/modules/plans/features';
import { entitlementsFor, getPlanCatalog } from '@/modules/plans/service';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.app.nav.settings };
}

export default async function SettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const { t: tr } = await getI18n();
  const ctx = await requireTenantPage(tenant, 'business.manage');
  const db = getDb();
  const [plan, catalog] = await Promise.all([entitlementsFor(ctx.plan), getPlanCatalog()]);
  const [t, policy, members, invites, events] = await Promise.all([
    db.tenant.findUniqueOrThrow({
      where: { id: ctx.tenantId },
      select: {
        name: true,
        country: true,
        category: true,
        currency: true,
        timezone: true,
        plan: true,
        slug: true,
      },
    }),
    db.bookingPolicy.findUniqueOrThrow({ where: { tenantId: ctx.tenantId } }),
    db.membership.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        role: true,
        status: true,
        userId: true,
        user: { select: { name: true, email: true } },
      },
    }),
    db.invitation.findMany({
      where: {
        tenantId: ctx.tenantId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
    can(ctx.role, 'audit.read')
      ? db.auditLog.findMany({
          where: { tenantId: ctx.tenantId },
          orderBy: { createdAt: 'desc' },
          take: 30,
          select: {
            id: true,
            action: true,
            actorType: true,
            createdAt: true,
            targetType: true,
            actor: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);
  return (
    <SettingsView
      business={t}
      policy={{
        maxActiveAppointmentsPerPhone: policy.maxActiveAppointmentsPerPhone,
        cancellationWindowMin: policy.cancellationWindowMin,
        requireEmail: policy.requireEmail,
        autoConfirm: policy.autoConfirm,
        policyText: policy.policyText ?? '',
        updatedAt: policy.updatedAt.toISOString(),
        depositMode: policy.depositMode as DepositMode,
        // FIXED is shown in major units, PERCENT as-is.
        depositValue:
          policy.depositMode === 'FIXED'
            ? String(policy.depositValue / 100)
            : String(policy.depositValue || ''),
        sinpePhone: policy.sinpePhone ?? '',
        sinpeName: policy.sinpeName ?? '',
      }}
      depositsLockedPlan={
        hasFeature(plan, 'sinpeDeposits') ? undefined : cheapestPlanWith(catalog, 'sinpeDeposits')
      }
      canPolicy={can(ctx.role, 'policy.manage')}
      canRoles={can(ctx.role, 'team.roles')}
      canInvite={can(ctx.role, 'team.invite')}
      currentUserId={ctx.userId}
      members={members.map((m) => ({
        id: m.id,
        role: m.role,
        status: m.status,
        name: m.user.name,
        email: m.user.email,
        self: m.userId === ctx.userId,
      }))}
      invites={invites.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() }))}
      events={events.map((e) => ({
        id: e.id,
        action: e.action,
        actor:
          e.actor?.name ??
          (e.actorType === 'customer' ? tr.settings.actorCustomer : tr.settings.actorSystem),
        at: e.createdAt.toISOString(),
        target: e.targetType ?? '',
      }))}
    />
  );
}
