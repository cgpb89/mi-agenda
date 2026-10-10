/**
 * Booking domain rules (pure). Single source of truth for statuses, the
 * phone-limit "active" definition and lifecycle transitions.
 */
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

/** Statuses that occupy staff time (enforced by the DB exclusion constraint too). */
export const OCCUPYING_STATUSES: readonly AppointmentStatus[] = [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
];

/**
 * Statuses that may count toward the per-phone limit. An appointment counts
 * only if its status is one of these AND it has not ended yet — so a past
 * appointment whose status was never updated cannot block new bookings.
 */
export const PHONE_LIMIT_STATUSES: readonly AppointmentStatus[] = ['PENDING', 'CONFIRMED'];

export function countsTowardPhoneLimit(
  a: { status: AppointmentStatus; endAt: Date },
  now: Date,
): boolean {
  return PHONE_LIMIT_STATUSES.includes(a.status) && a.endAt.getTime() > now.getTime();
}

export const MAX_ACTIVE_PER_PHONE_MIN = 1;
export const MAX_ACTIVE_PER_PHONE_MAX = 20;

export function wouldExceedPhoneLimit(activeCount: number, max: number): boolean {
  return activeCount >= max;
}

export type Transition = 'confirm' | 'cancel' | 'complete' | 'no_show';

const TARGET: Record<Transition, AppointmentStatus> = {
  confirm: 'CONFIRMED',
  cancel: 'CANCELLED',
  complete: 'COMPLETED',
  no_show: 'NO_SHOW',
};

/**
 * Lifecycle:
 *   PENDING   → CONFIRMED | CANCELLED
 *   CONFIRMED → CANCELLED | COMPLETED* | NO_SHOW*      (*only once it has started)
 *   COMPLETED, CANCELLED, NO_SHOW are terminal.
 * Completing an appointment never implies payment — see payments module.
 */
export function transitionError(
  current: AppointmentStatus,
  action: Transition,
  startAt: Date,
  now: Date,
): string | null {
  const started = startAt.getTime() <= now.getTime();
  switch (action) {
    case 'confirm':
      return current === 'PENDING' ? null : 'Only pending appointments can be confirmed.';
    case 'cancel':
      return current === 'PENDING' || current === 'CONFIRMED'
        ? null
        : 'This appointment can no longer be cancelled.';
    case 'complete':
    case 'no_show':
      if (current !== 'CONFIRMED' && current !== 'PENDING')
        return 'This appointment is already closed.';
      if (!started) return "This appointment hasn't started yet.";
      return null;
  }
}

export function targetStatus(action: Transition): AppointmentStatus {
  return TARGET[action];
}

export function canReschedule(current: AppointmentStatus): boolean {
  return current === 'PENDING' || current === 'CONFIRMED';
}

/** Customers may self-cancel/reschedule only before the business's cancellation window. */
export function customerCanModify(
  startAt: Date,
  now: Date,
  cancellationWindowMin: number,
): boolean {
  return startAt.getTime() - now.getTime() >= cancellationWindowMin * 60_000;
}

// ── References ──────────────────────────────────────────────────────────────

export function appointmentRef(refNumber: number): string {
  return `A-${refNumber}`;
}

const CHECK_LETTERS = 'KMRTZXHPWD';

/** Customer-facing confirmation code, e.g. TMP-10240-K (display only, not a credential). */
export function confirmationCode(refNumber: number): string {
  const digits = String(refNumber);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * (i + 3);
  return `TMP-${digits}-${CHECK_LETTERS[sum % CHECK_LETTERS.length]}`;
}

/** Parse "A-10240" / "10240" for search. */
export function parseRef(input: string): number | null {
  const m = /^\s*(?:a-)?(\d{1,9})\s*$/i.exec(input);
  return m ? Number(m[1]) : null;
}
