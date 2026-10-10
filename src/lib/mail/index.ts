import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { getEnv, isEmailConfigured } from '@/lib/env';
import { logger } from '@/lib/observability/logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailResult {
  /** True only when an SMTP server accepted the message. */
  sent: boolean;
}

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  if (!transporter) {
    const env = getEnv();
    transporter = nodemailer.createTransport({
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
 * Send a transactional email.
 * - SMTP configured → send for real.
 * - Not configured, development → print to the server console (dev workflow
 *   for password reset / invitations). Never in production or tests.
 * - Not configured, production → do nothing; callers must not claim delivery.
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const env = getEnv();
  if (isEmailConfigured(env)) {
    try {
      await getTransporter().sendMail({
        from: env.EMAIL_FROM,
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
    // DEV ONLY: lets you complete reset/invite flows without SMTP.
    process.stdout.write(
      `\n──── [dev mail, not sent] ────\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n─────────────────────────────\n`,
    );
  }
  return { sent: false };
}
