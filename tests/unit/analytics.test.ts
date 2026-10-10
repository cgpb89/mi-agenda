import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  buckets,
  busiestDays,
  chooseGranularity,
  collectedMinor,
  peakHours,
  popularServices,
  totals,
  type ApptRow,
} from '@/modules/analytics/aggregate';
import { summarizeHours } from '@/modules/public/booking-page-pure';

const TZ = 'America/New_York';
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ }).toJSDate();
const row = (
  iso: string,
  status: ApptRow['status'],
  price = 3800,
  name = 'Classic Cut',
): ApptRow => ({
  startAt: at(iso),
  endAt: DateTime.fromISO(iso, { zone: TZ }).plus({ minutes: 45 }).toJSDate(),
  status,
  quotedPriceMinor: price,
  serviceNameSnapshot: name,
  staffId: 's1',
  durationMin: 45,
});

const rows: ApptRow[] = [
  row('2026-10-05T09:00', 'COMPLETED'),
  row('2026-10-05T10:00', 'COMPLETED', 4500, 'Skin Fade'),
  row('2026-10-06T17:00', 'CANCELLED', 4500, 'Skin Fade'),
  row('2026-10-07T17:00', 'NO_SHOW', 2200, 'Beard Trim'),
  row('2026-10-12T17:00', 'CONFIRMED'),
];
const now = at('2026-10-09T12:00');

describe('analytics aggregation', () => {
  it('computes totals with documented definitions', () => {
    const t = totals(rows, now);
    expect(t.total).toBe(5);
    expect(t.booked).toBe(4); // excludes cancelled
    expect(t.completed).toBe(2);
    expect(t.estimatedMinor).toBe(8300); // completed only; never cancelled/no-show
    expect(t.cancellationRate).toBeCloseTo(1 / 5);
    expect(t.noShowRate).toBeCloseTo(1 / 3);
    expect(t.upcoming).toBe(1);
  });
  it('collected excludes voided entries and subtracts refunds', () => {
    expect(
      collectedMinor([
        { kind: 'PAYMENT', amountMinor: 3800, recordedAt: now, voidedAt: null },
        { kind: 'PAYMENT', amountMinor: 3800, recordedAt: now, voidedAt: now },
        { kind: 'REFUND', amountMinor: 800, recordedAt: now, voidedAt: null },
      ]),
    ).toBe(3000);
  });
  it('buckets by local day in the business time zone', () => {
    const b = buckets(rows, TZ, '2026-10-05', '2026-10-11', 'day');
    expect(b).toHaveLength(7);
    expect(b[0]!.volume).toBe(2);
    expect(b[0]!.estimatedMinor).toBe(8300);
    expect(b[1]!.volume).toBe(0); // cancelled excluded
  });
  it('attributes a late-evening appointment to its local day, not the UTC day', () => {
    const late = [row('2026-10-05T22:30', 'COMPLETED')]; // 02:30 UTC next day
    const b = buckets(late, TZ, '2026-10-05', '2026-10-06', 'day');
    expect(b[0]!.volume).toBe(1);
    expect(b[1]!.volume).toBe(0);
  });
  it('chooses granularity by range length', () => {
    expect(chooseGranularity(1)).toBe('hour');
    expect(chooseGranularity(30)).toBe('day');
    expect(chooseGranularity(90)).toBe('week');
    expect(chooseGranularity(365)).toBe('month');
  });
  it('ranks popular services and peak hours excluding cancellations', () => {
    const p = popularServices(rows);
    expect(p[0]).toMatchObject({ name: 'Classic Cut', count: 2 });
    expect(p.find((x) => x.name === 'Skin Fade')!.count).toBe(1);
    const h = peakHours(rows, TZ);
    expect(h.find((x) => x.hour === 17)!.count).toBe(2);
  });
  it('averages per weekday occurrence', () => {
    const d = busiestDays(rows.slice(0, 4), TZ, '2026-10-05', '2026-10-11'); // loader pre-filters to the range
    expect(d.find((x) => x.weekday === 1)!.average).toBe(2);
  });
});

describe('public hours summary', () => {
  it('groups consecutive days with identical hours and lists closed days', () => {
    const rules = [1, 2, 3, 4, 5]
      .map((d) => ({ dayOfWeek: d, startMin: 540, endMin: 1140 }))
      .concat([{ dayOfWeek: 6, startMin: 540, endMin: 1080 }]);
    expect(summarizeHours(rules)).toEqual([
      'Mon–Fri 9:00 AM – 7:00 PM',
      'Sat 9:00 AM – 6:00 PM',
      'Sun closed',
    ]);
  });
});
