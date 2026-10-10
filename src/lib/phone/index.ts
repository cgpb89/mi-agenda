import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';
import { z } from 'zod';
import { PHONE_COUNTRIES } from './countries';

/**
 * Phone policy
 * - Numbers are normalised to E.164 (+15550142290) using an explicit country
 *   (selected by the customer, defaulting to the business's country) unless
 *   the input already starts with "+".
 * - Numbers that do not parse as a valid number for that country are REJECTED.
 *   We never store an unparseable value as if it were normalised.
 * - A phone number is unverified: it is a lookup / booking-policy key, never a
 *   credential.
 */
export type PhoneResult =
  | { ok: true; e164: string; country: string | undefined }
  | { ok: false; reason: 'missing' | 'invalid' };

const SUPPORTED = new Set(PHONE_COUNTRIES.map((c) => c.code));

export function isSupportedCountry(code: string): code is CountryCode {
  return SUPPORTED.has(code);
}

export function normalizePhone(raw: string | undefined | null, country: string): PhoneResult {
  const input = (raw ?? '').trim();
  if (!input) return { ok: false, reason: 'missing' };
  // Reject obviously hostile/oversized input before parsing.
  if (input.length > 32 || !/^[+\d\s().\-]+$/.test(input)) return { ok: false, reason: 'invalid' };
  const cc = isSupportedCountry(country) ? country : undefined;
  const parsed = input.startsWith('+')
    ? parsePhoneNumberFromString(input)
    : cc
      ? parsePhoneNumberFromString(input, cc)
      : undefined;
  if (!parsed || !parsed.isValid()) return { ok: false, reason: 'invalid' };
  return { ok: true, e164: parsed.number, country: parsed.country };
}

/** Display an E.164 number in international format for staff views. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}

export const countryCodeSchema = z
  .string()
  .length(2)
  .toUpperCase()
  .refine((c) => SUPPORTED.has(c), 'Choose a country');

export { PHONE_COUNTRIES };
