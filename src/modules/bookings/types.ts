export interface AppointmentDetails {
  id: string;
  ref: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  source: 'ONLINE' | 'PHONE' | 'WALK_IN';
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  startAt: string;
  endAt: string;
  durationMin: number;
  quotedPriceMinor: number;
  currency: string;
  customerId: string;
  contactName: string;
  contactEmail: string | null;
  phone: string;
  customerNote: string | null;
  internalNote: string | null;
  cancelReason: string | null;
  completedVisits: number;
  customerSince: string;
  payments: {
    id: string;
    kind: 'PAYMENT' | 'REFUND';
    amountMinor: number;
    method: string;
    recordedAt: string;
    voided: boolean;
    note: string | null;
  }[];
  collectedMinor: number;
  /** SINPE deposit asked at booking, if any. */
  deposit: { minor: number; reference: string; status: string } | null;
  can: { manage: boolean; pay: boolean; void: boolean; rebook: boolean };
}
