import 'server-only';
import { cache } from 'react';
import { getDb } from '@/lib/db/client';
import { AppError } from '@/lib/errors';
import { msg } from '@/i18n/message-ref';
import {
  PLAN_KEYS,
  hasFeature,
  parseFeatures,
  toEntitlements,
  type Entitlements,
  type FeatureKey,
  type PlanKey,
  type PlanSettings,
} from './features';

/** Used when a plan row is missing (shouldn't happen: the migration seeds all four). */
const FALLBACK: Omit<PlanSettings, 'plan'> = {
  priceCrcMinor: 0,
  priceUsdMinor: 0,
  staffLimit: 1,
  photoLimit: 3,
  features: [],
};

/** All four plans, read once per request. */
export const getPlanCatalog = cache(async (): Promise<PlanSettings[]> => {
  const rows = await getDb().planSettings.findMany();
  return PLAN_KEYS.map((plan) => {
    const r = rows.find((x) => x.plan === plan);
    return r
      ? {
          plan,
          priceCrcMinor: r.priceCrcMinor,
          priceUsdMinor: r.priceUsdMinor,
          staffLimit: r.staffLimit,
          photoLimit: r.photoLimit,
          features: parseFeatures(r.features),
        }
      : { plan, ...FALLBACK };
  });
});

export async function entitlementsFor(plan: PlanKey): Promise<Entitlements> {
  const catalog = await getPlanCatalog();
  return toEntitlements(catalog.find((p) => p.plan === plan)!);
}

/** Throws a POLICY error (shown to the user) when the plan lacks `key`. */
export async function requireFeature(ctx: { plan: PlanKey }, key: FeatureKey): Promise<void> {
  const e = await entitlementsFor(ctx.plan);
  if (!hasFeature(e, key)) throw new AppError('POLICY', msg('planFeature'));
}
