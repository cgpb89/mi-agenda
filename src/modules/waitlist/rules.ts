/**
 * Waitlist rules (pure). When a slot frees up, everyone waiting for that
 * service and day is emailed; the first to book gets it. An entry is notified
 * again only after NOTIFY_THROTTLE_MS, so a run of cancellations doesn't flood
 * people, and never once they've booked.
 */
export const NOTIFY_THROTTLE_MS = 60 * 60 * 1000;
/** Cap per business and day, against abuse. */
export const MAX_ENTRIES_PER_DATE = 50;

export function canNotify(
  entry: { notifiedAt: Date | null; fulfilledAt: Date | null },
  now: Date,
): boolean {
  if (entry.fulfilledAt) return false;
  return !entry.notifiedAt || now.getTime() - entry.notifiedAt.getTime() >= NOTIFY_THROTTLE_MS;
}
