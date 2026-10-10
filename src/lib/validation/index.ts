import { z } from 'zod';
import { AppError, type FieldErrors } from '@/lib/errors';

/** Parse untrusted input; throw a client-safe VALIDATION error with field messages. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  throw new AppError('VALIDATION', 'Please check the highlighted fields.', { fieldErrors });
}

/** FormData → plain object (first value per key; files are dropped). */
export function formToObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string' && !(k in out)) out[k] = v;
  }
  return out;
}

// ── Email ───────────────────────────────────────────────────────────────────

export function normalizeEmail(raw: string): string {
  return raw.normalize('NFKC').trim().toLowerCase();
}

export const emailSchema = z
  .string({ error: 'Enter your email' })
  .trim()
  .max(254, 'Email is too long')
  .transform(normalizeEmail)
  .pipe(z.email({ error: 'Enter a valid email' }));

export const optionalEmailSchema = z
  .string()
  .trim()
  .max(254, 'Email is too long')
  .optional()
  .transform((v) => (v ? normalizeEmail(v) : undefined))
  .pipe(z.email({ error: 'Enter a valid email' }).optional());

// ── Passwords ───────────────────────────────────────────────────────────────

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200, 'Password is too long');

// ── Names / text ────────────────────────────────────────────────────────────

/** Strip control characters (keeps newlines/tabs where allowed by `multiline`). */
export function cleanText(value: string, multiline = false): string {
  const re = multiline
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
    : /[\u0000-\u001F\u007F]/g;
  return value.normalize('NFC').replace(re, '').trim();
}

export const nameSchema = (label = 'name', max = 120) =>
  z
    .string({ error: `Enter a ${label}` })
    .transform((v) => cleanText(v))
    .pipe(
      z.string().min(1, `Enter a ${label}`).max(max, `Keep the ${label} under ${max} characters`),
    );

export const optionalTextSchema = (max: number, multiline = false) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : cleanText(v, multiline) || undefined))
    .pipe(z.string().max(max, `Keep this under ${max} characters`).optional());

export const uuidSchema = z.uuid({ error: 'Invalid identifier' });

// ── Slugs ───────────────────────────────────────────────────────────────────

export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'billing',
  'blog',
  'book',
  'booking',
  'dashboard',
  'docs',
  'help',
  'login',
  'logout',
  'manage',
  'new',
  'onboarding',
  'pricing',
  'privacy',
  'public',
  'register',
  'reset-password',
  'forgot-password',
  'settings',
  'signup',
  'static',
  'status',
  'super-admin',
  'support',
  'tempo',
  'terms',
  'www',
  'mail',
  'root',
  'system',
]);

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 48)
    .replace(/-+$/g, '');
}

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(SLUG_RE, 'Use 3–48 lowercase letters, numbers and single hyphens')
  .refine((s) => !s.includes('--'), 'Use single hyphens only')
  .refine((s) => !RESERVED_SLUGS.has(s), 'That address is reserved — try another');

// ── Misc ────────────────────────────────────────────────────────────────────

export const timeZoneSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Unknown time zone');

/** Money input like "38", "38.5", "38.50" → integer minor units (2-decimal currencies). */
export function parseMoneyToMinor(input: string): number | null {
  const trimmed = input.trim().replace(/^\$/, '');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** Money arrives as a decimal *string* (never a float) and becomes integer minor units. */
export const moneyInputSchema = z
  .string({ error: 'Enter an amount like 38 or 38.50' })
  .transform((v, ctx) => {
    const minor = parseMoneyToMinor(v);
    if (minor === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount like 38 or 38.50' });
      return z.NEVER;
    }
    return minor;
  });
