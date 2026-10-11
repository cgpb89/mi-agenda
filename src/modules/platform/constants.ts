import type { PlanKey } from '@/modules/plans/features';

export { PLAN_KEYS, type PlanKey } from '@/modules/plans/features';

/**
 * Fallback plan names. Prices, limits and features are in app.plan_settings
 * (Super-admin → Plans); localized names in i18n settings.plans.
 */
export const PLAN_LABELS: Record<PlanKey, string> = {
  TRIAL: 'Trial',
  STARTER: 'Starter',
  GROWTH: 'Growth',
  BUSINESS: 'Business',
};

export const DEFAULT_FLAGS = [
  { key: 'newEditor', name: 'New booking-page editor', note: 'All tenants', enabled: true },
  { key: 'multiLoc', name: 'Multiple locations', note: 'Business plan only', enabled: true },
  { key: 'waitlist', name: 'Waitlist', note: 'Planned · internal testing', enabled: false },
  { key: 'gcal', name: 'Google Calendar sync', note: 'Planned integration', enabled: false },
  { key: 'payments', name: 'Online payments', note: 'Planned integration', enabled: false },
];
