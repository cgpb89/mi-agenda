import { NextResponse, type NextRequest } from 'next/server';
import { rejectUnlessCron } from '@/lib/security/cron';
import { sendDueReminders } from '@/modules/reminders/service';

/**
 * Hourly job, triggered by Supabase pg_cron (see prisma/sql/cron.sql; Vercel's
 * free plan only runs crons daily). Sends 24-hour email reminders.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rejected = rejectUnlessCron(req);
  if (rejected) return rejected;
  const remindersSent = await sendDueReminders();
  return NextResponse.json(
    { ok: true, remindersSent },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
