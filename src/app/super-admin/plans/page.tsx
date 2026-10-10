import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/authorize';
import { AdminHeader } from '@/components/features/admin/AdminShell';
import s from '@/components/features/admin/Admin.module.scss';

export const metadata: Metadata = { title: 'Plans' };

export default async function PlansPage() {
  await requirePlatformAdminPage();
  return (
    <>
      <AdminHeader title="Plans" />
      <div className={s.content}>
        <div className={s.later}>
          <span>DESIGNED IN THE NEXT PASS</span>
          <span>Plans</span>
          <span>
            Configure plan name, price, billing interval, appointment and staff limits, feature
            availability, trial length and status. Prices stay placeholders until launch.
          </span>
        </div>
      </div>
    </>
  );
}
