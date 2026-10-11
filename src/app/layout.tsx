import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import '@/styles/globals.scss';
import { I18nProvider } from '@/i18n/client';
import { getI18n, getLocale } from '@/i18n/server';
import { fontVariables } from './fonts';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.common.metaTitle, template: '%s · Tempo' },
    description: t.common.metaDescription,
  };
}

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
  const locale = await getLocale();
  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
