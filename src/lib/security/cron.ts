import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/env';

/**
 * Guard for scheduled job routes (/api/cron/*). Callers (Vercel Cron, Supabase
 * pg_cron) send "Authorization: Bearer <CRON_SECRET>". Returns a response to
 * send back when the request is not allowed, or null to proceed.
 */
export function rejectUnlessCron(req: NextRequest): NextResponse | null {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 });
  const given = req.headers.get('authorization') ?? '';
  // Hash both sides so the comparison is constant-time regardless of length.
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b) ? null : NextResponse.json({ ok: false }, { status: 401 });
}
