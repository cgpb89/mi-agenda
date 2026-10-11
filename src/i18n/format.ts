import { INTL_LOCALE, type Locale } from './config';

const regionNames = new Map<Locale, Intl.DisplayNames | null>();

/** Localised country name for an ISO 3166 code, falling back to `fallback`. */
export function countryName(code: string, locale: Locale, fallback = code): string {
  if (!regionNames.has(locale)) {
    try {
      regionNames.set(locale, new Intl.DisplayNames([INTL_LOCALE[locale]], { type: 'region' }));
    } catch {
      regionNames.set(locale, null);
    }
  }
  return regionNames.get(locale)?.of(code) ?? fallback;
}

/** Money in minor units → "$38" / "$38.50". Spanish uses the narrow symbol ("$" not "US$"). */
export function formatPrice(minor: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'currency',
    currency,
    currencyDisplay: locale === 'es' ? 'narrowSymbol' : 'symbol',
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

/** Minutes from midnight → "9:00 AM" (en) / "9:00 a.m." (es). */
export function formatMinutesOfDay(m: number, locale: Locale): string {
  const h = Math.floor(m / 60) % 24;
  return new Date(Date.UTC(2000, 0, 1, h, m % 60))
    .toLocaleTimeString(INTL_LOCALE[locale], {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    })
    .replace(/\s/g, ' '); // Some ICU versions use a narrow no-break space before AM/PM.
}
