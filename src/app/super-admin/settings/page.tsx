import type { Metadata } from 'next';
import { requirePlatformAdminPage } from '@/lib/auth/authorize';
import { listFlags, platformAuditLog } from '@/modules/platform/service';
import { getPlatformSettings } from '@/modules/platform/settings';
import { PlatformSettingsView } from '@/components/features/admin/PlatformSettingsView';
import { isEmailConfigured } from '@/lib/env';
import { getDb } from '@/lib/db/client';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.nav.settings };
}

export default async function PlatformSettingsPage() {
  await requirePlatformAdminPage();
  const [flags, audit, payment] = await Promise.all([
    listFlags(),
    platformAuditLog(),
    getPlatformSettings(),
  ]);
  let dbUp = true;
  try {
    await getDb().$queryRaw`SELECT 1`;
  } catch {
    dbUp = false;
  }
  return (
    <PlatformSettingsView
      payment={{
        supportEmail: payment.supportEmail ?? '',
        supportWhatsapp: payment.supportWhatsapp ?? '',
        sinpePhone: payment.sinpePhone ?? '',
        sinpeName: payment.sinpeName ?? '',
        paymentNote: payment.paymentNote ?? '',
      }}
      flags={flags.map((f) => ({
        key: f.key,
        name: f.name,
        note: f.note ?? '',
        enabled: f.enabled,
      }))}
      audit={audit}
      health={[
        { n: 'database', s: dbUp ? 'reachable' : 'unreachable' },
        { n: 'email', s: isEmailConfigured() ? 'configured' : 'notConfigured' },
        { n: 'jobs', s: 'noJobs' },
        { n: 'errors', s: 'notConnected' },
      ]}
    />
  );
}
