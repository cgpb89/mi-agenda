import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { formatPrice } from '@/i18n/format';
import { messages } from '@/i18n/messages';

/**
 * Client-safe formatting in the BUSINESS timezone (never the viewer's browser
 * zone), so staff in another zone still see the shop's wall-clock times. Every
 * formatter takes the UI locale explicitly.
 */
export function fmtTime(d: Date | string, tz: string, locale: Locale): string {
  return new Date(d)
    .toLocaleTimeString(INTL_LOCALE[locale], {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
    })
    .replace(/\s/g, ' ');
}

export function fmtDay(
  d: Date | string,
  tz: string,
  locale: Locale,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' },
): string {
  return new Date(d).toLocaleDateString(INTL_LOCALE[locale], { ...opts, timeZone: tz });
}

/** A local calendar date ("2026-10-10") formatted without any timezone shift. */
export function fmtDate(
  iso: string,
  locale: Locale,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(INTL_LOCALE[locale], {
    ...opts,
    timeZone: 'UTC',
  });
}

export function localDateKey(d: Date | string, tz: string): string {
  // en-CA yields YYYY-MM-DD.
  return new Date(d).toLocaleDateString('en-CA', { timeZone: tz });
}

export function localMinutes(d: Date | string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
    timeZone: tz,
  }).formatToParts(new Date(d));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

/** "Today" / "Tomorrow" / "Sat, Oct 10" relative to the business's today. */
export function relDay(d: Date | string, tz: string, today: string, locale: Locale): string {
  const key = localDateKey(d, tz);
  if (key === today) return messages[locale].common.today;
  const t = new Date(`${today}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  if (key === t.toISOString().slice(0, 10)) return messages[locale].common.tomorrow;
  return fmtDay(d, tz, locale);
}

export function moneyFmt(minor: number, currency: string, locale: Locale): string {
  return formatPrice(minor, currency, locale);
}

export function numFmt(n: number, locale: Locale): string {
  return n.toLocaleString(INTL_LOCALE[locale]);
}

export function pct(v: number | null, locale: Locale, digits = 1): string {
  if (v === null) return '—';
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

/** Compact hour label for charts: "9a" / "2p" (en), "9 h" / "14 h" (es). */
export function hourShort(h: number, locale: Locale): string {
  return locale === 'es' ? `${h} h` : `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
}

export function hourLong(h: number, locale: Locale): string {
  return new Date(Date.UTC(2000, 0, 1, h))
    .toLocaleTimeString(INTL_LOCALE[locale], {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    })
    .replace(/\s/g, ' ');
}

/** Weekday names in ISO order (Monday first), capitalised for standalone labels. */
export function weekdayNames(
  locale: Locale,
  style: 'long' | 'short' | 'narrow' = 'long',
): string[] {
  // 2024-01-01 was a Monday.
  return Array.from({ length: 7 }, (_, i) => {
    const name = new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(INTL_LOCALE[locale], {
      weekday: style,
      timeZone: 'UTC',
    });
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
}
