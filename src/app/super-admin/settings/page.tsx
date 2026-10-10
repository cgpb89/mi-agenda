import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/authorize';
import { listFlags, platformAuditLog } from '@/modules/platform/service';
import { PlatformSettingsView } from '@/components/features/admin/PlatformSettingsView';
import { isEmailConfigured } from '@/lib/env';
import { getDb } from '@/lib/db/client';

export const metadata: Metadata = { title: 'Settings & audit log' };

export default async function PlatformSettingsPage() {
  await requirePlatformAdminPage();
  const [flags, audit] = await Promise.all([listFlags(), platformAuditLog()]);
  let dbUp = true;
  try {
    await getDb().$queryRaw`SELECT 1`;
  } catch {
    dbUp = false;
  }
  return (
    <PlatformSettingsView
      flags={flags.map((f) => ({
        key: f.key,
        name: f.name,
        note: f.note ?? '',
        enabled: f.enabled,
      }))}
      audit={audit}
      health={[
        { n: 'Database', s: dbUp ? 'reachable' : 'unreachable' },
        { n: 'Email delivery', s: isEmailConfigured() ? 'configured' : 'not configured' },
        { n: 'Background jobs', s: '— none in this release' },
        { n: 'Error rate', s: '— not connected' },
      ]}
    />
  );
}
