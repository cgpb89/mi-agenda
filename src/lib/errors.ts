import { logger } from '@/lib/observability/logger';
import type { Locale } from '@/i18n/config';
import { msg, resolveMessage } from '@/i18n/message-ref';
import { messages } from '@/i18n/messages';
import { getLocale } from '@/i18n/server';

export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SLOT_TAKEN'
  | 'PHONE_LIMIT'
  | 'POLICY'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SLOT_TAKEN: 409,
  PHONE_LIMIT: 409,
  POLICY: 422,
  INTERNAL: 500,
};

export type FieldErrors = Record<string, string>;

/**
 * An expected, client-safe error. `message` (and each field error) is a `msg()`
 * token resolved to the request's language when it leaves the server, so it
 * must never contain internal details (SQL, IDs of other tenants, stack).
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors?: FieldErrors;
  readonly retryAfterSec?: number;

  constructor(
    code: ErrorCode,
    message: string,
    opts: { fieldErrors?: FieldErrors; retryAfterSec?: number } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = opts.fieldErrors;
    this.retryAfterSec = opts.retryAfterSec;
  }
}

export const notFound = () => new AppError('NOT_FOUND', msg('notFound'));
export const forbidden = () => new AppError('FORBIDDEN', msg('noAccess'));

export interface PublicError {
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: PublicError };

export function ok<T>(data: T): { ok: true; data: T };
export function ok(): { ok: true; data: undefined };
export function ok<T>(data?: T) {
  return { ok: true as const, data };
}

/**
 * Convert any thrown value to a safe, user-facing error in `locale`. Unknown
 * errors are logged, not leaked.
 */
export function toPublicError(err: unknown, locale: Locale, context?: string): PublicError {
  const t = messages[locale];
  if (err instanceof AppError) {
    const fieldErrors = err.fieldErrors
      ? Object.fromEntries(
          Object.entries(err.fieldErrors).map(([k, v]) => [k, resolveMessage(v, t)]),
        )
      : undefined;
    return { code: err.code, message: resolveMessage(err.message, t), fieldErrors };
  }
  logger.error('unexpected error', { context, error: err instanceof Error ? err : String(err) });
  return { code: 'INTERNAL', message: t.errors.generic };
}

/** Wrap a server action body so it always returns an ActionResult. */
export async function runAction<T>(
  context: string,
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    // Next.js control-flow errors (redirect/notFound) must propagate.
    if (isNextControlFlow(err)) throw err;
    return { ok: false, error: toPublicError(err, await getLocale(), context) };
  }
}

export function isNextControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === 'string' &&
    (digest.startsWith('NEXT_REDIRECT') ||
      digest.startsWith('NEXT_HTTP_ERROR_FALLBACK') ||
      digest === 'NEXT_NOT_FOUND')
  );
}
