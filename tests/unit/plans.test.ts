import { describe, expect, it } from 'vitest';
import {
  MAX_PHOTOS_CEILING,
  annualMonthly,
  canAddStaff,
  cheapestPlanWith,
  hasFeature,
  parseFeatures,
  toEntitlements,
  type PlanSettings,
} from '@/modules/plans/features';

const plan = (p: Partial<PlanSettings> & Pick<PlanSettings, 'plan'>): PlanSettings => ({
  priceCrcMinor: 0,
  priceUsdMinor: 0,
  staffLimit: 1,
  photoLimit: 3,
  features: [],
  ...p,
});

describe('plan entitlements', () => {
  it('drops unknown feature keys coming from the database', () => {
    expect(parseFeatures(['waitlist', 'retired', 3, 'glassStyle'])).toEqual([
      'waitlist',
      'glassStyle',
    ]);
    expect(parseFeatures(null)).toEqual([]);
  });

  it('turns settings into entitlements and caps photos at the ceiling', () => {
    const e = toEntitlements(plan({ plan: 'GROWTH', photoLimit: 99, features: ['glassStyle'] }));
    expect(hasFeature(e, 'glassStyle')).toBe(true);
    expect(hasFeature(e, 'waitlist')).toBe(false);
    expect(e.photoLimit).toBe(MAX_PHOTOS_CEILING);
  });

  it('checks the staff limit; null means unlimited', () => {
    expect(canAddStaff({ staffLimit: 1 }, 0)).toBe(true);
    expect(canAddStaff({ staffLimit: 1 }, 1)).toBe(false);
    expect(canAddStaff({ staffLimit: 5 }, 4)).toBe(true);
    expect(canAddStaff({ staffLimit: null }, 500)).toBe(true);
  });

  it('finds the cheapest paid plan with a feature, ignoring Trial', () => {
    const catalog = [
      plan({ plan: 'TRIAL', features: ['hideBranding'] }),
      plan({ plan: 'STARTER' }),
      plan({ plan: 'GROWTH', features: ['waitlist'] }),
      plan({ plan: 'BUSINESS', features: ['waitlist', 'hideBranding'] }),
    ];
    expect(cheapestPlanWith(catalog, 'waitlist')).toBe('GROWTH');
    expect(cheapestPlanWith(catalog, 'hideBranding')).toBe('BUSINESS');
    expect(cheapestPlanWith(catalog, 'glassStyle')).toBeNull();
  });

  it('computes the annual monthly price with 2 months free, per currency step', () => {
    expect(annualMonthly(850000, 10000)).toBe(710000); // ₡8 500 → ₡7 100
    expect(annualMonthly(1500000, 10000)).toBe(1250000); // ₡15 000 → ₡12 500
    expect(annualMonthly(1700, 100)).toBe(1400); // $17 → $14
    expect(annualMonthly(5900, 100)).toBe(4900); // $59 → $49
  });
});
