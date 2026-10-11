'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { requireTenant } from '@/lib/auth/authorize';
import {
  deleteImage,
  getImage,
  removePendingTag,
  signUpload,
  tenantPhotoFolder,
  type SignedUpload,
} from '@/lib/cloudinary';
import { withTransaction } from '@/lib/db/tx';
import { isCloudinaryConfigured } from '@/lib/env';
import { AppError, runAction, type ActionResult } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { parseInput } from '@/lib/validation';
import { audit } from '@/modules/audit/audit';
import { requireFeature } from '@/modules/plans/service';
import { msg } from '@/i18n/message-ref';
import { readLogo } from './photos';

/*
 * Booking-page logo (plan feature `brandColors`). Same direct-upload flow as
 * photos (see photo-actions.ts): the server signs an upload to
 * tempo/<tenant>/logo-<uuid>, the browser uploads, and setLogoAction verifies
 * and saves it, replacing (and deleting) any previous logo.
 */

function revalidate(tenantSlug: string) {
  revalidatePath(`/app/${tenantSlug}/booking-page`);
  revalidatePath(`/book/${tenantSlug}`);
}

export async function prepareLogoUploadAction(
  tenantSlug: string,
): Promise<ActionResult<SignedUpload>> {
  return runAction('prepareLogoUpload', async () => {
    const ctx = await requireTenant(tenantSlug, 'bookingPage.manage');
    if (!isCloudinaryConfigured()) throw new AppError('POLICY', msg('photosUnavailable'));
    await requireFeature(ctx, 'brandColors');
    await enforceRateLimit('photoUploadByTenant', ctx.tenantId);
    return signUpload(ctx.tenantId, `logo-${randomUUID()}`);
  });
}

const logoIdSchema = z.object({
  publicId: z.string().regex(/^tempo\/[0-9a-f-]{36}\/logo-[0-9a-f-]{36}$/, msg('photoMissing')),
});

export async function setLogoAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return runAction('setLogo', async () => {
    const ctx = await requireTenant(tenantSlug, 'bookingPage.manage');
    if (!isCloudinaryConfigured()) throw new AppError('POLICY', msg('photosUnavailable'));
    await requireFeature(ctx, 'brandColors');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const { publicId } = parseInput(logoIdSchema, raw);
    if (!publicId.startsWith(`${tenantPhotoFolder(ctx.tenantId)}/`)) {
      throw new AppError('VALIDATION', msg('photoMissing'));
    }
    const image = await getImage(publicId);
    if (!image) throw new AppError('VALIDATION', msg('photoMissing'));

    const previous = await withTransaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "app"."business_profiles" WHERE "tenant_id" = ${ctx.tenantId}::uuid FOR UPDATE`;
      const profile = await tx.businessProfile.findUniqueOrThrow({
        where: { tenantId: ctx.tenantId },
        select: { logo: true },
      });
      const old = readLogo(profile.logo);
      await tx.businessProfile.update({
        where: { tenantId: ctx.tenantId },
        data: { logo: { id: randomUUID(), ...image } as unknown as Prisma.InputJsonValue },
      });
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'booking_page.updated',
          targetType: 'tenant',
          targetId: ctx.tenantId,
          metadata: { logo: publicId },
        },
        tx,
      );
      return old;
    });
    await removePendingTag(publicId);
    if (previous && previous.publicId !== publicId) await deleteImage(previous.publicId);
    revalidate(tenantSlug);
    return undefined;
  });
}

/** Removing a logo is always allowed, also after a downgrade. */
export async function removeLogoAction(tenantSlug: string): Promise<ActionResult<undefined>> {
  return runAction('removeLogo', async () => {
    const ctx = await requireTenant(tenantSlug, 'bookingPage.manage');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const previous = await withTransaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "app"."business_profiles" WHERE "tenant_id" = ${ctx.tenantId}::uuid FOR UPDATE`;
      const profile = await tx.businessProfile.findUniqueOrThrow({
        where: { tenantId: ctx.tenantId },
        select: { logo: true },
      });
      await tx.businessProfile.update({
        where: { tenantId: ctx.tenantId },
        data: { logo: Prisma.DbNull },
      });
      return readLogo(profile.logo);
    });
    if (previous) await deleteImage(previous.publicId);
    revalidate(tenantSlug);
    return undefined;
  });
}
