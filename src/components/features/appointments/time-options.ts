/** Client-safe helpers for date/time pickers in the dashboard. */

export function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function quarterOptions(from = 6 * 60, to = 22 * 60, step = 15): { v: number; l: string }[] {
  const out: { v: number; l: string }[] = [];
  for (let m = from; m < to; m += step) out.push({ v: m, l: fmtMin(m) });
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
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' },
): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

/** "Today, Fri, Oct 9" / "Tomorrow, Sat, Oct 10" / "Sun, Oct 11" for the next N days. */
export function dayOptions(today: string, count = 31): { v: string; l: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const d = addDaysIso(today, i);
    const base = labelDate(d);
    return { v: d, l: i === 0 ? `Today, ${base}` : i === 1 ? `Tomorrow, ${base}` : base };
  });
}

export function money(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}
