/** Client-safe helpers for date/time pickers in the dashboard. */
import type { Locale } from '@/i18n/config';
import { formatMinutesOfDay, formatPrice } from '@/i18n/format';
import { messages } from '@/i18n/messages';
import { fmtDate } from '@/components/features/shared/format';

export function fmtMin(m: number, locale: Locale): string {
  return formatMinutesOfDay(m, locale);
}

export function quarterOptions(
  locale: Locale,
  from = 6 * 60,
  to = 22 * 60,
  step = 15,
): { v: number; l: string }[] {
  const out: { v: number; l: string }[] = [];
  for (let m = from; m < to; m += step) out.push({ v: m, l: fmtMin(m, locale) });
  return out;
}

/** Calendar math on ISO dates without touching the browser's timezone. */
export function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function labelDate(
  date: string,
  locale: Locale,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' },
): string {
  return fmtDate(date, locale, opts);
}

/** "Today, Fri, Oct 9" / "Tomorrow, Sat, Oct 10" / "Sun, Oct 11" for the next N days. */
export function dayOptions(today: string, locale: Locale, count = 31): { v: string; l: string }[] {
  const a = messages[locale].appointments;
  return Array.from({ length: count }, (_, i) => {
    const d = addDaysIso(today, i);
    const day = labelDate(d, locale);
    return {
      v: d,
      l: i === 0 ? a.todayPrefix({ day }) : i === 1 ? a.tomorrowPrefix({ day }) : day,
    };
  });
}

export function money(minor: number, currency: string, locale: Locale): string {
  return formatPrice(minor, currency, locale);
}
