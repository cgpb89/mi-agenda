import { createHash } from 'node:crypto';

/**
 * Cloudinary request signature: params sorted by key, joined as `k=v&k=v`,
 * the API secret appended, SHA-1 hex. `file`, `api_key`, `resource_type` and
 * `cloud_name` are never part of the signature.
 */
export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1')
    .update(payload + apiSecret)
    .digest('hex');
}

/** Delivery URL for an uploaded image, resized to `width` (never upscaled). */
export function imageUrl(
  cloudName: string,
  publicId: string,
  version: number,
  opts: { width: number; height?: number; blur?: number },
): string {
  const size = opts.height
    ? `c_fill,g_auto,w_${opts.width},h_${opts.height}`
    : `c_limit,w_${opts.width}`;
  const t = opts.blur ? `${size}/e_blur:${opts.blur}` : size;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${t}/f_auto/q_auto/v${version}/${publicId}`;
}

/** Formats accepted for upload (Cloudinary converts on delivery with f_auto). */
export const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,heic,heif,avif';
/** Incoming transformation: originals larger than this are scaled down before storage. */
export const INCOMING_TRANSFORMATION = 'c_limit,w_2400,h_2400';

/**
 * Tag set on every signed upload. It is removed once the photo is saved to a
 * booking page; images still tagged after PENDING_MAX_AGE_MS were abandoned
 * (tab closed, save failed, signature used directly) and the daily job deletes them.
 */
export const PENDING_TAG = 'pending';
export const PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Parameters of a one-shot signed upload. Every key here is part of the signature. */
export function uploadParams(publicId: string, timestamp: number) {
  return {
    public_id: publicId,
    timestamp,
    allowed_formats: ALLOWED_FORMATS,
    transformation: INCOMING_TRANSFORMATION,
    tags: PENDING_TAG,
  };
}

/**
 * Public IDs of pending uploads that are old enough to delete. Only images in
 * our own folder (`prefix`) are ever selected; an unparsable date is kept.
 */
export function stalePendingIds(
  resources: { public_id: string; created_at: string }[],
  nowMs: number,
  prefix: string,
  maxAgeMs: number = PENDING_MAX_AGE_MS,
): string[] {
  return resources
    .filter((r) => {
      if (!r.public_id.startsWith(prefix)) return false;
      const created = Date.parse(r.created_at);
      return Number.isFinite(created) && nowMs - created > maxAgeMs;
    })
    .map((r) => r.public_id);
}

/** Split `items` into arrays of at most `size` (Cloudinary deletes up to 100 IDs per call). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
