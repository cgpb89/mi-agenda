import 'server-only';
import { cache } from 'react';
import { getDb } from '@/lib/db/client';
import { getEnv } from '@/lib/env';

/** How businesses pay their plan and reach support (Super-admin → Settings). */
export interface PlatformSettings {
  supportEmail: string | null;
  supportWhatsapp: string | null;
  sinpePhone: string | null;
  sinpeName: string | null;
  paymentNote: string | null;
}

export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  const row = await getDb().platformSettings.findUnique({ where: { id: 1 } });
  return {
    // The env var is the fallback from before this was editable.
    supportEmail: row?.supportEmail || getEnv().SUPPORT_EMAIL || null,
    supportWhatsapp: row?.supportWhatsapp || null,
    sinpePhone: row?.sinpePhone || null,
    sinpeName: row?.sinpeName || null,
    paymentNote: row?.paymentNote || null,
  };
});
