import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256-bit opaque bearer token, URL-safe. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Keyed hash used to store bearer tokens (sessions, resets, invites, booking
 * manage links). A DB leak alone does not reveal usable tokens, and the key
 * (pepper) lives only in server configuration.
 */
export function hmacHex(key: string, value: string): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/** Short, non-reversible fingerprint for logs (e.g. phone numbers). */
export function fingerprint(key: string, value: string): string {
  return hmacHex(key, value).slice(0, 12);
}
