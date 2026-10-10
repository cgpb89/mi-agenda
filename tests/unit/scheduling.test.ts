import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import {
  type ScheduleData,
  type ServiceInput,
  type PolicyInput,
  businessWindows,
  daySlots,
  evaluateSlot,
  pickStaff,
  staffDay,
} from '@/modules/scheduling/availability';
import {
  intersect,
  normalize,
  overlaps,
  subtract,
  validateDayPeriods,
} from '@/modules/scheduling/intervals';
import { addDays, isoWeekday, localDateOf, localMinutesToInstant } from '@/modules/scheduling/time';

const TZ = 'America/New_York';
const H = (h: number, m = 0) => h * 60 + m;

const service: ServiceInput = {
  durationMin: 45,
  bufferBeforeMin: 0,
  bufferAfterMin: 5,
  availableOn: 'ALL',
  maxAdvanceDays: null,
};
const policy: PolicyInput = { slotIntervalMin: 30, minNoticeMin: 60, maxAdvanceDays: 60 };

// Monday–Saturday 9:00–13:00 + 13:30–19:00 (Sat to 18:00), Sunday closed.
function baseData(overrides: Partial<ScheduleData> = {}): ScheduleData {
  const rules: ScheduleData['rules'] = [];
  for (let d = 1; d <= 6; d++) {
    rules.push({ staffId: null, dayOfWeek: d, startMin: H(9), endMin: H(13) });
    rules.push({
      staffId: null,
      dayOfWeek: d,
      startMin: H(13, 30),
      endMin: d === 6 ? H(18) : H(19),
    });
  }
  return { tz: TZ, rules, exceptions: [], busy: [], ...overrides };
}

// 2026-10-09 is a Friday. "now" = Thu 2026-10-08 12:00 New York.
const FRI = '2026-10-09';
const NOW = DateTime.fromISO('2026-10-08T12:00', { zone: TZ }).toMillis();

describe('intervals', () => {
  it('uses half-open semantics: touching intervals do not overlap', () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
    expect(overlaps({ start: 0, end: 10 }, { start: 9, end: 20 })).toBe(true);
  });
  it('normalizes, intersects and subtracts', () => {
    expect(
      normalize([
        { start: 5, end: 10 },
        { start: 0, end: 6 },
        { start: 12, end: 12 },
      ]),
    ).toEqual([{ start: 0, end: 10 }]);
    expect(intersect([{ start: 0, end: 10 }], [{ start: 5, end: 20 }])).toEqual([
      { start: 5, end: 10 },
    ]);
    expect(subtract([{ start: 0, end: 10 }], [{ start: 3, end: 4 }])).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 10 },
    ]);
  });
  it('validates day periods', () => {
    expect(validateDayPeriods([{ start: 10, end: 5 }])).toBe('end_before_start');
    expect(
      validateDayPeriods([
        { start: 0, end: 10 },
        { start: 5, end: 20 },
      ]),
    ).toBe('overlap');
    expect(
      validateDayPeriods([
        { start: 0, end: 10 },
        { start: 10, end: 20 },
      ]),
    ).toBeNull();
  });
});

describe('time conversion and DST', () => {
  it('maps local wall-clock minutes to the right UTC instant', () => {
    const ms = localMinutesToInstant(FRI, H(9), TZ);
    expect(new Date(ms).toISOString()).toBe('2026-10-09T13:00:00.000Z'); // EDT = UTC-4
  });
  it('keeps wall-clock hours across the spring-forward transition', () => {
    // 2026-03-08: clocks jump 02:00 → 03:00 in New York.
    const nine = localMinutesToInstant('2026-03-08', H(9), TZ);
    expect(new Date(nine).toISOString()).toBe('2026-03-08T13:00:00.000Z'); // EDT
    const before = localMinutesToInstant('2026-03-07', H(9), TZ);
    expect(new Date(before).toISOString()).toBe('2026-03-07T14:00:00.000Z'); // EST
  });
  it('keeps wall-clock hours across the fall-back transition', () => {
    const nine = localMinutesToInstant('2026-11-01', H(9), TZ);
    expect(new Date(nine).toISOString()).toBe('2026-11-01T14:00:00.000Z'); // EST
  });
  it('handles end-of-day (1440) as next local midnight', () => {
    const end = localMinutesToInstant(FRI, 1440, TZ);
    expect(localDateOf(end, TZ)).toBe(addDays(FRI, 1));
  });
  it('computes ISO weekdays', () => {
    expect(isoWeekday(FRI)).toBe(5);
    expect(isoWeekday('2026-10-11')).toBe(7);
  });
});

describe('precedence of hours and exceptions', () => {
  it('uses weekly business hours by default and closes Sundays', () => {
    expect(businessWindows(baseData(), FRI)).toEqual([
      { start: H(9), end: H(13) },
      { start: H(13, 30), end: H(19) },
    ]);
    expect(businessWindows(baseData(), '2026-10-11')).toEqual([]);
  });
  it('business CLOSED exception wins over weekly hours (incl. multi-day ranges)', () => {
    const data = baseData({
      exceptions: [
        {
          staffId: null,
          type: 'CLOSED',
          date: '2026-10-08',
          endDate: '2026-10-10',
          startMin: null,
          endMin: null,
        },
      ],
    });
    expect(businessWindows(data, FRI)).toEqual([]);
    expect(businessWindows(data, '2026-10-12')).not.toEqual([]);
  });
  it('business CUSTOM_HOURS replaces weekly hours for that date', () => {
    const data = baseData({
      exceptions: [
        {
          staffId: null,
          type: 'CUSTOM_HOURS',
          date: FRI,
          endDate: null,
          startMin: H(9),
          endMin: H(14),
        },
      ],
    });
    expect(businessWindows(data, FRI)).toEqual([{ start: H(9), end: H(14) }]);
  });
  it('staff without weekly rules inherit business hours; with rules they are intersected', () => {
    const inherit = staffDay(baseData(), 's1', FRI);
    expect(inherit.shiftMinutes).toEqual(businessWindows(baseData(), FRI));

    const data = baseData({
      rules: [...baseData().rules, { staffId: 's2', dayOfWeek: 5, startMin: H(8), endMin: H(12) }],
    });
    expect(staffDay(data, 's2', FRI).shiftMinutes).toEqual([{ start: H(9), end: H(12) }]); // clipped by business
    expect(staffDay(data, 's2', '2026-10-12').shiftMinutes).toEqual([]); // has rules, none on Monday
  });
  it('staff CLOSED (day off) and BLOCK exceptions remove time', () => {
    const data = baseData({
      exceptions: [
        { staffId: 's1', type: 'CLOSED', date: FRI, endDate: null, startMin: null, endMin: null },
        {
          staffId: 's2',
          type: 'BLOCK',
          date: FRI,
          endDate: null,
          startMin: H(15),
          endMin: H(16),
          reason: 'Dentist',
        },
      ],
    });
    expect(staffDay(data, 's1', FRI).shiftMinutes).toEqual([]);
    expect(staffDay(data, 's2', FRI).workMinutes).toEqual([
      { start: H(9), end: H(13) },
      { start: H(13, 30), end: H(15) },
      { start: H(16), end: H(19) },
    ]);
  });
});

describe('evaluateSlot', () => {
  const base = { staffId: 's1', date: FRI, service, policy, nowMs: NOW, mode: 'public' as const };

  it('accepts a free slot inside working hours and computes buffered block', () => {
    const r = evaluateSlot(baseData(), { ...base, startMin: H(10) });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.endMs - r.startMs).toBe(45 * 60_000);
      expect(r.blockEndMs - r.endMs).toBe(5 * 60_000);
    }
  });
  it('rejects appointments running into the lunch break or past closing', () => {
    expect(evaluateSlot(baseData(), { ...base, startMin: H(12, 30) })).toMatchObject({
      ok: false,
      reason: 'break',
    });
    expect(evaluateSlot(baseData(), { ...base, startMin: H(18, 30) })).toMatchObject({
      ok: false,
      reason: 'outside_hours',
    });
    expect(evaluateSlot(baseData(), { ...base, startMin: H(8) })).toMatchObject({
      ok: false,
      reason: 'outside_hours',
    });
  });
  it('allows an appointment ending exactly at a break (half-open)', () => {
    expect(evaluateSlot(baseData(), { ...base, startMin: H(12, 15) }).ok).toBe(true); // 12:15–13:00
  });
  it('rejects overlap with an existing buffered booking but allows back-to-back', () => {
    const existingStart = localMinutesToInstant(FRI, H(10), TZ);
    const data = baseData({
      busy: [
        {
          id: 'a1',
          staffId: 's1',
          blockStart: existingStart,
          blockEnd: existingStart + 50 * 60_000,
        },
      ], // 10:00–10:50
    });
    expect(evaluateSlot(data, { ...base, startMin: H(10, 30) })).toMatchObject({
      ok: false,
      reason: 'booked',
      conflictId: 'a1',
    });
    expect(evaluateSlot(data, { ...base, startMin: H(10, 50) }).ok).toBe(true);
    // Different staff member is unaffected.
    expect(evaluateSlot(data, { ...base, staffId: 's2', startMin: H(10) }).ok).toBe(true);
    // Rescheduling the same appointment ignores its own block.
    expect(evaluateSlot(data, { ...base, startMin: H(10), excludeAppointmentId: 'a1' }).ok).toBe(
      true,
    );
  });
  it('applies buffer-before against the previous booking', () => {
    const svc = { ...service, bufferBeforeMin: 10, bufferAfterMin: 0 };
    const prevEnd = localMinutesToInstant(FRI, H(11), TZ);
    const data = baseData({
      busy: [{ id: 'a1', staffId: 's1', blockStart: prevEnd - 3_600_000, blockEnd: prevEnd }],
    });
    expect(evaluateSlot(data, { ...base, service: svc, startMin: H(11) }).ok).toBe(false);
    expect(evaluateSlot(data, { ...base, service: svc, startMin: H(11, 10) }).ok).toBe(true);
  });
  it('enforces minimum notice, max advance and past times for public bookings only', () => {
    const now = localMinutesToInstant(FRI, H(10), TZ);
    expect(evaluateSlot(baseData(), { ...base, nowMs: now, startMin: H(10, 30) })).toMatchObject({
      reason: 'too_soon',
    });
    expect(
      evaluateSlot(baseData(), { ...base, nowMs: now, startMin: H(10, 30), mode: 'staff' }).ok,
    ).toBe(true);
    expect(
      evaluateSlot(baseData(), { ...base, nowMs: now, startMin: H(9, 30), mode: 'staff' }),
    ).toMatchObject({ reason: 'past' });
    const far = addDays(FRI, 61);
    expect(evaluateSlot(baseData(), { ...base, date: far, startMin: H(10) })).toMatchObject({
      reason: 'beyond_window',
    });
    expect(
      evaluateSlot(baseData(), {
        ...base,
        date: far,
        startMin: H(10),
        service: { ...service, maxAdvanceDays: 90 },
      }).ok,
    ).toBe(isoWeekday(far) !== 7);
  });
  it('respects the service allowed days for public bookings', () => {
    const svc = { ...service, availableOn: 'SATURDAYS' as const };
    expect(evaluateSlot(baseData(), { ...base, service: svc, startMin: H(10) })).toMatchObject({
      reason: 'service_day',
    });
    expect(
      evaluateSlot(baseData(), { ...base, service: svc, date: '2026-10-10', startMin: H(10) }).ok,
    ).toBe(true);
  });
  it('reports closed business and blocked time', () => {
    expect(
      evaluateSlot(baseData(), { ...base, date: '2026-10-11', startMin: H(10) }),
    ).toMatchObject({ reason: 'business_closed' });
    const data = baseData({
      exceptions: [
        { staffId: 's1', type: 'BLOCK', date: FRI, endDate: null, startMin: H(15), endMin: H(16) },
      ],
    });
    expect(evaluateSlot(data, { ...base, startMin: H(15) })).toMatchObject({ reason: 'blocked' });
  });
});

describe('daySlots', () => {
  it('builds a grid stepped by the policy interval and marks availability', () => {
    const r = daySlots(baseData(), {
      date: FRI,
      staffIds: ['s1'],
      service,
      policy,
      nowMs: NOW,
      mode: 'public',
    });
    expect(r.closed).toBe(false);
    expect(r.slots[0]?.startMin).toBe(H(9));
    // 9:00..12:00 (12:15 not on a 30-min step) then 13:30..18:00
    expect(r.slots.map((s) => s.startMin)).toContain(H(13, 30));
    expect(r.slots.every((s) => s.available)).toBe(true);
  });
  it('returns closed for closed days and unions staff for "no preference"', () => {
    expect(
      daySlots(baseData(), {
        date: '2026-10-11',
        staffIds: ['s1'],
        service,
        policy,
        nowMs: NOW,
        mode: 'public',
      }).closed,
    ).toBe(true);
    const at10 = localMinutesToInstant(FRI, H(10), TZ);
    const data = baseData({
      busy: [{ id: 'a', staffId: 's1', blockStart: at10, blockEnd: at10 + 50 * 60_000 }],
    });
    const r = daySlots(data, {
      date: FRI,
      staffIds: ['s1', 's2'],
      service,
      policy,
      nowMs: NOW,
      mode: 'public',
    });
    const slot = r.slots.find((s) => s.startMin === H(10))!;
    expect(slot.available).toBe(true);
    expect(slot.staffIds).toEqual(['s2']);
  });
});

describe('pickStaff', () => {
  it('prefers the least-booked staff member, then display order', () => {
    const busy = [{ id: 'x', staffId: 'a', blockStart: 10, blockEnd: 20 }];
    expect(pickStaff(['a', 'b'], busy, 0, 100)).toBe('b');
    expect(pickStaff(['a', 'b'], [], 0, 100)).toBe('a');
  });
});
