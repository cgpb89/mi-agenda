/**
 * Collected-money ledger (pure).
 *
 * Reporting policy (also shown in the UI and docs):
 * - "Estimated appointment value" = Σ quoted price snapshot of COMPLETED
 *   appointments whose start falls in the period. It is NOT money received.
 * - "Collected" = Σ PAYMENT − Σ REFUND of non-voided payment records whose
 *   `recordedAt` falls in the period. Only explicit records count: completing an
 *   appointment never implies payment.
 * - Voided records are excluded everywhere (corrections), so nothing is double
 *   counted; refunds are separate negative entries, not edits.
 * - Partial collection is supported: an appointment may have several records.
 */
export interface LedgerEntry {
  kind: 'PAYMENT' | 'REFUND';
  amountMinor: number;
  voidedAt: Date | null;
}

export function netCollectedMinor(entries: LedgerEntry[]): number {
  let total = 0;
  for (const e of entries) {
    if (e.voidedAt) continue;
    total += e.kind === 'PAYMENT' ? e.amountMinor : -e.amountMinor;
  }
  return total;
}

export type PaymentState = 'none' | 'partial' | 'paid' | 'over';

export function paymentState(quotedMinor: number, collectedMinor: number): PaymentState {
  if (collectedMinor <= 0) return 'none';
  if (collectedMinor < quotedMinor) return 'partial';
  if (collectedMinor === quotedMinor) return 'paid';
  return 'over';
}

/** Validate a new ledger entry against the appointment's current balance. */
export function ledgerEntryError(
  kind: 'PAYMENT' | 'REFUND',
  amountMinor: number,
  currentCollectedMinor: number,
  quotedMinor: number,
): string | null {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0)
    return 'Enter an amount greater than zero.';
  if (kind === 'REFUND' && amountMinor > currentCollectedMinor) {
    return 'A refund cannot exceed the amount collected.';
  }
  // Guard against typos (e.g. 3800 instead of 38.00): allow tips/extras up to 3× quote or +$500.
  const ceiling = Math.max(quotedMinor * 3, quotedMinor + 50_000);
  if (kind === 'PAYMENT' && currentCollectedMinor + amountMinor > ceiling) {
    return 'That amount is much higher than the appointment price. Check it and try again.';
  }
  return null;
}

export interface ValuedAppointment {
  status: string;
  quotedPriceMinor: number;
}

export function estimatedValueMinor(appointments: ValuedAppointment[]): number {
  return appointments.reduce(
    (sum, a) => (a.status === 'COMPLETED' ? sum + a.quotedPriceMinor : sum),
    0,
  );
}

export function formatMoney(minor: number, currency = 'USD', locale = 'en-US'): string {
  const fractionDigits = minor % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
