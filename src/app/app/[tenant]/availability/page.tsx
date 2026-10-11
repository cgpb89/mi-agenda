import type { Metadata } from 'next';
import { getDb } from '@/lib/db/client';
import { requireTenantPage } from '@/lib/auth/authorize';
import { dbDateToLocal, localDateToDb } from '@/modules/scheduling/load';
import { addDays, localMinutesToInstant, todayIn } from '@/modules/scheduling/time';
import { AvailabilityView } from '@/components/features/availability/AvailabilityView';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.app.titles.availability };
}

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const ctx = await requireTenantPage(tenant, 'availability.manage');
  const db = getDb();
  const today = todayIn(ctx.timezone);
  const [staff, rules, exceptions, policy, service, busy] = await Promise.all([
    db.staff.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      select: { id: true, displayName: true },
    }),
    db.availabilityRule.findMany({
      where: { tenantId: ctx.tenantId },
      select: { staffId: true, dayOfWeek: true, startMin: true, endMin: true },
    }),
    db.availabilityException.findMany({
      where: {
        tenantId: ctx.tenantId,
        OR: [{ date: { gte: localDateToDb(today) } }, { endDate: { gte: localDateToDb(today) } }],
      },
      orderBy: { date: 'asc' },
    }),
    db.bookingPolicy.findUniqueOrThrow({ where: { tenantId: ctx.tenantId } }),
    db.service.findFirst({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        name: true,
        durationMin: true,
        bufferBeforeMin: true,
        bufferAfterMin: true,
        availableOn: true,
        maxAdvanceDays: true,
      },
    }),
    db.appointment.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED'] },
        blockEndAt: { gt: new Date(localMinutesToInstant(today, 0, ctx.timezone)) },
        blockStartAt: { lt: new Date(localMinutesToInstant(addDays(today, 8), 0, ctx.timezone)) },
      },
      select: { id: true, staffId: true, blockStartAt: true, blockEndAt: true },
    }),
  ]);

  return (
    <AvailabilityView
      today={today}
      timezone={ctx.timezone}
      staff={staff.map((s) => ({ id: s.id, name: s.displayName }))}
      rules={rules}
      exceptions={exceptions.map((e) => ({
        id: e.id,
        staffId: e.staffId,
        type: e.type,
        date: dbDateToLocal(e.date),
        endDate: e.endDate ? dbDateToLocal(e.endDate) : null,
        startMin: e.startMin,
        endMin: e.endMin,
        reason: e.reason,
      }))}
      policy={{
        slotIntervalMin: policy.slotIntervalMin,
        minNoticeMin: policy.minNoticeMin,
        maxAdvanceDays: policy.maxAdvanceDays,
      }}
      previewService={service}
      busy={busy.map((b) => ({
        id: b.id,
        staffId: b.staffId,
        blockStart: b.blockStartAt.getTime(),
        blockEnd: b.blockEndAt.getTime(),
      }))}
    />
  );
}
