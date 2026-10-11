import { NextResponse, type NextRequest } from 'next/server';
import { rejectUnlessCron } from '@/lib/security/cron';
import { sendDepositFailedEmail } from '@/modules/bookings/notify';
import { DEPOSIT_EXPIRED_REASON } from '@/modules/deposits/rules';
import { expireDeposits } from '@/modules/deposits/service';
import { sendDueReminders } from '@/modules/reminders/service';

/**
 * Hourly job, triggered by Supabase pg_cron (see prisma/sql/cron.sql; Vercel's
 * free plan only runs crons daily). Sends 24-hour email reminders and expires
 * SINPE deposits that weren't verified within 24 hours.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rejected = rejectUnlessCron(req);
  if (rejected) return rejected;
  const remindersSent = await sendDueReminders();

  // Unverified SINPE deposits: cancel, free the slot, tell the customer.
  const expired = await expireDeposits(DEPOSIT_EXPIRED_REASON);
  for (const e of expired) await sendDepositFailedEmail(e.id, true);

  return NextResponse.json(
    { ok: true, remindersSent, depositsExpired: expired.length },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
