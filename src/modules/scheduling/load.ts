import 'server-only';
import type { Tx } from '@/lib/db/tx';
import type { getDb } from '@/lib/db/client';
import { OCCUPYING_STATUSES } from '@/modules/bookings/rules';
import type { ExceptionInput, ScheduleData, WeeklyRuleInput } from './availability';
import { addDays, localMinutesToInstant } from './time';

type Reader = Tx | ReturnType<typeof getDb>;

/** @db.Date columns round-trip as UTC-midnight Dates. */
export function localDateToDb(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
export function dbDateToLocal(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Load everything the availability engine needs for [fromDate, toDate] (local
 * dates, inclusive), scoped to ONE tenant. Busy blocks include a one-day margin
 * on each side so buffers crossing midnight are seen.
 */
export async function loadScheduleData(
  db: Reader,
  params: { tenantId: string; tz: string; fromDate: string; toDate: string; staffIds?: string[] },
): Promise<ScheduleData> {
  const { tenantId, tz, fromDate, toDate, staffIds } = params;
  const staffFilter = staffIds ? { OR: [{ staffId: null }, { staffId: { in: staffIds } }] } : {};

  const [rules, exceptions, busy] = await Promise.all([
    db.availabilityRule.findMany({
      where: { tenantId, ...staffFilter },
      select: { staffId: true, dayOfWeek: true, startMin: true, endMin: true },
    }),
    db.availabilityException.findMany({
      where: {
        tenantId,
        date: { lte: localDateToDb(toDate) },
        AND: [
          staffFilter,
          {
            OR: [
              { endDate: null, date: { gte: localDateToDb(fromDate) } },
              { endDate: { gte: localDateToDb(fromDate) } },
            ],
          },
        ],
      },
      select: {
        staffId: true,
        type: true,
        date: true,
        endDate: true,
        startMin: true,
        endMin: true,
        reason: true,
      },
    }),
    db.appointment.findMany({
      where: {
        tenantId,
        ...(staffIds ? { staffId: { in: staffIds } } : {}),
        status: { in: [...OCCUPYING_STATUSES] },
        blockStartAt: { lt: new Date(localMinutesToInstant(addDays(toDate, 1), 1440, tz)) },
        blockEndAt: { gt: new Date(localMinutesToInstant(addDays(fromDate, -1), 0, tz)) },
      },
      select: { id: true, staffId: true, blockStartAt: true, blockEndAt: true },
    }),
  ]);

  return {
    tz,
    rules: rules as WeeklyRuleInput[],
    exceptions: exceptions.map((e): ExceptionInput => ({
      staffId: e.staffId,
      type: e.type,
      date: dbDateToLocal(e.date),
      endDate: e.endDate ? dbDateToLocal(e.endDate) : null,
      startMin: e.startMin,
      endMin: e.endMin,
      reason: e.reason,
    })),
    busy: busy.map((b) => ({
      id: b.id,
      staffId: b.staffId,
      blockStart: b.blockStartAt.getTime(),
      blockEnd: b.blockEndAt.getTime(),
    })),
  };
}
