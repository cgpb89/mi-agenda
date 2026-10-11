import { describe, expect, it } from 'vitest';
import { NOTIFY_THROTTLE_MS, canNotify } from '@/modules/waitlist/rules';

describe('waitlist notifications', () => {
  const now = new Date('2026-10-11T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it('notifies new entries', () => {
    expect(canNotify({ notifiedAt: null, fulfilledAt: null }, now)).toBe(true);
  });

  it('waits an hour before notifying the same person again', () => {
    expect(canNotify({ notifiedAt: ago(10 * 60 * 1000), fulfilledAt: null }, now)).toBe(false);
    expect(canNotify({ notifiedAt: ago(NOTIFY_THROTTLE_MS), fulfilledAt: null }, now)).toBe(true);
  });

  it('never notifies someone who already booked', () => {
    expect(canNotify({ notifiedAt: null, fulfilledAt: ago(1000) }, now)).toBe(false);
  });
});
