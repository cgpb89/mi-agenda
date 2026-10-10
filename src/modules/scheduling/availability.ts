/**
 * Availability engine (pure — no I/O). The same functions back the public slot
 * picker, the owner's slot preview, the "new appointment" conflict message and
 * the authoritative re-check inside the booking transaction.
 *
 * Precedence (documented in docs/booking-engine.md):
 *  1. Business hours for the local date:
 *       business CLOSED exception      → closed all day
 *       business CUSTOM_HOURS rows     → replace the weekly business hours
 *       otherwise                      → weekly business rules for that weekday
 *  2. Staff hours for the local date:
 *       staff CLOSED exception         → not working
 *       staff CUSTOM_HOURS rows        → replace the staff weekly rules
 *       staff has weekly rules         → those rules for that weekday
 *       staff has NO weekly rules      → inherits business hours
 *  3. Working windows = business ∩ staff, minus BLOCK exceptions (business-wide
 *     and staff-specific).
 *  4. A start time is bookable when the appointment [start, start+duration)
 *     fits inside one working window, and its buffered block
 *     [start-bufferBefore, end+bufferAfter) overlaps no existing block of an
 *     active appointment for that staff member (half-open intervals).
 *  5. Public bookings additionally respect minimum notice, maximum advance
 *     window (service override wins) and the service's allowed days.
 */
import { type Interval, contains, intersect, normalize, overlaps, subtract } from './intervals';
import { addDays, daysBetween, isoWeekday, localMinutesToInstant, todayIn } from './time';

export interface WeeklyRuleInput {
  staffId: string | null;
  dayOfWeek: number;
  startMin: number;
  endMin: number;
}

export interface ExceptionInput {
  staffId: string | null;
  type: 'CLOSED' | 'CUSTOM_HOURS' | 'BLOCK';
  date: string;
  endDate: string | null;
  startMin: number | null;
  endMin: number | null;
  reason?: string | null;
}

export interface BusyInput {
  id: string;
  staffId: string;
  /** Buffered block, epoch ms. */
  blockStart: number;
  blockEnd: number;
}

export interface ServiceInput {
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  availableOn: 'ALL' | 'WEEKDAYS' | 'SATURDAYS';
  maxAdvanceDays: number | null;
}

export interface PolicyInput {
  slotIntervalMin: number;
  minNoticeMin: number;
  maxAdvanceDays: number;
}

export interface ScheduleData {
  tz: string;
  rules: WeeklyRuleInput[];
  exceptions: ExceptionInput[];
  busy: BusyInput[];
}

export type BookingMode = 'public' | 'staff';

export type SlotReason =
  | 'past'
  | 'too_soon'
  | 'beyond_window'
  | 'service_day'
  | 'business_closed'
  | 'not_working_day'
  | 'outside_hours'
  | 'break'
  | 'blocked'
  | 'booked';

const MS = 60_000;

function covers(e: ExceptionInput, date: string): boolean {
  return e.date <= date && date <= (e.endDate ?? e.date);
}

function minuteWindowsFromExceptions(list: ExceptionInput[]): Interval[] {
  return list
    .filter((e) => e.startMin !== null && e.endMin !== null)
    .map((e) => ({ start: e.startMin as number, end: e.endMin as number }));
}

/** Business opening windows (minutes from local midnight) for a local date. */
export function businessWindows(data: ScheduleData, date: string): Interval[] {
  const ex = data.exceptions.filter((e) => e.staffId === null && covers(e, date));
  if (ex.some((e) => e.type === 'CLOSED')) return [];
  const custom = ex.filter((e) => e.type === 'CUSTOM_HOURS');
  if (custom.length > 0) return normalize(minuteWindowsFromExceptions(custom));
  const dow = isoWeekday(date);
  return normalize(
    data.rules
      .filter((r) => r.staffId === null && r.dayOfWeek === dow)
      .map((r) => ({ start: r.startMin, end: r.endMin })),
  );
}

/** Staff hours (minutes) before intersecting with business hours. */
function staffOwnWindows(
  data: ScheduleData,
  staffId: string,
  date: string,
): Interval[] | 'inherit' {
  const ex = data.exceptions.filter((e) => e.staffId === staffId && covers(e, date));
  if (ex.some((e) => e.type === 'CLOSED')) return [];
  const custom = ex.filter((e) => e.type === 'CUSTOM_HOURS');
  if (custom.length > 0) return normalize(minuteWindowsFromExceptions(custom));
  const own = data.rules.filter((r) => r.staffId === staffId);
  if (own.length === 0) return 'inherit';
  const dow = isoWeekday(date);
  return normalize(
    own.filter((r) => r.dayOfWeek === dow).map((r) => ({ start: r.startMin, end: r.endMin })),
  );
}

function blockWindows(data: ScheduleData, staffId: string, date: string): Interval[] {
  return minuteWindowsFromExceptions(
    data.exceptions.filter(
      (e) => e.type === 'BLOCK' && (e.staffId === null || e.staffId === staffId) && covers(e, date),
    ),
  );
}

export interface StaffDay {
  /** Working windows in minutes (business ∩ staff), blocks NOT yet removed. */
  shiftMinutes: Interval[];
  /** Working windows in minutes with blocks removed. */
  workMinutes: Interval[];
  blocksMinutes: Interval[];
  businessClosed: boolean;
}

export function staffDay(data: ScheduleData, staffId: string, date: string): StaffDay {
  const biz = businessWindows(data, date);
  const own = staffOwnWindows(data, staffId, date);
  const shift = own === 'inherit' ? biz : intersect(biz, own);
  const blocks = normalize(blockWindows(data, staffId, date));
  return {
    shiftMinutes: shift,
    workMinutes: subtract(shift, blocks),
    blocksMinutes: blocks,
    businessClosed: biz.length === 0,
  };
}

function toMs(date: string, windows: Interval[], tz: string): Interval[] {
  return windows.map((w) => ({
    start: localMinutesToInstant(date, w.start, tz),
    end: localMinutesToInstant(date, w.end, tz),
  }));
}

export interface EvaluateInput {
  staffId: string;
  /** Local date + start minute in the tenant timezone. */
  date: string;
  startMin: number;
  service: ServiceInput;
  policy: PolicyInput;
  nowMs: number;
  mode: BookingMode;
  /** Ignore this appointment's own block (rescheduling). */
  excludeAppointmentId?: string;
}

export type EvaluateResult =
  | { ok: true; startMs: number; endMs: number; blockStartMs: number; blockEndMs: number }
  | { ok: false; reason: SlotReason; conflictId?: string };

export function serviceAllowsDate(service: ServiceInput, date: string): boolean {
  const dow = isoWeekday(date);
  if (service.availableOn === 'WEEKDAYS') return dow >= 1 && dow <= 5;
  if (service.availableOn === 'SATURDAYS') return dow === 6;
  return true;
}

export function maxAdvanceDaysFor(service: ServiceInput, policy: PolicyInput): number {
  return service.maxAdvanceDays ?? policy.maxAdvanceDays;
}

/** Authoritative check for a single (staff, start) pair. */
export function evaluateSlot(data: ScheduleData, input: EvaluateInput): EvaluateResult {
  const { service, policy, date, startMin, nowMs, mode, staffId } = input;
  const startMs = localMinutesToInstant(date, startMin, data.tz);
  const endMs = startMs + service.durationMin * MS;
  const blockStartMs = startMs - service.bufferBeforeMin * MS;
  const blockEndMs = endMs + service.bufferAfterMin * MS;

  if (startMs < nowMs) return { ok: false, reason: 'past' };
  if (mode === 'public') {
    if (startMs < nowMs + policy.minNoticeMin * MS) return { ok: false, reason: 'too_soon' };
    const today = todayIn(data.tz, nowMs);
    if (daysBetween(today, date) > maxAdvanceDaysFor(service, policy))
      return { ok: false, reason: 'beyond_window' };
    if (!serviceAllowsDate(service, date)) return { ok: false, reason: 'service_day' };
  }

  const day = staffDay(data, staffId, date);
  if (day.businessClosed) return { ok: false, reason: 'business_closed' };
  if (day.shiftMinutes.length === 0) return { ok: false, reason: 'not_working_day' };

  const appt = { start: startMs, end: endMs };
  const work = toMs(date, day.workMinutes, data.tz);
  if (!work.some((w) => contains(w, appt))) {
    const blocks = toMs(date, day.blocksMinutes, data.tz);
    if (blocks.some((b) => overlaps(b, appt))) return { ok: false, reason: 'blocked' };
    const shift = toMs(date, day.shiftMinutes, data.tz);
    const first = shift[0]!.start;
    const last = shift[shift.length - 1]!.end;
    if (appt.start >= first && appt.end <= last) return { ok: false, reason: 'break' };
    return { ok: false, reason: 'outside_hours' };
  }

  const block = { start: blockStartMs, end: blockEndMs };
  const clash = data.busy.find(
    (b) =>
      b.staffId === staffId &&
      b.id !== input.excludeAppointmentId &&
      overlaps({ start: b.blockStart, end: b.blockEnd }, block),
  );
  if (clash) return { ok: false, reason: 'booked', conflictId: clash.id };

  return { ok: true, startMs, endMs, blockStartMs, blockEndMs };
}

export interface DaySlot {
  startMin: number;
  startMs: number;
  available: boolean;
  /** Staff who can take this slot (only meaningful when available). */
  staffIds: string[];
  /** Reason for the first evaluated staff when unavailable (owner preview only). */
  reason?: SlotReason;
}

export interface DaySlotsResult {
  date: string;
  /** Business closed, or none of the eligible staff work this day. */
  closed: boolean;
  slots: DaySlot[];
}

/**
 * Slot grid for one local date across the eligible staff. Candidate starts are
 * stepped by the policy interval from the start of each working window.
 */
export function daySlots(
  data: ScheduleData,
  input: Omit<EvaluateInput, 'staffId' | 'date' | 'startMin'> & {
    date: string;
    staffIds: string[];
  },
): DaySlotsResult {
  const { date, staffIds, policy } = input;
  const step = Math.max(5, policy.slotIntervalMin);
  const starts = new Set<number>();
  let anyShift = false;
  let closed = false;
  for (const staffId of staffIds) {
    const day = staffDay(data, staffId, date);
    if (day.businessClosed) closed = true;
    if (day.shiftMinutes.length > 0) anyShift = true;
    for (const w of day.shiftMinutes) {
      for (let m = w.start; m + input.service.durationMin <= w.end; m += step) starts.add(m);
    }
  }
  if (closed || !anyShift || staffIds.length === 0) return { date, closed: true, slots: [] };

  const slots: DaySlot[] = [...starts]
    .sort((a, b) => a - b)
    .map((startMin) => {
      const okStaff: string[] = [];
      let firstReason: SlotReason | undefined;
      let startMs = localMinutesToInstant(date, startMin, data.tz);
      for (const staffId of staffIds) {
        const r = evaluateSlot(data, { ...input, staffId, date, startMin });
        if (r.ok) {
          okStaff.push(staffId);
          startMs = r.startMs;
        } else if (!firstReason) firstReason = r.reason;
      }
      return okStaff.length
        ? { startMin, startMs, available: true, staffIds: okStaff }
        : { startMin, startMs, available: false, staffIds: [], reason: firstReason };
    });
  return { date, closed: false, slots };
}

/**
 * "No preference": pick the eligible staff member with the fewest active
 * bookings that day; ties go to the first in the provided (display) order.
 */
export function pickStaff(
  candidates: string[],
  busy: BusyInput[],
  dayStartMs: number,
  dayEndMs: number,
): string | undefined {
  let best: string | undefined;
  let bestCount = Infinity;
  for (const id of candidates) {
    const count = busy.filter(
      (b) => b.staffId === id && b.blockStart < dayEndMs && b.blockEnd > dayStartMs,
    ).length;
    if (count < bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

/** Dates (local) from today for the day-chip strip. */
export function upcomingDates(tz: string, nowMs: number, count: number): string[] {
  const today = todayIn(tz, nowMs);
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}
