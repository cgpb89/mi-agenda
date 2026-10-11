'use client';

import { createContext, useContext } from 'react';
import { INTL_LOCALE, type Locale } from './config';
import { messages, type Messages } from './messages';

const LocaleContext = createContext<Locale>('en');

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useI18n(): { locale: Locale; intl: string; t: Messages } {
  const locale = useContext(LocaleContext);
  return { locale, intl: INTL_LOCALE[locale], t: messages[locale] };
}
