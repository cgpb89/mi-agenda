'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { requireTenant } from '@/lib/auth/authorize';
import {
  deleteImage,
  getImage,
  signUpload,
  tenantPhotoFolder,
  type SignedUpload,
} from '@/lib/cloudinary';
import { getDb } from '@/lib/db/client';
import { withTransaction, type Tx } from '@/lib/db/tx';
import { isCloudinaryConfigured } from '@/lib/env';
import { AppError, runAction, type ActionResult } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { parseInput } from '@/lib/validation';
import { audit } from '@/modules/audit/audit';
import { msg } from '@/i18n/message-ref';
import { MAX_PHOTOS, movePhoto, readPhotos, type StoredPhoto } from './photos';

/*
 * Upload flow: (1) preparePhotoUploadAction signs a direct browser→Cloudinary
 * upload to a public_id inside this tenant's folder; (2) the browser uploads;
 * (3) addPhotoAction checks the public_id belongs to the tenant, confirms the
 * image exists with the Admin API (never trusting client-sent sizes) and saves it.
 */

function assertConfigured() {
  if (!isCloudinaryConfigured()) throw new AppError('POLICY', msg('photosUnavailable'));
}

/** Locks the profile row so concurrent adds can't exceed MAX_PHOTOS. */
async function lockPhotos(tx: Tx, tenantId: string): Promise<StoredPhoto[]> {
  await tx.$queryRaw`SELECT 1 FROM "app"."business_profiles" WHERE "tenant_id" = ${tenantId}::uuid FOR UPDATE`;
  const profile = await tx.businessProfile.findUniqueOrThrow({
    where: { tenantId },
    select: { photos: true },
  });
  return readPhotos(profile.photos);
}

async function savePhotos(tx: Tx, tenantId: string, photos: StoredPhoto[]) {
  await tx.businessProfile.update({
    where: { tenantId },
    data: { photos: photos as unknown as Prisma.InputJsonValue },
  });
}

function revalidate(tenantSlug: string) {
  revalidatePath(`/app/${tenantSlug}/booking-page`);
  revalidatePath(`/book/${tenantSlug}`);
}

export async function preparePhotoUploadAction(
  tenantSlug: string,
): Promise<ActionResult<SignedUpload>> {
  return runAction('preparePhotoUpload', async () => {
    const ctx = await requireTenant(tenantSlug, 'bookingPage.manage');
    assertConfigured();
    await enforceRateLimit('photoUploadByTenant', ctx.tenantId);
    const profile = await getDb().businessProfile.findUniqueOrThrow({
      where: { tenantId: ctx.tenantId },
      select: { photos: true },
    });
    if (readPhotos(profile.photos).length >= MAX_PHOTOS) {
      throw new AppError('POLICY', msg('photoLimit', { n: MAX_PHOTOS }));
    }
    return signUpload(ctx.tenantId);
  });
}

const publicIdSchema = z.object({
  publicId: z.string().regex(/^tempo\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/, msg('photoMissing')),
});

export async function addPhotoAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return runAction('addPhoto', async () => {
    const ctx = await requireTenant(tenantSlug, 'bookingPage.manage');
    assertConfigured();
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const { publicId } = parseInput(publicIdSchema, raw);
    if (!publicId.startsWith(`${tenantPhotoFolder(ctx.tenantId)}/`)) {
      throw new AppError('VALIDATION', msg('photoMissing'));
    }
    const image = await getImage(publicId);
    if (!image) throw new AppError('VALIDATION', msg('photoMissing'));

    const added = await withTransaction(async (tx) => {
      const photos = await lockPhotos(tx, ctx.tenantId);
      if (photos.some((p) => p.publicId === publicId)) return false;
      if (photos.length >= MAX_PHOTOS) return null;
      await savePhotos(tx, ctx.tenantId, [...photos, { id: randomUUID(), ...image }]);
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'booking_page.photo_added',
          targetType: 'tenant',
          targetId: ctx.tenantId,
          metadata: { publicId },
        },
        tx,
      );
      return true;
    });
    if (added === null) {
      // Lost a race for the last slot: don't leave the upload behind.
      await deleteImage(publicId);
      throw new AppError('POLICY', msg('photoLimit', { n: MAX_PHOTOS }));
    }
    revalidate(tenantSlug);
    return undefined;
  });
}

const photoIdSchema = z.object({ id: z.uuid(msg('photoMissing')) });

export async function removePhotoAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return runAction('removePhoto', async () => {
    const ctx = await requireTenant(tenantSlug, 'bookingPage.manage');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const { id } = parseInput(photoIdSchema, raw);
    const removed = await withTransaction(async (tx) => {
      const photos = await lockPhotos(tx, ctx.tenantId);
      const photo = photos.find((p) => p.id === id);
      if (!photo) return null;
      await savePhotos(
        tx,
        ctx.tenantId,
        photos.filter((p) => p.id !== id),
      );
      await audit(
        {
          tenantId: ctx.tenantId,
          actorUserId: ctx.userId,
          actorType: 'user',
          action: 'booking_page.photo_removed',
          targetType: 'tenant',
          targetId: ctx.tenantId,
          metadata: { publicId: photo.publicId },
        },
        tx,
      );
      return photo;
    });
    if (removed) await deleteImage(removed.publicId);
    revalidate(tenantSlug);
    return undefined;
  });
}

const moveSchema = photoIdSchema.extend({ direction: z.union([z.literal(-1), z.literal(1)]) });

export async function movePhotoAction(
  tenantSlug: string,
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return runAction('movePhoto', async () => {
    const ctx = await requireTenant(tenantSlug, 'bookingPage.manage');
    await enforceRateLimit('dashboardWriteByUser', ctx.userId);
    const { id, direction } = parseInput(moveSchema, raw);
    await withTransaction(async (tx) => {
      const photos = await lockPhotos(tx, ctx.tenantId);
      await savePhotos(tx, ctx.tenantId, movePhoto(photos, id, direction));
    });
    revalidate(tenantSlug);
    return undefined;
  });
}
