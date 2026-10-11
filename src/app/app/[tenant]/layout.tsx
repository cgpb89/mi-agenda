import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { can } from '@/lib/auth/permissions';
import { AppShell, type ShellData } from '@/components/layout/AppShell';
import { todayIn } from '@/modules/scheduling/time';
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
  const { t } = await getI18n();
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
          where: { tenantId: ctx.tenantId },
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
      can(ctx.role, 'appointments.create') && services.length > 0 && staffForBooking.length > 0
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
  };

  return <AppShell data={data}>{children}</AppShell>;
}
