import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';

/** Liveness + database reachability. Reveals no configuration details. */
export async function GET() {
  try {
    await getDb().$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: 'up' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { ok: false, db: 'down' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
