import 'server-only';
import { randomUUID } from 'node:crypto';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/observability/logger';
import { PENDING_TAG, chunk, signParams, stalePendingIds, uploadParams } from './sign';

export { imageUrl } from './sign';

const API = 'https://api.cloudinary.com/v1_1';
/** Prefix shared by every tenant folder (see tenantPhotoFolder). */
const ROOT_PREFIX = 'tempo/';
/** Safety bounds for paged Admin API loops (one cron run must stay short). */
const MAX_PAGES = 20;

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

function adminAuth(apiKey: string, apiSecret: string): string {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
}

export function cloudName(): string {
  return config().cloudName;
}

/** Folder that holds one tenant's photos; also the public_id prefix we verify on save. */
export function tenantPhotoFolder(tenantId: string): string {
  return `${ROOT_PREFIX}${tenantId}`;
}

export interface SignedUpload {
  url: string;
  fields: Record<string, string>;
}

/**
 * A one-shot signed upload to a server-chosen public_id. The browser posts the
 * file directly to Cloudinary, so the bytes never pass through our functions.
 * Cloudinary rejects signatures older than one hour. The upload is tagged
 * `pending` until addPhotoAction saves it (see removePendingTag).
 */
export function signUpload(tenantId: string, name: string = randomUUID()): SignedUpload {
  const { cloudName, apiKey, apiSecret } = config();
  const params = uploadParams(
    `${tenantPhotoFolder(tenantId)}/${name}`,
    Math.floor(Date.now() / 1000),
  );
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
    headers: { Authorization: adminAuth(apiKey, apiSecret) },
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

/**
 * Remove the `pending` tag from a saved photo (signed Upload API `tags` call).
 * Best effort: on failure the daily cleanup still skips images that a booking
 * page references, so a saved photo is never deleted.
 */
export async function removePendingTag(publicId: string): Promise<void> {
  try {
    const { cloudName, apiKey, apiSecret } = config();
    const params = {
      command: 'remove',
      public_ids: publicId,
      tag: PENDING_TAG,
      timestamp: Math.floor(Date.now() / 1000),
    };
    const body = new FormData();
    body.append('command', params.command);
    body.append('public_ids[]', params.public_ids);
    body.append('tag', params.tag);
    body.append('timestamp', String(params.timestamp));
    body.append('api_key', apiKey);
    body.append('signature', signParams(params, apiSecret));
    const res = await fetch(`${API}/${cloudName}/image/tags`, { method: 'POST', body });
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    logger.error('cloudinary untag failed', {
      publicId,
      error: err instanceof Error ? err : String(err),
    });
  }
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

interface BulkDeleteResponse {
  deleted?: Record<string, string>;
  partial?: boolean;
  next_cursor?: string;
}

/**
 * Delete every image under `prefix` (a deleted store's folder). Follows
 * Cloudinary's paging (up to 1000 deletions per call, `partial` + `next_cursor`
 * while more remain). Best effort: returns false, and logs, when it could not
 * finish.
 */
export async function deleteImagesByPrefix(prefix: string): Promise<boolean> {
  try {
    const { cloudName, apiKey, apiSecret } = config();
    let cursor: string | undefined;
    let deleted = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const qs = new URLSearchParams({ prefix });
      if (cursor) qs.set('next_cursor', cursor);
      const res = await fetch(`${API}/${cloudName}/resources/image/upload?${qs}`, {
        method: 'DELETE',
        headers: { Authorization: adminAuth(apiKey, apiSecret) },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = (await res.json()) as BulkDeleteResponse;
      deleted += Object.keys(body.deleted ?? {}).length;
      if (!body.partial) return true;
      cursor = body.next_cursor;
      if (!cursor) break;
    }
    logger.warn('cloudinary prefix delete incomplete', { prefix, deleted });
    return false;
  } catch (err) {
    logger.error('cloudinary prefix delete failed', {
      prefix,
      error: err instanceof Error ? err : String(err),
    });
    return false;
  }
}

/**
 * Daily cleanup: delete uploads still tagged `pending` after 24 hours (never
 * saved to a booking page). `inUse` returns the IDs a booking page still
 * references; those are always kept, even if untagging failed. Best effort.
 */
export async function deleteStalePendingUploads(
  inUse: (publicIds: string[]) => Promise<Set<string>>,
  now: Date = new Date(),
): Promise<{ deleted: number; complete: boolean }> {
  let deleted = 0;
  try {
    const { cloudName, apiKey, apiSecret } = config();
    const auth = adminAuth(apiKey, apiSecret);
    const stale: string[] = [];
    let cursor: string | undefined;
    let listed = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const qs = new URLSearchParams({ max_results: '500' });
      if (cursor) qs.set('next_cursor', cursor);
      const res = await fetch(
        `${API}/${cloudName}/resources/image/tags/${encodeURIComponent(PENDING_TAG)}?${qs}`,
        { headers: { Authorization: auth }, cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`list status ${res.status}`);
      const body = (await res.json()) as {
        resources?: { public_id: string; created_at: string }[];
        next_cursor?: string;
      };
      stale.push(...stalePendingIds(body.resources ?? [], now.getTime(), ROOT_PREFIX));
      cursor = body.next_cursor;
      if (!cursor) {
        listed = true;
        break;
      }
    }

    const keep = stale.length ? await inUse(stale) : new Set<string>();
    const toDelete = stale.filter((id) => !keep.has(id));
    let complete = listed;
    for (const ids of chunk(toDelete, 100)) {
      const qs = new URLSearchParams({ invalidate: 'true' });
      for (const id of ids) qs.append('public_ids[]', id);
      const res = await fetch(`${API}/${cloudName}/resources/image/upload?${qs}`, {
        method: 'DELETE',
        headers: { Authorization: auth },
      });
      if (!res.ok) throw new Error(`delete status ${res.status}`);
      const body = (await res.json()) as BulkDeleteResponse;
      deleted += Object.values(body.deleted ?? {}).filter((v) => v === 'deleted').length;
      if (body.partial) complete = false;
    }
    if (!complete) logger.warn('cloudinary pending cleanup incomplete', { deleted });
    return { deleted, complete };
  } catch (err) {
    logger.error('cloudinary pending cleanup failed', {
      deleted,
      error: err instanceof Error ? err : String(err),
    });
    return { deleted, complete: false };
  }
}
