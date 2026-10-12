import 'server-only';
import { DateTime } from 'luxon';
import { getDb } from '@/lib/db/client';
import { getEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { canSendNotifications, sendMail } from '@/lib/mail';
import { logger } from '@/lib/observability/logger';
import { isClosed } from '@/modules/billing/access';
import { hasFeature } from '@/modules/plans/features';
import { entitlementsFor } from '@/modules/plans/service';
import { daySlots } from '@/modules/scheduling/availability';
import { loadScheduleData, localDateToDb } from '@/modules/scheduling/load';
import { addDays, todayIn } from '@/modules/scheduling/time';
import { DEFAULT_LOCALE, INTL_LOCALE, toLocale } from '@/i18n/config';
import { msg } from '@/i18n/message-ref';
import { i18nFor } from '@/i18n/server';
import { MAX_ENTRIES_PER_DATE, canNotify } from './rules';

/** Bookable, published business whose plan includes the waitlist. */
async function waitlistTenant(tenantId: string) {
  const t = await getDb().tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      timezone: true,
      status: true,
      accessUntil: true,
      plan: true,
      profile: { select: { pageStatus: true } },
      policy: true,
    },
  });
  if (!t || !t.policy || t.profile?.pageStatus !== 'PUBLISHED') return null;
  if ((t.status !== 'ACTIVE' && t.status !== 'TRIAL') || isClosed(t.accessUntil)) return null;
  if (!hasFeature(await entitlementsFor(t.plan), 'waitlist')) return null;
  return { ...t, policy: t.policy };
}

/** Add someone to the waitlist for a service and day (idempotent per email). */
export async function joinWaitlist(input: {
  tenantId: string;
  serviceId: string;
  staffId: string | null;
  date: string;
  name: string;
  email: string;
  locale: string;
}): Promise<void> {
  const db = getDb();
  const t = await waitlistTenant(input.tenantId);
  if (!t) throw new AppError('NOT_FOUND', msg('notFound'));
  const today = todayIn(t.timezone);
  if (input.date < today || input.date > addDays(today, t.policy.maxAdvanceDays)) {
    throw new AppError('VALIDATION', msg('chooseValidDateTime'));
  }
  const service = await db.service.findFirst({
    where: { id: input.serviceId, tenantId: t.id, isActive: true, isOnline: true },
    select: { id: true },
  });
  if (!service) throw new AppError('NOT_FOUND', msg('notFound'));
  if (input.staffId) {
    const staff = await db.staff.findFirst({
      where: { id: input.staffId, tenantId: t.id, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!staff) throw new AppError('NOT_FOUND', msg('notFound'));
  }
  const date = localDateToDb(input.date);
  const count = await db.waitlistEntry.count({ where: { tenantId: t.id, date } });
  if (count >= MAX_ENTRIES_PER_DATE) throw new AppError('POLICY', msg('waitlistFull'));
  const email = input.email.trim().toLowerCase();
  await db.waitlistEntry.upsert({
    where: {
      tenantId_serviceId_date_email: { tenantId: t.id, serviceId: service.id, date, email },
    },
    create: {
      tenantId: t.id,
      serviceId: service.id,
      staffId: input.staffId,
      date,
      name: input.name,
      email,
      locale: input.locale,
    },
    // Joining again re-arms the entry (e.g. after booking fell through).
    update: { name: input.name, staffId: input.staffId, fulfilledAt: null },
  });
}

/**
 * A slot may have freed up on `date` (cancellation, reschedule, expired
 * deposit): email everyone waiting whose service (and staff preference) now
 * has an open time. Best effort: never throws.
 */
export async function notifyWaitlist(tenantId: string, date: string): Promise<number> {
  // Paused: leave entries untouched so they're notified once email is on.
  if (!canSendNotifications()) return 0;
  try {
    const db = getDb();
    const t = await waitlistTenant(tenantId);
    if (!t || date < todayIn(t.timezone)) return 0;
    const now = new Date();
    const entries = (
      await db.waitlistEntry.findMany({
        where: { tenantId, date: localDateToDb(date), fulfilledAt: null },
        include: { service: true },
      })
    ).filter((e) => canNotify(e, now) && e.service.isActive && e.service.isOnline);
    if (!entries.length) return 0;

    const staff = await db.staff.findMany({
      where: { tenantId, isActive: true, deletedAt: null },
      select: { id: true, services: { select: { serviceId: true } } },
    });
    const schedule = await loadScheduleData(db, {
      tenantId,
      tz: t.timezone,
      fromDate: date,
      toDate: date,
      staffIds: staff.map((s) => s.id),
    });

    let sent = 0;
    for (const e of entries) {
      const staffIds = staff
        .filter((s) => s.services.some((x) => x.serviceId === e.serviceId))
        .filter((s) => !e.staffId || s.id === e.staffId)
        .map((s) => s.id);
      if (!staffIds.length) continue;
      const open = daySlots(schedule, {
        date,
        staffIds,
        service: e.service,
        policy: t.policy,
        nowMs: now.getTime(),
        mode: 'public',
      }).slots.some((s) => s.available);
      if (!open) continue;

      // Claim before sending so overlapping calls don't email twice.
      const claimed = await db.waitlistEntry.updateMany({
        where: { id: e.id, notifiedAt: e.notifiedAt, fulfilledAt: null },
        data: { notifiedAt: now },
      });
      if (claimed.count === 0) continue;
      const locale = toLocale(e.locale) ?? DEFAULT_LOCALE;
      const m = i18nFor(locale).t.emails;
      const day = DateTime.fromISO(date, { zone: t.timezone })
        .setLocale(INTL_LOCALE[locale])
        .toFormat(m.waitlistDayFormat);
      const link =
        `${getEnv().APP_URL}/book/${t.slug}?service=${e.serviceId}&date=${date}` +
        (e.staffId ? `&staff=${e.staffId}` : '');
      const res = await sendMail({
        to: e.email,
        subject: m.waitlistSubject({ business: t.name }),
        text: m.waitlistBody({ name: e.name, service: e.service.name, day, link }),
      });
      if (res.sent) sent++;
    }
    return sent;
  } catch (err) {
    logger.error('waitlist: notify failed', {
      tenantId,
      date,
      error: err instanceof Error ? err : String(err),
    });
    return 0;
  }
}

/** The customer booked: stop notifying their matching waitlist entries. */
export async function markWaitlistFulfilled(input: {
  tenantId: string;
  serviceId: string;
  date: string;
  email: string | null | undefined;
}): Promise<void> {
  if (!input.email) return;
  try {
    await getDb().waitlistEntry.updateMany({
      where: {
        tenantId: input.tenantId,
        serviceId: input.serviceId,
        date: localDateToDb(input.date),
        email: input.email.trim().toLowerCase(),
        fulfilledAt: null,
      },
      data: { fulfilledAt: new Date() },
    });
  } catch (err) {
    logger.error('waitlist: mark fulfilled failed', {
      tenantId: input.tenantId,
      error: err instanceof Error ? err : String(err),
    });
  }
}

/** Daily cleanup: entries for days that have passed (2-day margin for time zones). */
export async function deletePastWaitlistEntries(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2));
  const res = await getDb().waitlistEntry.deleteMany({ where: { date: { lt: cutoff } } });
  return res.count;
}

/** A slot starting at `startAt` was freed: notify the waitlist for that local day. */
export async function notifyWaitlistFor(tenantId: string, startAt: Date): Promise<void> {
  const t = await getDb().tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true },
  });
  if (!t) return;
  await notifyWaitlist(tenantId, DateTime.fromJSDate(startAt, { zone: t.timezone }).toISODate()!);
}
