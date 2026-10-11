import 'server-only';
import { DateTime } from 'luxon';
import { getDb } from '@/lib/db/client';
import { getEnv } from '@/lib/env';
import { formatPrice } from '@/i18n/format';
import { sendMail } from '@/lib/mail';
import { logger } from '@/lib/observability/logger';
import { generateToken } from '@/lib/security/tokens';
import { DEFAULT_LOCALE, INTL_LOCALE, toLocale } from '@/i18n/config';
import { i18nFor } from '@/i18n/server';
import { manageTokenHash } from './engine';

/*
 * Customer emails sent after a business acts on an appointment. Best effort:
 * called after the change is committed; failures are logged, never thrown.
 */

async function load(appointmentId: string) {
  return getDb().appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      startAt: true,
      contactEmail: true,
      serviceNameSnapshot: true,
      locale: true,
      depositMinor: true,
      currency: true,
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
}

function context(a: NonNullable<Awaited<ReturnType<typeof load>>>) {
  const locale = toLocale(a.locale) ?? toLocale(a.tenant.locale) ?? DEFAULT_LOCALE;
  const e = i18nFor(locale).t.emails;
  const when = DateTime.fromJSDate(a.startAt, { zone: a.tenant.timezone })
    .setLocale(INTL_LOCALE[locale])
    .toFormat(e.bookedWhenFormat);
  return { locale, e, when };
}

/** "Your appointment is confirmed", with a fresh manage link (token rotated). */
export async function sendConfirmedEmail(appointmentId: string): Promise<void> {
  try {
    const a = await load(appointmentId);
    if (!a?.contactEmail) return;
    const { locale, e, when } = context(a);
    const token = generateToken(32);
    await getDb().appointment.update({
      where: { id: a.id },
      data: { manageTokenHash: manageTokenHash(token) },
    });
    await sendMail({
      to: a.contactEmail,
      subject: e.confirmedSubject({ service: a.serviceNameSnapshot, business: a.tenant.name }),
      text: e.confirmedBody({
        service: a.serviceNameSnapshot,
        staff: a.staff.displayName,
        when,
        timezone: a.tenant.timezone,
        address: a.tenant.profile?.address ?? '',
        deposit: a.depositMinor ? formatPrice(a.depositMinor, a.currency, locale) : '',
        link: `${getEnv().APP_URL}/book/${a.tenant.slug}/manage/${token}`,
      }),
    });
  } catch (err) {
    logger.error('notify: confirmed email failed', {
      appointmentId,
      error: err instanceof Error ? err : String(err),
    });
  }
}

/** The booking was cancelled because its SINPE deposit wasn't verified. */
export async function sendDepositFailedEmail(
  appointmentId: string,
  expired: boolean,
): Promise<void> {
  try {
    const a = await load(appointmentId);
    if (!a?.contactEmail) return;
    const { e, when } = context(a);
    await sendMail({
      to: a.contactEmail,
      subject: e.depositFailedSubject({ service: a.serviceNameSnapshot, business: a.tenant.name }),
      text: e.depositFailedBody({
        service: a.serviceNameSnapshot,
        business: a.tenant.name,
        when,
        expired,
      }),
    });
  } catch (err) {
    logger.error('notify: deposit email failed', {
      appointmentId,
      error: err instanceof Error ? err : String(err),
    });
  }
}
