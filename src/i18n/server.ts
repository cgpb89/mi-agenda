import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import {
  INTL_LOCALE,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  type Locale,
  isLocale,
  negotiateLocale,
} from './config';
import { messages, type Messages } from './messages';

export interface I18n {
  locale: Locale;
  /** BCP-47 tag for Intl formatting. */
  intl: string;
  t: Messages;
}

export function i18nFor(locale: Locale): I18n {
  return { locale, intl: INTL_LOCALE[locale], t: messages[locale] };
}

/** The language the visitor explicitly picked with the switcher, if any. */
export const getChosenLocale = cache(async (): Promise<Locale | null> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : null;
});

/**
 * Request language: explicit page header (client fetches) → switcher cookie →
 * browser Accept-Language → English.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const h = await headers();
  const fromHeader = h.get(LOCALE_HEADER);
  if (isLocale(fromHeader)) return fromHeader;
  return (await getChosenLocale()) ?? negotiateLocale(h.get('accept-language'));
});

export async function getI18n(): Promise<I18n> {
  return i18nFor(await getLocale());
}
