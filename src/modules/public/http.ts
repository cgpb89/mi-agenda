import 'server-only';
import { NextResponse } from 'next/server';
import { AppError, toPublicError } from '@/lib/errors';

export const MAX_BODY_BYTES = 8 * 1024;

/** Read a small JSON body with a hard size cap (public endpoints). */
export async function readJson(request: Request): Promise<unknown> {
  const len = Number(request.headers.get('content-length') ?? '0');
  if (len > MAX_BODY_BYTES) throw new AppError('VALIDATION', 'Request too large.');
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new AppError('VALIDATION', 'Request too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('VALIDATION', 'Invalid request.');
  }
}

/** Uniform JSON error responses: client-safe messages only, no internals. */
export function errorResponse(err: unknown, context: string): NextResponse {
  const pub = toPublicError(err, context);
  const status = err instanceof AppError ? err.status : 500;
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (err instanceof AppError && err.retryAfterSec)
    headers['Retry-After'] = String(err.retryAfterSec);
  return NextResponse.json({ error: pub }, { status, headers });
}

export function ok(data: unknown, init: { status?: number } = {}): NextResponse {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
