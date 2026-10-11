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
  opts: { width: number; height?: number },
): string {
  const t = opts.height
    ? `c_fill,g_auto,w_${opts.width},h_${opts.height}`
    : `c_limit,w_${opts.width}`;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${t}/f_auto/q_auto/v${version}/${publicId}`;
}
