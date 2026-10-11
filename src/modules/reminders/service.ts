import 'server-only';
import { DateTime } from 'luxon';
import { getDb } from '@/lib/db/client';
import { getEnv, isEmailConfigured } from '@/lib/env';
import { sendMail } from '@/lib/mail';
import { logger } from '@/lib/observability/logger';
import { generateToken } from '@/lib/security/tokens';
import { manageTokenHash } from '@/modules/bookings/engine';
import { getPlanCatalog } from '@/modules/plans/service';
import { DEFAULT_LOCALE, INTL_LOCALE, toLocale } from '@/i18n/config';
import { i18nFor } from '@/i18n/server';
import { reminderWindow } from './window';

/** Upper bound per run; the next hourly run picks up anything left. */
const BATCH = 200;

/**
 * Email customers 24 h before their appointment (plan feature `emailReminders`).
 * Appointments are claimed atomically (reminder_sent_at) before sending, so a
 * retried or overlapping run never reminds twice. Each reminder carries a fresh
 * manage link (the token is rotated; the old link stops working).
 */
export async function sendDueReminders(now: Date = new Date()): Promise<number> {
  // In production without SMTP nothing would be delivered: don't claim.
  if (!isEmailConfigured() && getEnv().NODE_ENV === 'production') return 0;
  const plans = (await getPlanCatalog())
    .filter((p) => p.features.includes('emailReminders'))
    .map((p) => p.plan);
  if (!plans.length) return 0;

  const db = getDb();
  const { from, to } = reminderWindow(now);
  const claimed = await db.$queryRaw<{ id: string }[]>`
    UPDATE "app"."appointments" SET "reminder_sent_at" = now()
    WHERE "id" IN (
      SELECT a."id" FROM "app"."appointments" a
      JOIN "app"."tenants" t ON t."id" = a."tenant_id"
      WHERE a."reminder_sent_at" IS NULL
        AND a."status" IN ('PENDING', 'CONFIRMED')
        AND a."contact_email" IS NOT NULL
        AND a."start_at" BETWEEN ${from} AND ${to}
        AND t."status" IN ('TRIAL', 'ACTIVE')
        AND t."access_until" > now()
        AND t."plan"::text = ANY(${plans}::text[])
      ORDER BY a."start_at"
      LIMIT ${BATCH}
      FOR UPDATE OF a SKIP LOCKED
    )
    RETURNING "id"`;
  if (!claimed.length) return 0;

  const appts = await db.appointment.findMany({
    where: { id: { in: claimed.map((c) => c.id) } },
    select: {
      id: true,
      startAt: true,
      contactEmail: true,
      serviceNameSnapshot: true,
      locale: true,
      staff: { select: { displayName: true } },
      tenant: {
        select: {
          slug: true,
          name: true,
          timezone: true,
          locale: true,
          profile: { select: { address: true } },
        },
      },
    },
  });

  let sent = 0;
  for (const a of appts) {
    try {
      if (!a.contactEmail) continue;
      const locale = toLocale(a.locale) ?? toLocale(a.tenant.locale) ?? DEFAULT_LOCALE;
      const e = i18nFor(locale).t.emails;
      const token = generateToken(32);
      await db.appointment.update({
        where: { id: a.id },
        data: { manageTokenHash: manageTokenHash(token) },
      });
      const when = DateTime.fromJSDate(a.startAt, { zone: a.tenant.timezone })
        .setLocale(INTL_LOCALE[locale])
        .toFormat(e.bookedWhenFormat);
      const res = await sendMail({
        to: a.contactEmail,
        subject: e.reminderSubject({ service: a.serviceNameSnapshot, business: a.tenant.name }),
        text: e.reminderBody({
          service: a.serviceNameSnapshot,
          staff: a.staff.displayName,
          when,
          timezone: a.tenant.timezone,
          address: a.tenant.profile?.address ?? '',
          link: `${getEnv().APP_URL}/book/${a.tenant.slug}/manage/${token}`,
        }),
      });
      if (res.sent) sent++;
    } catch (err) {
      logger.error('reminders: send failed', {
        appointmentId: a.id,
        error: err instanceof Error ? err : String(err),
      });
    }
  }
  return sent;
}
