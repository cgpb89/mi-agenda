import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import '@/styles/globals.scss';
import { fontVariables } from './fonts';

export const metadata: Metadata = {
  title: { default: 'Tempo — Your next appointment starts here', template: '%s · Tempo' },
  description: 'Booking pages, calendars and analytics for appointment-based businesses.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f4f0e8',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the per-request CSP nonce (set in src/proxy.ts) makes every page
  // dynamically rendered, which nonce-based CSP requires: Next.js attaches the
  // nonce to its own scripts during the render.
  await headers();
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
