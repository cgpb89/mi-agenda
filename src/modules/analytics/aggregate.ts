/**
 * Pure analytics aggregation. Inputs are appointment/payment rows already
 * scoped to ONE tenant and period by the loader.
 *
 * Metric definitions (shown next to each metric in the UI):
 * - Booked: appointments in the period excluding CANCELLED.
 * - Completed: status COMPLETED.
 * - Estimated revenue / estimated appointment value: Σ quoted price snapshot
 *   of COMPLETED appointments. Not collected payments.
 * - Collected: Σ non-voided PAYMENT − REFUND records by recorded date.
 * - Cancellation rate: CANCELLED ÷ all appointments (incl. cancelled) in period.
 * - No-show rate: NO_SHOW ÷ (COMPLETED + NO_SHOW).
 * - Utilisation: booked minutes (PENDING/CONFIRMED/COMPLETED) ÷ staff working
 *   minutes in the period.
 * Appointments are attributed to a period by their start time in the tenant's
 * timezone.
 */
import { DateTime } from 'luxon';

export interface ApptRow {
  startAt: Date;
  endAt: Date;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  quotedPriceMinor: number;
  serviceNameSnapshot: string;
  staffId: string;
  durationMin: number;
}

export interface PaymentRow {
  kind: 'PAYMENT' | 'REFUND';
  amountMinor: number;
  recordedAt: Date;
  voidedAt: Date | null;
}

export interface Totals {
  total: number;
  booked: number;
  completed: number;
  cancelled: number;
  noShow: number;
  upcoming: number;
  estimatedMinor: number;
  cancellationRate: number | null;
  noShowRate: number | null;
  bookedMinutes: number;
}

export function totals(rows: ApptRow[], now: Date): Totals {
  let booked = 0,
    completed = 0,
    cancelled = 0,
    noShow = 0,
    upcoming = 0,
    est = 0,
    bookedMinutes = 0;
  for (const r of rows) {
    if (r.status !== 'CANCELLED') booked++;
    if (r.status === 'COMPLETED') {
      completed++;
      est += r.quotedPriceMinor;
    }
    if (r.status === 'CANCELLED') cancelled++;
    if (r.status === 'NO_SHOW') noShow++;
    if ((r.status === 'PENDING' || r.status === 'CONFIRMED') && r.startAt > now) upcoming++;
    if (r.status === 'PENDING' || r.status === 'CONFIRMED' || r.status === 'COMPLETED')
      bookedMinutes += r.durationMin;
  }
  return {
    total: rows.length,
    booked,
    completed,
    cancelled,
    noShow,
    upcoming,
    estimatedMinor: est,
    cancellationRate: rows.length ? cancelled / rows.length : null,
    noShowRate: completed + noShow ? noShow / (completed + noShow) : null,
    bookedMinutes,
  };
}

export function collectedMinor(payments: PaymentRow[]): number {
  return payments.reduce(
    (s, p) => (p.voidedAt ? s : s + (p.kind === 'PAYMENT' ? p.amountMinor : -p.amountMinor)),
    0,
  );
}

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface Bucket {
  key: string;
  label: string;
  tooltip: string;
  volume: number;
  estimatedMinor: number;
}

export function chooseGranularity(days: number): Granularity {
  if (days <= 1) return 'hour';
  if (days <= 31) return 'day';
  if (days <= 180) return 'week';
  return 'month';
}

/** Bucket appointments by local hour/day/week/month across [from, to] local dates. */
export function buckets(
  rows: ApptRow[],
  tz: string,
  from: string,
  to: string,
  g: Granularity,
  hours: [number, number] = [9, 18],
): Bucket[] {
  const out: Bucket[] = [];
  const index = new Map<string, Bucket>();
  const start = DateTime.fromISO(from, { zone: tz });
  const end = DateTime.fromISO(to, { zone: tz });
  const days = Math.round(end.diff(start, 'days').days) + 1;

  if (g === 'hour') {
    for (let h = hours[0]; h <= hours[1]; h++) {
      const label = `${((h + 11) % 12) + 1}${h < 12 ? 'a' : 'p'}`;
      const b = { key: String(h), label, tooltip: label, volume: 0, estimatedMinor: 0 };
      out.push(b);
      index.set(b.key, b);
    }
  } else if (g === 'day') {
    for (let i = 0; i < days; i++) {
      const d = start.plus({ days: i });
      const label =
        days > 14 ? (i % 5 === 0 ? d.toFormat('L/d') : '') : `${d.toFormat('ccccc')} ${d.day}`;
      const b = {
        key: d.toISODate()!,
        label,
        tooltip: d.toFormat('ccc, LLL d'),
        volume: 0,
        estimatedMinor: 0,
      };
      out.push(b);
      index.set(b.key, b);
    }
  } else if (g === 'week') {
    let w = start.startOf('week');
    while (w <= end) {
      const b = {
        key: w.toISODate()!,
        label: w.toFormat('LLL d'),
        tooltip: `Week of ${w.toFormat('LLL d')}`,
        volume: 0,
        estimatedMinor: 0,
      };
      out.push(b);
      index.set(b.key, b);
      w = w.plus({ weeks: 1 });
    }
  } else {
    let m = start.startOf('month');
    while (m <= end) {
      const b = {
        key: m.toFormat('yyyy-LL'),
        label: m.toFormat('LLL'),
        tooltip: m.toFormat('LLLL yyyy'),
        volume: 0,
        estimatedMinor: 0,
      };
      out.push(b);
      index.set(b.key, b);
      m = m.plus({ months: 1 });
    }
  }

  for (const r of rows) {
    const local = DateTime.fromJSDate(r.startAt, { zone: tz });
    const key =
      g === 'hour'
        ? String(local.hour)
        : g === 'day'
          ? local.toISODate()!
          : g === 'week'
            ? local.startOf('week').toISODate()!
            : local.toFormat('yyyy-LL');
    const b = index.get(key);
    if (!b) continue;
    if (r.status !== 'CANCELLED') b.volume++;
    if (r.status === 'COMPLETED') b.estimatedMinor += r.quotedPriceMinor;
  }
  return out;
}

export function popularServices(
  rows: ApptRow[],
  limit = 6,
): { name: string; count: number; share: number }[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    if (r.status === 'CANCELLED') continue;
    counts.set(r.serviceNameSnapshot, (counts.get(r.serviceNameSnapshot) ?? 0) + 1);
    total++;
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count, share: total ? count / total : 0 }));
}

/** Appointments (excl. cancelled) by local start hour. */
export function peakHours(
  rows: ApptRow[],
  tz: string,
  hours: [number, number] = [9, 18],
): { hour: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const r of rows) {
    if (r.status === 'CANCELLED') continue;
    const h = DateTime.fromJSDate(r.startAt, { zone: tz }).hour;
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  const out: { hour: number; count: number }[] = [];
  for (let h = hours[0]; h <= hours[1]; h++) out.push({ hour: h, count: counts.get(h) ?? 0 });
  return out;
}

/** Average appointments per occurrence of each weekday in the period (Mon..Sun). */
export function busiestDays(
  rows: ApptRow[],
  tz: string,
  from: string,
  to: string,
): { weekday: number; average: number }[] {
  const occurrences = new Array(8).fill(0) as number[];
  const start = DateTime.fromISO(from, { zone: tz });
  const end = DateTime.fromISO(to, { zone: tz });
  for (let d = start; d <= end; d = d.plus({ days: 1 })) occurrences[d.weekday]!++;
  const counts = new Array(8).fill(0) as number[];
  for (const r of rows) {
    if (r.status === 'CANCELLED') continue;
    counts[DateTime.fromJSDate(r.startAt, { zone: tz }).weekday]!++;
  }
  return [1, 2, 3, 4, 5, 6, 7].map((w) => ({
    weekday: w,
    average: occurrences[w] ? counts[w]! / occurrences[w]! : 0,
  }));
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}
