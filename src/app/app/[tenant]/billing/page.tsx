import type { Metadata } from 'next';
import { requireTenantPage } from '@/lib/auth/authorize';
import { PageContent, PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import tbl from '@/components/ui/Table.module.scss';
import { PayInstructions } from '@/components/features/billing/PayInstructions';
import { accessState } from '@/modules/billing/access';
import { FEATURE_KEYS, PAID_PLANS } from '@/modules/plans/features';
import { getPlanCatalog } from '@/modules/plans/service';
import { PLAN_LABELS } from '@/modules/platform/constants';
import { getPlatformSettings } from '@/modules/platform/settings';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.app.nav.billing };
}

/** "₡15 000" or "$29" (landing-page style). */
function price(minor: number, currency: 'CRC' | 'USD'): string {
  const major = Math.round(minor / 100);
  return currency === 'CRC'
    ? `₡${String(major).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`
    : `$${major}`;
}

export default async function BillingPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const ctx = await requireTenantPage(tenant, 'billing.view');
  const [{ t, intl, locale }, catalog, settings] = await Promise.all([
    getI18n(),
    getPlanCatalog(),
    getPlatformSettings(),
  ]);
  const b = t.app.billingPage;
  const featureName = (k: string) => t.admin.plans.featureNames[k]?.[0] ?? k;
  const planName = (p: keyof typeof PLAN_LABELS) => t.settings.plans[p] ?? PLAN_LABELS[p];
  const current = catalog.find((c) => c.plan === ctx.plan)!;
  const access = accessState(ctx);
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat(intl, { dateStyle: 'long', timeZone: ctx.timezone }).format(d);
  const currency = locale === 'es' ? 'CRC' : 'USD';
  const paid = PAID_PLANS.map((p) => catalog.find((c) => c.plan === p)!);

  return (
    <>
      <PageHeader title={b.title} hideNew />
      <PageContent>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <Card title={b.yourPlan}>
            <span style={{ fontSize: 24, fontWeight: 800 }}>{planName(ctx.plan)}</span>
            <span
              style={{ fontWeight: 600, color: access.phase === 'closed' ? '#b3261e' : undefined }}
            >
              {access.phase === 'closed'
                ? b.closedSince({ date: fmtDate(access.accessUntil) })
                : (access.phase === 'trial' ? b.trialUntil : b.paidUntil)({
                    date: fmtDate(access.accessUntil),
                    n: access.daysLeft,
                  })}
            </span>
            <span style={{ color: '#5d564b' }}>
              {b.staff({
                n: current.staffLimit === null ? b.unlimited : String(current.staffLimit),
              })}
              {' · '}
              {b.photos({ n: current.photoLimit })}
            </span>
            {current.features.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#5d564b' }}>
                  {b.included}
                </span>
                {current.features.map((f) => (
                  <span key={f} style={{ fontSize: 14 }}>
                    <span style={{ color: '#2f6e5a' }}>✓</span> {featureName(f)}
                  </span>
                ))}
              </div>
            ) : null}
          </Card>
          <PayInstructions
            t={b}
            settings={settings}
            slug={ctx.tenantSlug}
            business={ctx.tenantName}
          />
        </div>

        <Card title={b.plans} flush>
          <div className={tbl.wrap}>
            <table className={tbl.table}>
              <thead>
                <tr>
                  <th />
                  {paid.map((p) => (
                    <th key={p.plan}>
                      {planName(p.plan)}
                      {p.plan === ctx.plan ? ` · ${b.current}` : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{b.perMonth}</td>
                  {paid.map((p) => (
                    <td key={p.plan} style={{ fontWeight: 700 }}>
                      {price(currency === 'CRC' ? p.priceCrcMinor : p.priceUsdMinor, currency)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>{t.admin.plans.staffLimit}</td>
                  {paid.map((p) => (
                    <td key={p.plan}>{p.staffLimit === null ? b.unlimited : p.staffLimit}</td>
                  ))}
                </tr>
                <tr>
                  <td>{t.admin.plans.photoLimit}</td>
                  {paid.map((p) => (
                    <td key={p.plan}>{p.photoLimit}</td>
                  ))}
                </tr>
                {FEATURE_KEYS.map((f) => (
                  <tr key={f}>
                    <td>{featureName(f)}</td>
                    {paid.map((p) => (
                      <td key={p.plan} aria-label={p.features.includes(f) ? '✓' : '—'}>
                        {p.features.includes(f) ? '✓' : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </PageContent>
    </>
  );
}
