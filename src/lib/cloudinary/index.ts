import 'server-only';
import { randomUUID } from 'node:crypto';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/observability/logger';
import { signParams } from './sign';

export { imageUrl } from './sign';

/** Formats accepted for upload (Cloudinary converts on delivery with f_auto). */
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,heic,heif,avif';
/** Incoming transformation: originals larger than this are scaled down before storage. */
const INCOMING = 'c_limit,w_2400,h_2400';
const API = 'https://api.cloudinary.com/v1_1';

function config() {
  const env = getEnv();
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary is not configured');
  }
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  };
}

export function cloudName(): string {
  return config().cloudName;
}

/** Folder that holds one tenant's photos; also the public_id prefix we verify on save. */
export function tenantPhotoFolder(tenantId: string): string {
  return `tempo/${tenantId}`;
}

export interface SignedUpload {
  url: string;
  fields: Record<string, string>;
}

/**
 * A one-shot signed upload to a server-chosen public_id. The browser posts the
 * file directly to Cloudinary, so the bytes never pass through our functions.
 * Cloudinary rejects signatures older than one hour.
 */
export function signUpload(tenantId: string): SignedUpload {
  const { cloudName, apiKey, apiSecret } = config();
  const params = {
    public_id: `${tenantPhotoFolder(tenantId)}/${randomUUID()}`,
    timestamp: Math.floor(Date.now() / 1000),
    allowed_formats: ALLOWED_FORMATS,
    transformation: INCOMING,
  };
  return {
    url: `${API}/${cloudName}/image/upload`,
    fields: {
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      api_key: apiKey,
      signature: signParams(params, apiSecret),
    },
  };
}

export interface UploadedImage {
  publicId: string;
  version: number;
  width: number;
  height: number;
}

/** Look up an uploaded image with the Admin API. Returns null when it doesn't exist. */
export async function getImage(publicId: string): Promise<UploadedImage | null> {
  const { cloudName, apiKey, apiSecret } = config();
  const path = publicId.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${API}/${cloudName}/resources/image/upload/${path}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cloudinary lookup failed with status ${res.status}`);
  const body = (await res.json()) as {
    public_id: string;
    version: number;
    width: number;
    height: number;
  };
  return {
    publicId: body.public_id,
    version: body.version,
    width: body.width,
    height: body.height,
  };
}

/** Delete an image and purge it from the CDN. Best effort: failures are logged, not thrown. */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    const { cloudName, apiKey, apiSecret } = config();
    const params = {
      public_id: publicId,
      timestamp: Math.floor(Date.now() / 1000),
      invalidate: 'true',
    };
    const body = new FormData();
    for (const [k, v] of Object.entries(params)) body.append(k, String(v));
    body.append('api_key', apiKey);
    body.append('signature', signParams(params, apiSecret));
    const res = await fetch(`${API}/${cloudName}/image/destroy`, { method: 'POST', body });
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    logger.error('cloudinary delete failed', {
      publicId,
      error: err instanceof Error ? err : String(err),
    });
  }
}

/** Delete every image under `prefix` (a deleted store's folder). Best effort. */
export async function deleteImagesByPrefix(prefix: string): Promise<void> {
  try {
    const { cloudName, apiKey, apiSecret } = config();
    const url = `${API}/${cloudName}/resources/image/upload?prefix=${encodeURIComponent(prefix)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
      },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    logger.error('cloudinary prefix delete failed', {
      prefix,
      error: err instanceof Error ? err : String(err),
    });
  }
}
