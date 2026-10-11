'use client';

import Link from 'next/link';
import { PageContent, PageHeader, useShell } from '@/components/layout/AppShell';
import { buttonClass } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useI18n } from '@/i18n/client';
import { PLAN_LABELS } from '@/modules/platform/constants';
import type { PlanKey } from '@/modules/plans/features';

/** Shown in place of (or above) a feature the business's plan doesn't include. */
export function UpgradeCard({ plan, body }: { plan: PlanKey | null; body?: string }) {
  const { data } = useShell();
  const { t } = useI18n();
  const p = t.app.plans;
  const name = plan ? (t.settings.plans[plan] ?? PLAN_LABELS[plan]) : null;
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            color: '#c4581f',
          }}
        >
          {name ? p.availableFrom({ plan: name }) : p.upgradeBody}
        </span>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: '#3a352e' }}>
          {body ?? p.upgradeBody}
        </p>
        <Link
          href={`/app/${data.tenant.slug}/billing`}
          className={buttonClass({ variant: 'primary' })}
        >
          {p.seePlans}
        </Link>
      </div>
    </Card>
  );
}

/** A whole dashboard page replaced by an upgrade prompt. */
export function LockedPage({
  title,
  plan,
  body,
}: {
  title: string;
  plan: PlanKey | null;
  body?: string;
}) {
  return (
    <>
      <PageHeader title={title} hideNew />
      <PageContent>
        <UpgradeCard plan={plan} body={body} />
      </PageContent>
    </>
  );
}
