export const LOCALES = ['en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Set only when someone explicitly picks a language with the switcher. */
export const LOCALE_COOKIE = 'tempo_locale';

/** Sent by client fetches so public API errors come back in the page's language. */
export const LOCALE_HEADER = 'x-tempo-locale';

/** BCP-47 tag used for Intl date/number formatting. */
export const INTL_LOCALE: Record<Locale, string> = { en: 'en-US', es: 'es-419' };

/** Display names, always in their own language. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', es: 'Español' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** "es-AR", "en_US", "ES" → supported locale, or null. */
export function toLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(base) ? base : null;
}

/** Pick the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(',')
    .map((part, i) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { tag, q: q ? Number(q.slice(2)) || 0 : 1, i };
    })
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag, q } of ranked) {
    const locale = q > 0 ? toLocale(tag) : null;
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}
