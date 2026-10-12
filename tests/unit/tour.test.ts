import { describe, expect, it } from 'vitest';
import { TOURS, readTourProgress, stepsFor, tourFor } from '@/modules/tour/steps';

describe('guided tour', () => {
  it('gives staff their own short tour', () => {
    expect(tourFor('STAFF')).toBe('staff');
    expect(tourFor('OWNER')).toBe('setup');
    expect(tourFor('MANAGER')).toBe('setup');
  });

  it('shows billing to owners only', () => {
    const owner = stepsFor('setup', 'OWNER').map((s) => s.id);
    const manager = stepsFor('setup', 'MANAGER').map((s) => s.id);
    expect(owner).toContain('billing');
    expect(manager).not.toContain('billing');
    expect(manager).toContain('services');
    expect(owner.at(-1)).toBe('done');
  });

  it('keeps every step id unique within a tour', () => {
    for (const steps of Object.values(TOURS)) {
      expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    }
  });

  it('reads stored progress defensively', () => {
    expect(readTourProgress({ setup: { step: 3, done: false } })).toEqual({
      setup: { step: 3, done: false },
    });
    expect(readTourProgress('garbage')).toEqual({});
    expect(readTourProgress({ setup: { step: -1, done: false } })).toEqual({});
  });
});
