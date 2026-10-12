import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { can } from '@/lib/auth/permissions';
import { AppShell, type ShellData } from '@/components/layout/AppShell';
import { todayIn } from '@/modules/scheduling/time';
import { StoreClosed } from '@/components/features/billing/StoreClosed';
import { PayInstructions } from '@/components/features/billing/PayInstructions';
import { getPlatformSettings } from '@/modules/platform/settings';
import { readTourProgress, tourFor } from '@/modules/tour/steps';
import { accessState } from '@/modules/billing/access';
import { getI18n } from '@/i18n/server';

function initials(name: string): string {
  return (
    name
      .replace(/^Dr\.\s+/, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  );
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const ctx = await requireTenantPage(slug);
  const { t, intl } = await getI18n();
  const access = accessState(ctx);
  const closed = access.phase === 'closed';
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat(intl, { dateStyle: 'long', timeZone: ctx.timezone }).format(d);
  const [platform, me] = await Promise.all([
    getPlatformSettings(),
    getDb().user.findUnique({ where: { id: ctx.userId }, select: { tourProgress: true } }),
  ]);
  const tourId = tourFor(ctx.role);
  const tourState = readTourProgress(me?.tourProgress)[tourId] ?? { step: 0, done: false };
  const supportEmail = platform.supportEmail;
  const db = getDb();

  const [memberships, profile, services, staff] = await Promise.all([
    db.membership.findMany({
      where: {
        userId: ctx.userId,
        status: 'ACTIVE',
        tenant: { status: { in: ['TRIAL', 'ACTIVE'] } },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        tenant: { select: { slug: true, name: true, profile: { select: { pageStatus: true } } } },
      },
    }),
    db.businessProfile.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { pageStatus: true },
    }),
    can(ctx.role, 'appointments.create')
      ? db.service.findMany({
          where: { tenantId: ctx.tenantId, deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            durationMin: true,
            priceMinor: true,
            currency: true,
            isActive: true,
          },
        })
      : Promise.resolve([]),
    can(ctx.role, 'appointments.create')
      ? db.staff.findMany({
          where: { tenantId: ctx.tenantId, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
          select: { id: true, displayName: true, services: { select: { serviceId: true } } },
        })
      : Promise.resolve([]),
  ]);

  const base = `/app/${ctx.tenantSlug}`;
  const navAll: { key: keyof typeof t.app.nav; perm: Parameters<typeof can>[1] }[] = [
    { key: 'overview', perm: 'dashboard.view' },
    { key: 'calendar', perm: 'appointments.read' },
    { key: 'appointments', perm: 'appointments.read' },
    { key: 'services', perm: 'services.manage' },
    { key: 'staff', perm: 'staff.manage' },
    { key: 'customers', perm: 'customers.read' },
    { key: 'analytics', perm: 'analytics.read' },
    { key: 'booking-page', perm: 'bookingPage.manage' },
    { key: 'availability', perm: 'availability.manage' },
    { key: 'settings', perm: 'business.manage' },
    { key: 'billing', perm: 'billing.view' },
  ];

  const pageSub = (status: string | undefined, s: string) =>
    status === 'PUBLISHED'
      ? `/book/${s}`
      : status === 'UNPUBLISHED'
        ? t.app.pageUnpublished
        : t.app.pageDraft;

  // STAFF may only book into their own column.
  const staffForBooking = ctx.role === 'STAFF' ? staff.filter((s) => s.id === ctx.staffId) : staff;

  const data: ShellData = {
    tenant: {
      slug: ctx.tenantSlug,
      name: ctx.tenantName,
      timezone: ctx.timezone,
      currency: ctx.currency,
      country: ctx.country,
      pageStatus: profile?.pageStatus ?? 'DRAFT',
      today: todayIn(ctx.timezone),
    },
    memberships: memberships.map((m) => ({
      slug: m.tenant.slug,
      name: m.tenant.name,
      sub: pageSub(m.tenant.profile?.pageStatus, m.tenant.slug),
    })),
    user: {
      name: ctx.user.name,
      initials: initials(ctx.user.name),
      roleLabel: t.app.roles[ctx.role],
      isPlatformAdmin: ctx.user.platformRole === 'ADMIN',
    },
    nav: navAll
      .filter((n) => can(ctx.role, n.perm))
      .map((n) => ({ key: n.key, label: t.app.nav[n.key], href: `${base}/${n.key}` })),
    booking:
      !closed &&
      can(ctx.role, 'appointments.create') &&
      services.length > 0 &&
      staffForBooking.length > 0
        ? {
            services,
            staff: staffForBooking.map((s) => ({
              id: s.id,
              name: s.displayName,
              serviceIds: s.services.map((x) => x.serviceId),
            })),
            defaultStaffId: ctx.staffId ?? staffForBooking[0]?.id ?? null,
          }
        : null,
    billing: {
      phase: access.phase,
      daysLeft: access.daysLeft,
      accessUntil: fmtDate(access.accessUntil),
      supportEmail,
      billingHref: can(ctx.role, 'billing.view') ? `${base}/billing` : null,
    },
    support: ctx.support ? { business: ctx.tenantName } : null,
    // No tour on the closed screen (resumes once reopened) or in support mode.
    tour: {
      id: tourId,
      role: ctx.role,
      step: tourState.step,
      done: closed || ctx.support || tourState.done,
    },
  };

  return (
    <AppShell data={data}>
      {closed ? (
        <StoreClosed
          t={t.app.billing}
          closedOn={fmtDate(access.accessUntil)}
          deleteOn={fmtDate(access.deleteOn)}
          daysUntilDeletion={access.daysUntilDeletion}
          supportEmail={supportEmail}
          pay={
            can(ctx.role, 'billing.view') ? (
              <PayInstructions
                t={t.app.billingPage}
                settings={platform}
                slug={ctx.tenantSlug}
                business={ctx.tenantName}
              />
            ) : null
          }
        />
      ) : (
        children
      )}
    </AppShell>
  );
}
