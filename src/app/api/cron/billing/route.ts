import { NextResponse, type NextRequest } from 'next/server';
import {
  deleteImagesByPrefix,
  deleteStalePendingUploads,
  tenantPhotoFolder,
} from '@/lib/cloudinary';
import { getDb } from '@/lib/db/client';
import { isCloudinaryConfigured } from '@/lib/env';
import { rejectUnlessCron } from '@/lib/security/cron';
import { logger } from '@/lib/observability/logger';
import { audit } from '@/modules/audit/audit';
import { GRACE_MONTHS } from '@/modules/billing/access';
import { sendOwnerNotices } from '@/modules/billing/notices';

/**
 * Daily billing job (Vercel Cron, see vercel.json). Permanently deletes stores
 * whose trial or paid period ended more than a month ago without a payment.
 * The database function re-checks the dates, so a store that paid in the
 * meantime is never deleted. Afterwards it deletes photo uploads that were
 * never saved to a booking page (best effort, never blocks the purge).
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rejected = rejectUnlessCron(req);
  if (rejected) return rejected;

  // Owner warnings first (7 days before the end, on closing, before deletion).
  const noticesSent = await sendOwnerNotices();

  const db = getDb();
  const expired = await db.$queryRaw<{ id: string; slug: string; name: string }[]>`
    SELECT id, slug, name FROM "app"."tenants"
    WHERE access_until + make_interval(months => ${GRACE_MONTHS}) <= now()
    ORDER BY access_until
    LIMIT 50`;

  const deleted: string[] = [];
  for (const t of expired) {
    try {
      const rows = await db.$queryRaw<{ purged: boolean }[]>`
        SELECT "app"."purge_expired_tenant"(${t.id}::uuid) AS purged`;
      if (!rows[0]?.purged) continue;
      const photosDeleted = isCloudinaryConfigured()
        ? await deleteImagesByPrefix(`${tenantPhotoFolder(t.id)}/`)
        : true;
      await audit({
        tenantId: null,
        actorType: 'system',
        action: 'tenant.deleted',
        targetType: 'tenant',
        targetId: t.id,
        metadata: { slug: t.slug, name: t.name, reason: 'unpaid', photosDeleted },
      });
      deleted.push(t.slug);
    } catch (err) {
      logger.error('billing: failed to delete expired tenant', {
        tenantId: t.id,
        error: err instanceof Error ? err : String(err),
      });
    }
  }
  if (deleted.length) logger.info('billing: deleted expired tenants', { count: deleted.length });

  // Abandoned photo uploads (still tagged `pending` after 24 h). Runs after the
  // purge and never throws; images a booking page references are always kept.
  let pendingDeleted = 0;
  if (isCloudinaryConfigured()) {
    const res = await deleteStalePendingUploads(async (ids) => {
      const rows = await db.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT p->>'publicId' AS id
        FROM "app"."business_profiles" bp, jsonb_array_elements(bp.photos) AS p
        WHERE p->>'publicId' = ANY(${ids}::text[])
        UNION
        SELECT bp.logo->>'publicId' AS id
        FROM "app"."business_profiles" bp
        WHERE bp.logo->>'publicId' = ANY(${ids}::text[])`;
      return new Set(rows.map((r) => r.id));
    });
    pendingDeleted = res.deleted;
    if (res.deleted) logger.info('billing: deleted abandoned uploads', { count: res.deleted });
  }

  return NextResponse.json(
    { ok: true, noticesSent, deleted: deleted.length, pendingDeleted },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
