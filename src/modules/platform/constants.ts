/** Placeholder subscription catalogue (design: "Plan prices are placeholders until launch"). Label only — not enforced. */
export const PLANS = {
  TRIAL: { label: 'Trial', priceMinor: 0, staffSeats: 2 as number | null },
  STARTER: { label: 'Starter', priceMinor: 1900, staffSeats: 1 as number | null },
  GROWTH: { label: 'Growth', priceMinor: 4900, staffSeats: 5 as number | null },
  BUSINESS: { label: 'Business', priceMinor: 9900, staffSeats: null as number | null },
} as const;

export type PlanKey = keyof typeof PLANS;

export const DEFAULT_FLAGS = [
  { key: 'newEditor', name: 'New booking-page editor', note: 'All tenants', enabled: true },
  { key: 'multiLoc', name: 'Multiple locations', note: 'Business plan only', enabled: true },
  { key: 'waitlist', name: 'Waitlist', note: 'Planned · internal testing', enabled: false },
  { key: 'gcal', name: 'Google Calendar sync', note: 'Planned integration', enabled: false },
  { key: 'payments', name: 'Online payments', note: 'Planned integration', enabled: false },
];
