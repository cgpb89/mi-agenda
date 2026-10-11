import 'server-only';
import { getDb } from '@/lib/db/client';
import { getPlanCatalog } from '@/modules/plans/service';
import { DEFAULT_FLAGS, type PlanKey } from './constants';

/**
 * Platform-level reads. Deliberately limited to ACCOUNT data and COUNTS:
 * no customer names, contacts, notes or appointment details are selected.
 */
export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  plan: PlanKey;
  /** Staff limit of the current plan (null = unlimited). */
  staffLimit: number | null;
  createdAt: string;
  /** End of the trial / paid period (ISO). */
  accessUntil: string;
  owner: string;
  pageStatus: string;
  template: string;
  appts30: number;
  staff: number;
  lastActivity: string | null;
}

export async function listTenants(): Promise<TenantRow[]> {
  const db = getDb();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const [catalog, tenants, appts, last, staff] = await Promise.all([
    getPlanCatalog(),
    db.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        category: true,
        status: true,
        plan: true,
        createdAt: true,
        accessUntil: true,
        profile: { select: { pageStatus: true, template: true } },
        memberships: {
          where: { role: 'OWNER' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { user: { select: { name: true } } },
        },
      },
    }),
    db.appointment.groupBy({
      by: ['tenantId'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.auditLog.groupBy({
      by: ['tenantId'],
      where: { tenantId: { not: null } },
      _max: { createdAt: true },
    }),
    db.staff.groupBy({ by: ['tenantId'], where: { isActive: true }, _count: { _all: true } }),
  ]);
  const a = new Map(appts.map((x) => [x.tenantId, x._count._all]));
  const l = new Map(last.map((x) => [x.tenantId, x._max.createdAt]));
  const s = new Map(staff.map((x) => [x.tenantId, x._count._all]));
  return tenants
    .map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      category: t.category,
      status: t.status,
      plan: t.plan,
      staffLimit: catalog.find((c) => c.plan === t.plan)?.staffLimit ?? null,
      createdAt: t.createdAt.toISOString(),
      accessUntil: t.accessUntil.toISOString(),
      owner: t.memberships[0]?.user.name ?? '—',
      pageStatus: t.profile?.pageStatus ?? 'DRAFT',
      template: t.profile?.template ?? 'SERVICES',
      appts30: a.get(t.id) ?? 0,
      staff: s.get(t.id) ?? 0,
      lastActivity: l.get(t.id)?.toISOString() ?? null,
    }))
    .sort((x, y) => y.appts30 - x.appts30);
}

/** Daily appointment counts across all tenants (count only). */
export async function platformAppointmentSeries(from: Date): Promise<{ day: string; n: number }[]> {
  const rows = await getDb().$queryRaw<{ day: Date; n: bigint }[]>`
    SELECT date_trunc('day', created_at) AS day, count(*)::bigint AS n
    FROM app.appointments
    WHERE created_at >= ${from}
    GROUP BY 1 ORDER BY 1`;
  return rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), n: Number(r.n) }));
}

export async function listPlatformUsers() {
  const rows = await getDb().membership.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      role: true,
      status: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          platformRole: true,
        },
      },
      tenant: { select: { name: true } },
    },
  });
  return rows.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    business: m.tenant.name,
    role: m.role,
    status: m.user.status,
    isAdmin: m.user.platformRole === 'ADMIN',
    registered: m.user.createdAt.toISOString(),
    lastActive: m.user.lastLoginAt?.toISOString() ?? null,
  }));
}

const PLATFORM_ACTIONS = [
  'tenant.suspended',
  'tenant.reactivated',
  'tenant.plan_changed',
  'tenant.created',
  'user.suspended',
  'user.reactivated',
  'feature_flag.toggled',
  'plan.updated',
  'tenant.payment_recorded',
  'tenant.deleted',
  'platform.admin_granted',
  'membership.role_changed',
];

export async function platformAuditLog(limit = 100) {
  const rows = await getDb().auditLog.findMany({
    where: { action: { in: PLATFORM_ACTIONS } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      createdAt: true,
      metadata: true,
      actorType: true,
      actor: { select: { name: true } },
      tenant: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt.toISOString(),
    /** null = the system acted (label translated by the UI). */
    who: r.actor?.name ?? (r.actorType === 'system' ? null : '—'),
    action: r.action,
    business: r.tenant?.name ?? null,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
  }));
}

export async function listFlags() {
  const db = getDb();
  const existing = await db.featureFlag.findMany({ orderBy: { key: 'asc' } });
  if (existing.length === 0) {
    await db.featureFlag.createMany({ data: DEFAULT_FLAGS, skipDuplicates: true });
    return db.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }
  return existing;
}
