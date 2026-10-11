import { z } from 'zod';
import { MAX_PHOTOS_CEILING } from '@/modules/plans/features';

/**
 * Booking-page photos stored in BusinessProfile.photos (JSON array, in display
 * order; the first one is the cover). The images themselves live in Cloudinary.
 */
// How many a business may have depends on its plan (photoLimit); this is the
// absolute ceiling, also enforced by a CHECK constraint.
export const MAX_PHOTOS = MAX_PHOTOS_CEILING;

export const storedPhotoSchema = z.object({
  id: z.uuid(),
  publicId: z.string().max(255),
  version: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export type StoredPhoto = z.infer<typeof storedPhotoSchema>;

export function readPhotos(raw: unknown): StoredPhoto[] {
  const parsed = z.array(storedPhotoSchema).max(MAX_PHOTOS).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

/** Move the photo `id` one place left (-1) or right (+1). Returns a new array. */
export function movePhoto<T extends { id: string }>(
  photos: T[],
  id: string,
  direction: -1 | 1,
): T[] {
  const from = photos.findIndex((p) => p.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= photos.length) return photos;
  const next = [...photos];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
