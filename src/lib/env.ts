import 'server-only';
import { z } from 'zod';
import { projectRefFromApiUrl, projectRefFromDbUrl } from './supabase-project';

/**
 * Server-only environment, validated once on first access.
 * Parsing is lazy so `next build` can run without runtime secrets; any request
 * that needs configuration fails fast with a clear (server-side) message.
 */
const boolish = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const secret = z.string().min(32, 'must be at least 32 characters');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_URL: z.url(),
    DATABASE_URL: z
      .string({
        error:
          'missing — the Postgres connection string from Supabase → Connect → Connection string (transaction pooler, port 6543). The Supabase API keys cannot replace it.',
      })
      .min(1, 'must not be empty')
      .regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// connection string'),
    DIRECT_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// connection string')
      .optional()
      .or(z.literal('')),
    // Supabase API settings. Optional and currently unused at runtime: the app
    // talks to Postgres through Prisma and owns authentication itself. They are
    // validated so a misconfiguration is caught early, and the service-role key
    // stays server-only (never NEXT_PUBLIC_, never sent to the browser).
    NEXT_PUBLIC_SUPABASE_URL: z.url().optional().or(z.literal('')),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(5),
    SESSION_SECRET: secret,
    PASSWORD_RESET_TOKEN_SECRET: secret,
    RATE_LIMIT_SECRET: secret,
    RATE_LIMIT_STORE: z.enum(['postgres', 'memory']).default('postgres'),
    TRUST_PROXY_HEADERS: boolish,
    EMAIL_FROM: z.string().optional(),
    EMAIL_SERVER_HOST: z.string().optional(),
    EMAIL_SERVER_PORT: z.coerce.number().int().positive().default(587),
    EMAIL_SERVER_USER: z.string().optional(),
    EMAIL_SERVER_PASSWORD: z.string().optional(),
    // Resend (https://resend.com): when set, email goes through Resend's SMTP and
    // EMAIL_SERVER_* are not needed. EMAIL_FROM defaults to Resend's test sender.
    RESEND_API_KEY: z.string().optional(),
    // Customer/owner notification emails (reminders, confirmations, waitlist,
    // deposits, billing warnings). Off by default: only auth emails (password
    // reset, invitations) are sent until this is "true".
    EMAIL_NOTIFICATIONS: boolish,
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    // Cloudinary stores booking-page photos. Optional: without it, uploads are off.
    CLOUDINARY_CLOUD_NAME: z
      .string()
      .regex(/^[a-z0-9_-]+$/i, 'must be the cloud name only, not a URL')
      .optional()
      .or(z.literal('')),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    // Shown to business owners as "contact us to pay" (trial banner, closed screen).
    SUPPORT_EMAIL: z.email().optional().or(z.literal('')),
    // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" to /api/cron/*.
    CRON_SECRET: z.string().min(16).optional().or(z.literal('')),
  })
  .superRefine((env, ctx) => {
    // The Postgres URLs must belong to the same Supabase project as the API URL.
    const apiRef = projectRefFromApiUrl(env.NEXT_PUBLIC_SUPABASE_URL || undefined);
    if (apiRef) {
      for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const) {
        const ref = projectRefFromDbUrl(env[key] || undefined);
        if (ref && ref !== apiRef) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'points to a different Supabase project than NEXT_PUBLIC_SUPABASE_URL',
          });
        }
      }
    }
    if (
      env.SUPABASE_SERVICE_ROLE_KEY &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY === env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
        message: 'must not equal the public anon key',
      });
    }
    if (env.NODE_ENV === 'production') {
      if (env.RATE_LIMIT_STORE === 'memory') {
        ctx.addIssue({
          code: 'custom',
          path: ['RATE_LIMIT_STORE'],
          message: 'memory store is single-process and not allowed in production',
        });
      }
      const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.APP_URL);
      if (!env.APP_URL.startsWith('https://') && !local) {
        ctx.addIssue({ code: 'custom', path: ['APP_URL'], message: 'must be https in production' });
      }
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    // Names only — never values.
    throw new Error(`Invalid server configuration:\n${problems}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export function isCloudinaryConfigured(env: Env = getEnv()): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

export function isEmailConfigured(env: Env = getEnv()): boolean {
  return Boolean(env.RESEND_API_KEY || (env.EMAIL_FROM && env.EMAIL_SERVER_HOST));
}
