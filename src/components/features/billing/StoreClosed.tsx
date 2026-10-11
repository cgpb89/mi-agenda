import { PageContent, PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/Form';
import type { ReactNode } from 'react';
import type { Messages } from '@/i18n/messages';

/** Shown instead of every dashboard page while the store is closed (unpaid). */
export function StoreClosed({
  t,
  closedOn,
  deleteOn,
  daysUntilDeletion,
  supportEmail,
  pay,
}: {
  t: Messages['app']['billing'];
  closedOn: string;
  deleteOn: string;
  daysUntilDeletion: number;
  supportEmail: string | null;
  /** Payment instructions (owners only). */
  pay?: ReactNode;
}) {
  return (
    <>
      <PageHeader title={t.closedTitle} hideNew />
      <PageContent>
        <Card>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
            {t.closedBody({ date: closedOn })}
          </p>
          <FormMessage kind="warning">
            {t.closedDeletion({ date: deleteOn, n: daysUntilDeletion })}
          </FormMessage>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
            {t.closedHow}{' '}
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`} style={{ fontWeight: 600, color: '#c4581f' }}>
                {supportEmail}
              </a>
            ) : null}
          </p>
        </Card>
        {pay}
      </PageContent>
    </>
  );
}
