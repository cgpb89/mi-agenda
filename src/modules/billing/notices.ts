import 'server-only';
import { DateTime } from 'luxon';
import { getDb } from '@/lib/db/client';
import { getEnv } from '@/lib/env';
import { canSendNotifications, sendMail } from '@/lib/mail';
import { logger } from '@/lib/observability/logger';
import { DEFAULT_LOCALE, INTL_LOCALE, toLocale } from '@/i18n/config';
import { i18nFor } from '@/i18n/server';
import { NOTICE_DAYS, daysUntil, deletionDate, dueOwnerNotice, type OwnerNotice } from './access';

const CLAIM_COLUMN = {
  ending: 'notifiedEndingAt',
  closed: 'notifiedClosedAt',
  deletion: 'notifiedDeletionAt',
} as const satisfies Record<OwnerNotice, string>;

/**
 * Daily: email owners before access ends, when the store closes and before it
 * is deleted (review finding A1). Each notice is claimed in the database before
 * sending, so retries never send it twice. Best effort: failures are logged.
 */
export async function sendOwnerNotices(now: Date = new Date()): Promise<number> {
  // Notifications paused or no email: keep the notices unclaimed so they go
  // out once notifications are switched on.
  if (!canSendNotifications()) return 0;
  const db = getDb();
  const horizon = DateTime.fromJSDate(now)
    .plus({ days: NOTICE_DAYS + 1 })
    .toJSDate();
  const tenants = await db.tenant.findMany({
    // Suspended / churned stores are handled by platform admins, not warned.
    where: { status: { in: ['TRIAL', 'ACTIVE'] }, accessUntil: { lte: horizon } },
    select: {
      id: true,
      slug: true,
      name: true,
      locale: true,
      timezone: true,
      accessUntil: true,
      notifiedEndingAt: true,
      notifiedClosedAt: true,
      notifiedDeletionAt: true,
    },
    take: 200,
  });

  let sent = 0;
  for (const t of tenants) {
    const notice = dueOwnerNotice(t, now);
    if (!notice) continue;
    try {
      const column = CLAIM_COLUMN[notice];
      const claimed = await db.tenant.updateMany({
        where: { id: t.id, [column]: null },
        data: { [column]: now },
      });
      if (claimed.count === 0) continue;

      const owners = await db.membership.findMany({
        where: { tenantId: t.id, role: 'OWNER', status: 'ACTIVE', user: { status: 'ACTIVE' } },
        select: { user: { select: { email: true } } },
      });
      const locale = toLocale(t.locale) ?? DEFAULT_LOCALE;
      const e = i18nFor(locale).t.emails;
      const fmt = (d: Date) =>
        DateTime.fromJSDate(d, { zone: t.timezone })
          .setLocale(INTL_LOCALE[locale])
          .toFormat(e.ownerDateFormat);
      const link = `${getEnv().APP_URL}/app/${t.slug}/billing`;
      const deleteOn = fmt(deletionDate(t.accessUntil));
      const mail =
        notice === 'ending'
          ? {
              subject: e.ownerEndingSubject({
                business: t.name,
                n: Math.max(1, daysUntil(t.accessUntil, now)),
              }),
              text: e.ownerEndingBody({ business: t.name, date: fmt(t.accessUntil), link }),
            }
          : notice === 'closed'
            ? {
                subject: e.ownerClosedSubject({ business: t.name }),
                text: e.ownerClosedBody({ business: t.name, deleteOn, link }),
              }
            : {
                subject: e.ownerDeletionSubject({ business: t.name, deleteOn }),
                text: e.ownerDeletionBody({ business: t.name, deleteOn, link }),
              };
      for (const o of owners) {
        const res = await sendMail({ to: o.user.email, ...mail });
        if (res.sent) sent++;
      }
    } catch (err) {
      logger.error('billing: owner notice failed', {
        tenantId: t.id,
        notice,
        error: err instanceof Error ? err : String(err),
      });
    }
  }
  return sent;
}
