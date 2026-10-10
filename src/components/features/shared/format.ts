/**
 * Client-safe formatting in the BUSINESS timezone (never the viewer's browser
 * zone), so staff in another zone still see the shop's wall-clock times.
 */
export function fmtTime(d: Date | string, tz: string): string {
  return new Date(d).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: tz,
  });
}

export function fmtDay(
  d: Date | string,
  tz: string,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' },
): string {
  return new Date(d).toLocaleDateString('en-US', { ...opts, timeZone: tz });
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
export function relDay(d: Date | string, tz: string, today: string): string {
  const key = localDateKey(d, tz);
  if (key === today) return 'Today';
  const t = new Date(`${today}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  if (key === t.toISOString().slice(0, 10)) return 'Tomorrow';
  return fmtDay(d, tz);
}

export function moneyFmt(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function pct(v: number | null, digits = 1): string {
  return v === null ? '—' : `${(v * 100).toFixed(digits)}%`;
}

export function hourShort(h: number): string {
  return `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
}

export function hourLong(h: number): string {
  return `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;
}

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
