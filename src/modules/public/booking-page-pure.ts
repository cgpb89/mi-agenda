import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { messages } from '@/i18n/messages';
import { formatMinutes } from '@/modules/scheduling/time';

/** Short weekday names, ISO order (Monday first). 2024-01-01 was a Monday. */
function shortDays(locale: Locale): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(INTL_LOCALE[locale], {
      weekday: 'short',
      timeZone: 'UTC',
    }),
  );
}

/** "Mon–Fri 9:00 AM – 7:00 PM" style summary from weekly business rules. */
export function summarizeHours(
  rules: { dayOfWeek: number; startMin: number; endMin: number }[],
  locale: Locale = 'en',
): string[] {
  const DAY = shortDays(locale);
  const byDay = new Map<number, string>();
  for (let d = 1; d <= 7; d++) {
    const ps = rules.filter((r) => r.dayOfWeek === d).sort((a, b) => a.startMin - b.startMin);
    if (!ps.length) continue;
    // Outer envelope; gaps are listed as breaks.
    byDay.set(
      d,
      `${formatMinutes(ps[0]!.startMin, locale)} – ${formatMinutes(ps[ps.length - 1]!.endMin, locale)}`,
    );
  }
  const lines: string[] = [];
  let d = 1;
  while (d <= 7) {
    const v = byDay.get(d);
    if (!v) {
      d++;
      continue;
    }
    let e = d;
    while (e + 1 <= 7 && byDay.get(e + 1) === v) e++;
    lines.push(`${DAY[d - 1]}${e > d ? `–${DAY[e - 1]}` : ''} ${v}`);
    d = e + 1;
  }
  const closed = [1, 2, 3, 4, 5, 6, 7].filter((x) => !byDay.has(x)).map((x) => DAY[x - 1]);
  if (closed.length && closed.length < 7)
    lines.push(messages[locale].booking.page.closedDays({ days: closed.join(', ') }));
  return lines;
}
