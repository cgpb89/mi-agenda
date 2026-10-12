import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { getEnv, isEmailConfigured, type Env } from '@/lib/env';
import { logger } from '@/lib/observability/logger';

/**
 * Two kinds of email:
 * - `auth`: password reset and team invitations. Always sent when email is configured.
 * - `notification`: reminders, confirmations, waitlist, deposits, billing warnings.
 *   Sent only when EMAIL_NOTIFICATIONS=true (paused by default).
 */
export type MailKind = 'auth' | 'notification';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Defaults to `notification`. */
  kind?: MailKind;
}

export interface MailResult {
  /** True only when an SMTP server accepted the message. */
  sent: boolean;
}

/** Resend's shared sender; works without a verified domain (delivers to the account owner only). */
const RESEND_TEST_FROM = 'Tempo <onboarding@resend.dev>';

let transporter: Transporter | undefined;

function getTransporter(env: Env): Transporter {
  if (!transporter) {
    transporter = env.RESEND_API_KEY
      ? nodemailer.createTransport({
          host: 'smtp.resend.com',
          port: 465,
          secure: true,
          auth: { user: 'resend', pass: env.RESEND_API_KEY },
        })
      : nodemailer.createTransport({
          host: env.EMAIL_SERVER_HOST,
          port: env.EMAIL_SERVER_PORT,
          secure: env.EMAIL_SERVER_PORT === 465,
          auth: env.EMAIL_SERVER_USER
            ? { user: env.EMAIL_SERVER_USER, pass: env.EMAIL_SERVER_PASSWORD }
            : undefined,
        });
  }
  return transporter;
}

/**
 * Whether notification emails can actually go out. Jobs check this before
 * claiming reminders/notices, so nothing is marked as sent while paused.
 * In development without any email setup, emails are printed to the console.
 */
export function canSendNotifications(env: Env = getEnv()): boolean {
  if (isEmailConfigured(env)) return env.EMAIL_NOTIFICATIONS;
  return env.NODE_ENV === 'development';
}

/**
 * Send a transactional email.
 * - Notifications while paused (EMAIL_NOTIFICATIONS off) → not sent.
 * - Email configured (Resend or SMTP) → send for real.
 * - Not configured, development → print to the server console.
 * - Not configured, production → do nothing; callers must not claim delivery.
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const env = getEnv();
  const kind = msg.kind ?? 'notification';
  const configured = isEmailConfigured(env);
  if (kind === 'notification' && configured && !env.EMAIL_NOTIFICATIONS) {
    return { sent: false };
  }
  if (configured) {
    try {
      await getTransporter(env).sendMail({
        from: env.EMAIL_FROM || RESEND_TEST_FROM,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
      });
      return { sent: true };
    } catch (err) {
      logger.error('email delivery failed', {
        subject: msg.subject,
        error: err instanceof Error ? err : String(err),
      });
      return { sent: false };
    }
  }
  if (env.NODE_ENV === 'development') {
    // DEV ONLY: lets you complete flows without an email provider.
    process.stdout.write(
      `\n──── [dev mail, not sent] ────\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n─────────────────────────────\n`,
    );
  }
  return { sent: false };
}
