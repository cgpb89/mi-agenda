/**
 * Reminder timing (pure). The hourly job reminds appointments that start 23–25
 * hours from now; the 2-hour window absorbs a late or skipped hourly run, and
 * `reminder_sent_at` guarantees one reminder per appointment.
 */
export const REMINDER_LEAD_HOURS = 24;
const SLACK_HOURS = 1;
const HOUR_MS = 60 * 60 * 1000;

export function reminderWindow(now: Date): { from: Date; to: Date } {
  const t = now.getTime();
  return {
    from: new Date(t + (REMINDER_LEAD_HOURS - SLACK_HOURS) * HOUR_MS),
    to: new Date(t + (REMINDER_LEAD_HOURS + SLACK_HOURS) * HOUR_MS),
  };
}
