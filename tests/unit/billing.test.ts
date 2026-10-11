import { describe, expect, it } from 'vitest';
import {
  accessState,
  daysUntil,
  deletionDate,
  extendAccess,
  isClosed,
  dueOwnerNotice,
} from '@/modules/billing/access';

const d = (iso: string) => new Date(iso);

describe('store access lifecycle', () => {
  const now = d('2026-10-11T12:00:00Z');

  it('reports trial days left, rounding a partial day up', () => {
    const s = accessState({ status: 'TRIAL', accessUntil: d('2026-10-20T08:00:00Z') }, now);
    expect(s.phase).toBe('trial');
    expect(s.daysLeft).toBe(9);
  });

  it('treats a non-trial store with time left as paid', () => {
    expect(
      accessState({ status: 'ACTIVE', accessUntil: d('2026-12-01T00:00:00Z') }, now).phase,
    ).toBe('paid');
  });

  it('closes the store when access ends and schedules deletion a month later', () => {
    const until = d('2026-10-01T00:00:00Z');
    const s = accessState({ status: 'TRIAL', accessUntil: until }, now);
    expect(s.phase).toBe('closed');
    expect(s.daysLeft).toBe(0);
    expect(s.deleteOn.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(s.daysUntilDeletion).toBe(21);
    expect(isClosed(until, now)).toBe(true);
    expect(isClosed(d('2026-10-11T12:00:01Z'), now)).toBe(false);
  });

  it('adds calendar months for deletion, clamping short months', () => {
    expect(deletionDate(d('2026-01-31T10:00:00Z')).toISOString()).toBe('2026-02-28T10:00:00.000Z');
  });

  it('extends from the current end date, or from today when already closed', () => {
    expect(extendAccess(d('2026-10-20T00:00:00Z'), 1, now).toISOString()).toBe(
      '2026-11-20T00:00:00.000Z',
    );
    expect(extendAccess(d('2026-09-01T00:00:00Z'), 12, now).toISOString()).toBe(
      '2027-10-11T12:00:00.000Z',
    );
  });

  it('never reports negative days', () => {
    expect(daysUntil(d('2026-01-01T00:00:00Z'), now)).toBe(0);
  });
});

describe('owner warning emails', () => {
  const now = new Date('2026-10-11T12:00:00Z');
  const none = { notifiedEndingAt: null, notifiedClosedAt: null, notifiedDeletionAt: null };
  const at = new Date('2026-10-01T00:00:00Z');

  it('warns 7 days before access ends, once', () => {
    expect(
      dueOwnerNotice({ accessUntil: new Date('2026-10-30T00:00:00Z'), ...none }, now),
    ).toBeNull();
    expect(dueOwnerNotice({ accessUntil: new Date('2026-10-17T00:00:00Z'), ...none }, now)).toBe(
      'ending',
    );
    expect(
      dueOwnerNotice(
        { accessUntil: new Date('2026-10-17T00:00:00Z'), ...none, notifiedEndingAt: at },
        now,
      ),
    ).toBeNull();
  });

  it('then on closing, then 7 days before deletion', () => {
    const closed = new Date('2026-10-05T00:00:00Z'); // deletion on 2026-11-05
    expect(dueOwnerNotice({ accessUntil: closed, ...none }, now)).toBe('closed');
    expect(dueOwnerNotice({ accessUntil: closed, ...none, notifiedClosedAt: at }, now)).toBeNull();
    const soon = new Date('2026-09-15T00:00:00Z'); // deletion on 2026-10-15
    expect(dueOwnerNotice({ accessUntil: soon, ...none, notifiedClosedAt: at }, now)).toBe(
      'deletion',
    );
    expect(
      dueOwnerNotice(
        { accessUntil: soon, ...none, notifiedClosedAt: at, notifiedDeletionAt: at },
        now,
      ),
    ).toBeNull();
  });
});
