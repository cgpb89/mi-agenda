import { logger } from '@/lib/observability/logger';

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
 * An expected, client-safe error. `message` is shown to the user verbatim, so
 * it must never contain internal details (SQL, IDs of other tenants, stack).
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

export const notFound = (what = 'That item') => new AppError('NOT_FOUND', `${what} was not found.`);
export const forbidden = () => new AppError('FORBIDDEN', "You don't have access to do that.");

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

/** Convert any thrown value to a safe, user-facing error. Unknown errors are logged, not leaked. */
export function toPublicError(err: unknown, context?: string): PublicError {
  if (err instanceof AppError) {
    return { code: err.code, message: err.message, fieldErrors: err.fieldErrors };
  }
  logger.error('unexpected error', { context, error: err instanceof Error ? err : String(err) });
  return { code: 'INTERNAL', message: 'Something went wrong. Please try again.' };
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
    return { ok: false, error: toPublicError(err, context) };
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
