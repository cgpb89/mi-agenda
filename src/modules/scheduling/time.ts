import { DateTime } from 'luxon';

/**
 * Time conventions
 * - Instants are epoch milliseconds (UTC) / JS Dates — what the DB stores.
 * - "Local date" is an ISO calendar date string (YYYY-MM-DD) in the tenant's
 *   IANA timezone. Recurring hours are minutes from local midnight.
 * - Wall-clock → instant conversion is done by Luxon in the tenant zone, so
 *   DST transitions are handled: a 09:00–17:00 window on a DST-change day is
 *   still 09:00–17:00 on the wall clock. Non-existent local times (spring-
 *   forward gap) resolve forward, per Luxon semantics.
 */

export const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidLocalDate(date: string): boolean {
  if (!LOCAL_DATE_RE.test(date)) return false;
  return DateTime.fromISO(date, { zone: 'UTC' }).isValid;
}

/** Instant (ms) of local wall-clock `minutes` after midnight on `date` in `tz`. */
export function localMinutesToInstant(date: string, minutes: number, tz: string): number {
  const base = DateTime.fromISO(date, { zone: tz });
  if (!base.isValid) throw new Error(`Invalid local date ${date} / zone ${tz}`);
  if (minutes >= 1440) {
    // End-of-day: midnight of the following local date.
    return base
      .plus({ days: 1 })
      .startOf('day')
      .plus({ minutes: minutes - 1440 })
      .toMillis();
  }
  return base
    .set({ hour: Math.floor(minutes / 60), minute: minutes % 60, second: 0, millisecond: 0 })
    .toMillis();
}

/** Local date (YYYY-MM-DD) of an instant in `tz`. */
export function localDateOf(instantMs: number, tz: string): string {
  return DateTime.fromMillis(instantMs, { zone: tz }).toISODate() as string;
}

/** Minutes after local midnight of an instant in `tz`. */
export function localMinutesOf(instantMs: number, tz: string): number {
  const dt = DateTime.fromMillis(instantMs, { zone: tz });
  return dt.hour * 60 + dt.minute;
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a local date. */
export function isoWeekday(date: string): number {
  return DateTime.fromISO(date, { zone: 'UTC' }).weekday;
}

export function addDays(date: string, days: number): string {
  return DateTime.fromISO(date, { zone: 'UTC' }).plus({ days }).toISODate() as string;
}

/** Whole calendar days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    DateTime.fromISO(b, { zone: 'UTC' }).diff(DateTime.fromISO(a, { zone: 'UTC' }), 'days').days,
  );
}

export function todayIn(tz: string, nowMs: number = Date.now()): string {
  return localDateOf(nowMs, tz);
}

/** Format minutes-from-midnight as "9:00 AM". */
export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatInstantTime(instantMs: number, tz: string, locale = 'en-US'): string {
  return DateTime.fromMillis(instantMs, { zone: tz })
    .setLocale(locale)
    .toLocaleString(DateTime.TIME_SIMPLE);
}
