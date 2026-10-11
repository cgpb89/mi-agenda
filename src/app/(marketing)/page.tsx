import { Landing, type LandingPrices } from '@/components/features/landing/Landing';
import { PAID_PLANS } from '@/modules/plans/features';
import { getPlanCatalog } from '@/modules/plans/service';

export default async function HomePage() {
  // Prices come from Super-admin → Plans, in the order the landing lists them.
  const catalog = await getPlanCatalog();
  const prices: LandingPrices = PAID_PLANS.map((plan) => {
    const p = catalog.find((c) => c.plan === plan)!;
    return { crcMinor: p.priceCrcMinor, usdMinor: p.priceUsdMinor };
  });
  return <Landing prices={prices} />;
}
