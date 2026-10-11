import { DateTime } from 'luxon';

/**
 * Store access lifecycle (pure, client-safe).
 *
 *   created ──1 month trial──► access_until ──1 month closed──► deleted
 *
 * Paying (recorded by a platform admin) moves access_until forward. While
 * closed, the booking page is offline and the dashboard only shows how to
 * reopen. The daily billing job deletes stores whose closed month has ended
 * (database function app.purge_expired_tenant re-checks the same dates).
 */
export const TRIAL_MONTHS = 1;
export const GRACE_MONTHS = 1;
/** Paid stores see a renewal reminder this many days before access ends. */
export const RENEWAL_REMINDER_DAYS = 7;

// Months are added in UTC, matching Postgres' "+ '1 mon'" (sessions run in UTC).
const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessPhase = 'trial' | 'paid' | 'closed';

export interface AccessState {
  phase: AccessPhase;
  /** End of the trial / paid period. */
  accessUntil: Date;
  /** When a closed store is permanently deleted. */
  deleteOn: Date;
  /** Whole days left in the trial / paid period (0 once closed). */
  daysLeft: number;
  /** Whole days until deletion. */
  daysUntilDeletion: number;
}

export function isClosed(accessUntil: Date, now: Date = new Date()): boolean {
  return accessUntil.getTime() <= now.getTime();
}

export function deletionDate(accessUntil: Date): Date {
  return DateTime.fromJSDate(accessUntil, { zone: 'utc' })
    .plus({ months: GRACE_MONTHS })
    .toJSDate();
}

/** Days remaining, rounded up so "ends later today" still reads as 1 day. */
export function daysUntil(when: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((when.getTime() - now.getTime()) / DAY_MS));
}

export function accessState(
  t: { status: string; accessUntil: Date },
  now: Date = new Date(),
): AccessState {
  const deleteOn = deletionDate(t.accessUntil);
  return {
    phase: isClosed(t.accessUntil, now) ? 'closed' : t.status === 'TRIAL' ? 'trial' : 'paid',
    accessUntil: t.accessUntil,
    deleteOn,
    daysLeft: daysUntil(t.accessUntil, now),
    daysUntilDeletion: daysUntil(deleteOn, now),
  };
}

/**
 * New end date after a payment of `months`. Time still left is kept; a closed
 * store's new period starts from the payment date.
 */
export function extendAccess(accessUntil: Date, months: number, now: Date = new Date()): Date {
  const from = accessUntil.getTime() > now.getTime() ? accessUntil : now;
  return DateTime.fromJSDate(from, { zone: 'utc' }).plus({ months }).toJSDate();
}

/** Owner warning emails sent by the daily billing job. */
export type OwnerNotice = 'ending' | 'closed' | 'deletion';
/** Days ahead of the end of access / of deletion that the warnings go out. */
export const NOTICE_DAYS = 7;

/**
 * Which warning (if any) is due now. At most one per run, in lifecycle order,
 * and each only once per period (the `notified*` timestamps reset on payment).
 */
export function dueOwnerNotice(
  t: {
    accessUntil: Date;
    notifiedEndingAt: Date | null;
    notifiedClosedAt: Date | null;
    notifiedDeletionAt: Date | null;
  },
  now: Date = new Date(),
): OwnerNotice | null {
  if (!isClosed(t.accessUntil, now)) {
    return daysUntil(t.accessUntil, now) <= NOTICE_DAYS && !t.notifiedEndingAt ? 'ending' : null;
  }
  if (!t.notifiedClosedAt) return 'closed';
  if (daysUntil(deletionDate(t.accessUntil), now) <= NOTICE_DAYS && !t.notifiedDeletionAt) {
    return 'deletion';
  }
  return null;
}
