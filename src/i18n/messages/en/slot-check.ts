const ISO_DAYS_PLURAL = [
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
  'Sundays',
];

/** Advisory availability messages for the staff "New appointment" / reschedule UIs. */
export const slotCheck = {
  chooseServiceAndStaff: 'Choose a service and a staff member.',
  doesntOffer: ({ staff, service }: { staff: string; service: string }) =>
    `${staff} doesn't offer ${service}.`,
  free: ({ day, range, staff }: { day: string; range: string; staff: string }) =>
    `${day}, ${range} is free for ${staff}.`,
  past: 'That time has already passed.',
  businessClosed: ({ business, day }: { business: string; day: string }) =>
    `${business} is closed on ${day}.`,
  notWorkingDay: ({ staff, isoDay }: { staff: string; isoDay: number }) =>
    `${staff} doesn't work on ${ISO_DAYS_PLURAL[isoDay - 1]}.`,
  onBreak: ({ staff }: { staff: string }) => `That runs into ${staff}'s break.`,
  blocked: ({ staff, range, reason }: { staff: string; range: string; reason: string | null }) =>
    `${staff} has blocked ${range}${reason ? `: ${reason}` : ''}.`,
  unavailableStaff: ({ staff }: { staff: string }) => `${staff} isn't available then.`,
  outsideHours: ({ staff, periods }: { staff: string; periods: string }) =>
    `Outside ${staff}'s working hours (${periods}).`,
  overlaps: ({
    customer,
    range,
    service,
    staff,
  }: {
    customer: string;
    range: string;
    service: string;
    staff: string;
  }) => `Overlaps ${customer}, ${range} (${service}) with ${staff}.`,
  alreadyBooked: ({ staff }: { staff: string }) => `${staff} is already booked then.`,
  unavailable: "That time isn't available.",
};
