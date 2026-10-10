import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/authorize';
import { AdminHeader } from '@/components/features/admin/AdminShell';
import s from '@/components/features/admin/Admin.module.scss';

export const metadata: Metadata = { title: 'Templates' };

export default async function TemplatesPage() {
  await requirePlatformAdminPage();
  return (
    <>
      <AdminHeader title="Templates" />
      <div className={s.content}>
        <div className={s.later}>
          <span>DESIGNED IN THE NEXT PASS</span>
          <span>Templates</span>
          <span>
            Enable or retire each of the five booking templates, set category defaults and see how
            many businesses use each.
          </span>
        </div>
      </div>
    </>
  );
}
