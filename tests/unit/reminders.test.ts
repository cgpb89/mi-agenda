import { describe, expect, it } from 'vitest';
import { reminderWindow } from '@/modules/reminders/window';

describe('reminder window', () => {
  it('covers appointments starting 23 to 25 hours from now', () => {
    const now = new Date('2026-10-11T12:00:00Z');
    const w = reminderWindow(now);
    expect(w.from.toISOString()).toBe('2026-10-12T11:00:00.000Z');
    expect(w.to.toISOString()).toBe('2026-10-12T13:00:00.000Z');
  });

  it('overlaps consecutive hourly runs so nothing slips between them', () => {
    const a = reminderWindow(new Date('2026-10-11T12:05:00Z'));
    const b = reminderWindow(new Date('2026-10-11T13:05:00Z'));
    expect(b.from.getTime()).toBeLessThan(a.to.getTime());
  });
});
