/**
 * Plan features and limits (pure, client-safe).
 *
 * Which plan includes what lives in the database (app.plan_settings) and is
 * edited by platform admins in Super-admin → Plans. This file only lists the
 * features the code knows how to enforce. To add one: add its key here, add
 * labels in i18n (admin.plans.features.<key>), and check it where it applies
 * with `hasFeature` / `requireFeature`.
 */
export const FEATURE_KEYS = [
  'customerDirectory',
  'fullAnalytics',
  'brandColors',
  'glassStyle',
  'emailReminders',
  'sinpeDeposits',
  'waitlist',
  'hideBranding',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const PLAN_KEYS = ['TRIAL', 'STARTER', 'GROWTH', 'BUSINESS'] as const;
export type PlanKey = (typeof PLAN_KEYS)[number];

/** Plans a business can buy, in upgrade order (Trial is not sold). */
export const PAID_PLANS = ['STARTER', 'GROWTH', 'BUSINESS'] as const satisfies readonly PlanKey[];

/** Hard ceiling for photos, also enforced by a CHECK constraint. */
export const MAX_PHOTOS_CEILING = 20;

export interface PlanSettings {
  plan: PlanKey;
  priceCrcMinor: number;
  priceUsdMinor: number;
  /** null = unlimited. */
  staffLimit: number | null;
  photoLimit: number;
  features: FeatureKey[];
}

export interface Entitlements {
  plan: PlanKey;
  features: ReadonlySet<FeatureKey>;
  staffLimit: number | null;
  photoLimit: number;
}

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === 'string' && (FEATURE_KEYS as readonly string[]).includes(value);
}

/** Feature list from the database, dropping keys this code no longer knows. */
export function parseFeatures(raw: unknown): FeatureKey[] {
  return Array.isArray(raw) ? raw.filter(isFeatureKey) : [];
}

export function toEntitlements(s: PlanSettings): Entitlements {
  return {
    plan: s.plan,
    features: new Set(s.features),
    staffLimit: s.staffLimit,
    photoLimit: Math.min(s.photoLimit, MAX_PHOTOS_CEILING),
  };
}

export function hasFeature(e: Pick<Entitlements, 'features'>, key: FeatureKey): boolean {
  return e.features.has(key);
}

/** True when adding one more active staff member stays within the plan. */
export function canAddStaff(e: Pick<Entitlements, 'staffLimit'>, activeStaff: number): boolean {
  return e.staffLimit === null || activeStaff < e.staffLimit;
}

/** Cheapest paid plan that includes `key` (for "available from Growth" prompts). */
export function cheapestPlanWith(catalog: PlanSettings[], key: FeatureKey): PlanKey | null {
  for (const p of PAID_PLANS) {
    if (catalog.find((c) => c.plan === p)?.features.includes(key)) return p;
  }
  return null;
}

/**
 * Monthly-equivalent price when paying a year upfront (2 months free), rounded
 * to `stepMinor` (₡100 = 10000 for colones, $1 = 100 for dollars).
 */
export function annualMonthly(priceMinor: number, stepMinor: number): number {
  return Math.round((priceMinor * 10) / 12 / stepMinor) * stepMinor;
}
