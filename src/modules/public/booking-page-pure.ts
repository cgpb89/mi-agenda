import { formatMinutes } from '@/modules/scheduling/time';

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Mon–Fri 9:00 AM – 7:00 PM" style summary from weekly business rules. */
export function summarizeHours(
  rules: { dayOfWeek: number; startMin: number; endMin: number }[],
): string[] {
  const byDay = new Map<number, string>();
  for (let d = 1; d <= 7; d++) {
    const ps = rules.filter((r) => r.dayOfWeek === d).sort((a, b) => a.startMin - b.startMin);
    if (!ps.length) continue;
    // Outer envelope; gaps are listed as breaks.
    byDay.set(d, `${formatMinutes(ps[0]!.startMin)} – ${formatMinutes(ps[ps.length - 1]!.endMin)}`);
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
  if (closed.length && closed.length < 7) lines.push(`${closed.join(', ')} closed`);
  return lines;
}
