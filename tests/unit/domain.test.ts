import { describe, expect, it } from 'vitest';
import { msg } from '@/i18n/message-ref';
import {
  appointmentRef,
  canReschedule,
  confirmationCode,
  countsTowardPhoneLimit,
  customerCanModify,
  parseRef,
  transitionError,
  wouldExceedPhoneLimit,
} from '@/modules/bookings/rules';
import {
  estimatedValueMinor,
  ledgerEntryError,
  netCollectedMinor,
  paymentState,
} from '@/modules/payments/ledger';
import { can } from '@/lib/auth/permissions';

const now = new Date('2026-10-09T15:00:00Z');
const past = new Date('2026-10-09T10:00:00Z');
const future = new Date('2026-10-10T10:00:00Z');

describe('active-appointment definition (phone limit)', () => {
  it('counts only future PENDING/CONFIRMED appointments', () => {
    expect(countsTowardPhoneLimit({ status: 'CONFIRMED', endAt: future }, now)).toBe(true);
    expect(countsTowardPhoneLimit({ status: 'PENDING', endAt: future }, now)).toBe(true);
    expect(countsTowardPhoneLimit({ status: 'CANCELLED', endAt: future }, now)).toBe(false);
    expect(countsTowardPhoneLimit({ status: 'COMPLETED', endAt: future }, now)).toBe(false);
    expect(countsTowardPhoneLimit({ status: 'NO_SHOW', endAt: future }, now)).toBe(false);
  });
  it('does not let a stale past appointment block new bookings', () => {
    expect(countsTowardPhoneLimit({ status: 'CONFIRMED', endAt: past }, now)).toBe(false);
  });
  it('rejects when the active count reaches the configured maximum', () => {
    expect(wouldExceedPhoneLimit(0, 1)).toBe(false);
    expect(wouldExceedPhoneLimit(1, 1)).toBe(true);
    expect(wouldExceedPhoneLimit(2, 3)).toBe(false);
    expect(wouldExceedPhoneLimit(3, 3)).toBe(true);
  });
});

describe('status transitions', () => {
  it('follows the lifecycle', () => {
    expect(transitionError('PENDING', 'confirm', future, now)).toBeNull();
    expect(transitionError('CONFIRMED', 'confirm', future, now)).not.toBeNull();
    expect(transitionError('CONFIRMED', 'cancel', future, now)).toBeNull();
    expect(transitionError('COMPLETED', 'cancel', past, now)).not.toBeNull();
    expect(transitionError('CANCELLED', 'confirm', future, now)).not.toBeNull();
  });
  it('only completes or marks no-show once the appointment has started', () => {
    expect(transitionError('CONFIRMED', 'complete', future, now)).toBe(msg('notStarted'));
    expect(transitionError('CONFIRMED', 'complete', past, now)).toBeNull();
    expect(transitionError('CONFIRMED', 'no_show', past, now)).toBeNull();
    expect(transitionError('NO_SHOW', 'complete', past, now)).not.toBeNull();
  });
  it('allows rescheduling only active appointments', () => {
    expect(canReschedule('CONFIRMED')).toBe(true);
    expect(canReschedule('PENDING')).toBe(true);
    expect(canReschedule('CANCELLED')).toBe(false);
    expect(canReschedule('COMPLETED')).toBe(false);
  });
  it('enforces the customer cancellation window', () => {
    const start = new Date(now.getTime() + 3 * 3600_000);
    expect(customerCanModify(start, now, 240)).toBe(false);
    expect(customerCanModify(start, now, 120)).toBe(true);
  });
});

describe('references', () => {
  it('formats and parses appointment refs and confirmation codes', () => {
    expect(appointmentRef(10240)).toBe('A-10240');
    expect(parseRef('a-10240')).toBe(10240);
    expect(parseRef(' 10241 ')).toBe(10241);
    expect(parseRef('Andre')).toBeNull();
    expect(confirmationCode(10240)).toMatch(/^TMP-10240-[A-Z]$/);
    expect(confirmationCode(10240)).toBe(confirmationCode(10240));
  });
});

describe('payments ledger', () => {
  const P = (amountMinor: number, voided = false) => ({
    kind: 'PAYMENT' as const,
    amountMinor,
    voidedAt: voided ? now : null,
  });
  const R = (amountMinor: number) => ({ kind: 'REFUND' as const, amountMinor, voidedAt: null });
  it('nets payments minus refunds and ignores voided entries', () => {
    expect(netCollectedMinor([P(3800)])).toBe(3800);
    expect(netCollectedMinor([P(2000), P(1800)])).toBe(3800);
    expect(netCollectedMinor([P(3800), R(800)])).toBe(3000);
    expect(netCollectedMinor([P(3800, true), P(3800)])).toBe(3800);
  });
  it('classifies partial, paid and overpaid states', () => {
    expect(paymentState(3800, 0)).toBe('none');
    expect(paymentState(3800, 2000)).toBe('partial');
    expect(paymentState(3800, 3800)).toBe('paid');
    expect(paymentState(3800, 4300)).toBe('over');
  });
  it('validates new entries', () => {
    expect(ledgerEntryError('PAYMENT', 0, 0, 3800)).not.toBeNull();
    expect(ledgerEntryError('PAYMENT', 3800, 0, 3800)).toBeNull();
    expect(ledgerEntryError('REFUND', 5000, 3800, 3800)).toBe(msg('refundTooLarge'));
    expect(ledgerEntryError('REFUND', 3800, 3800, 3800)).toBeNull();
    expect(ledgerEntryError('PAYMENT', 380000, 0, 3800)).toBe(msg('amountTooHigh'));
  });
  it('estimated value counts only completed appointments (never collected money)', () => {
    expect(
      estimatedValueMinor([
        { status: 'COMPLETED', quotedPriceMinor: 3800 },
        { status: 'CANCELLED', quotedPriceMinor: 4500 },
        { status: 'CONFIRMED', quotedPriceMinor: 4500 },
        { status: 'NO_SHOW', quotedPriceMinor: 2200 },
        { status: 'COMPLETED', quotedPriceMinor: 2200 },
      ]),
    ).toBe(6000);
  });
});

describe('role permissions (deny by default)', () => {
  it('owners can do everything including roles', () => {
    expect(can('OWNER', 'team.roles')).toBe(true);
    expect(can('OWNER', 'policy.manage')).toBe(true);
  });
  it('managers cannot change roles', () => {
    expect(can('MANAGER', 'policy.manage')).toBe(true);
    expect(can('MANAGER', 'team.roles')).toBe(false);
  });
  it('staff only see the calendar and manage their own appointments', () => {
    expect(can('STAFF', 'appointments.read')).toBe(true);
    expect(can('STAFF', 'appointments.manage.own')).toBe(true);
    expect(can('STAFF', 'appointments.manage.any')).toBe(false);
    expect(can('STAFF', 'policy.manage')).toBe(false);
    expect(can('STAFF', 'revenue.read')).toBe(false);
    expect(can('STAFF', 'services.manage')).toBe(false);
  });
  it('no role → no access', () => {
    expect(can(null, 'dashboard.view')).toBe(false);
    expect(can(undefined, 'appointments.read')).toBe(false);
  });
});
