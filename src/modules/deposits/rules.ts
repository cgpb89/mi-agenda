/**
 * SINPE Móvil deposit rules (pure, client-safe).
 *
 * The business chooses a fixed amount or a percentage of the service price.
 * The customer pays by SINPE Móvil and types the SINPE reference when booking;
 * the booking stays PENDING until staff confirm the deposit. Deposits not
 * verified within DEPOSIT_HOLD_HOURS expire and free the slot.
 */
export const DEPOSIT_MODES = ['NONE', 'FIXED', 'PERCENT'] as const;
export type DepositMode = (typeof DEPOSIT_MODES)[number];

export const DEPOSIT_HOLD_HOURS = 24;
/** Stored as the cancel reason when a deposit expires (shown translated). */
export const DEPOSIT_EXPIRED_REASON = 'SINPE deposit not verified in time';
/** SINPE receipt references: digits/letters/dashes, 4–40 characters. */
export const DEPOSIT_REFERENCE = /^[A-Za-z0-9-]{4,40}$/;

export interface DepositPolicy {
  mode: DepositMode;
  /** FIXED: minor units. PERCENT: 1–100. */
  value: number;
  sinpePhone: string | null;
}

/** Rounding step: ₡100 for colones, 1 unit for other currencies. */
function stepFor(currency: string): number {
  return currency === 'CRC' ? 10000 : 100;
}

/**
 * Deposit for a service, in minor units, or null when none is asked: deposits
 * off, no SINPE number set, or a free service. Never more than the price.
 */
export function depositFor(
  policy: DepositPolicy,
  priceMinor: number,
  currency: string,
): number | null {
  if (policy.mode === 'NONE' || !policy.sinpePhone || priceMinor <= 0) return null;
  const raw = policy.mode === 'FIXED' ? policy.value : (priceMinor * policy.value) / 100;
  const step = stepFor(currency);
  const amount = Math.min(priceMinor, Math.max(step, Math.round(raw / step) * step));
  return amount > 0 ? amount : null;
}

export function normalizeDepositReference(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}
