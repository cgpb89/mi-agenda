export const emails = {
  resetSubject: 'Reset your Tempo password',
  resetBody: ({ link }: { link: string }) =>
    `Someone asked to reset the password for your Tempo account.\n\nUse this link within 30 minutes:\n${link}\n\nIf this wasn't you, ignore this email — your password stays the same.`,
  inviteSubject: ({ business }: { business: string }) => `You're invited to ${business} on Tempo`,
  inviteBody: ({
    inviter,
    business,
    role,
    link,
  }: {
    inviter: string;
    business: string;
    role: 'MANAGER' | 'STAFF';
    link: string;
  }) =>
    `${inviter} invited you to join ${business} on Tempo as ${role === 'MANAGER' ? 'a manager' : 'staff'}.\n\nAccept within 7 days:\n${link}\n\nIf you weren't expecting this, you can ignore this email.`,
  bookedSubject: ({ service, business }: { service: string; business: string }) =>
    `Booked: ${service} at ${business}`,
  bookedWhenFormat: "cccc, LLLL d 'at' h:mm a",
  bookedBody: ({
    service,
    staff,
    when,
    timezone,
    address,
    code,
    link,
  }: {
    service: string;
    staff: string;
    when: string;
    timezone: string;
    address: string;
    code: string;
    link: string;
  }) =>
    `You're booked.\n\n${service} with ${staff}\n${when} (${timezone})\n${address}\nConfirmation ${code}\n\nView, reschedule or cancel:\n${link}\n`,
  // Owner warnings (daily billing job)
  ownerEndingSubject: ({ business, n }: { business: string; n: number }): string =>
    `${business}: your plan ends in ${n === 1 ? '1 day' : `${n} days`}`,
  ownerEndingBody: ({ business, date, link }: { business: string; date: string; link: string }) =>
    `Hi,

The trial or paid period of ${business} on Tempo ends on ${date}. After that date your booking page goes offline and customers can't book until the plan is paid.

See your plan and how to pay:
${link}
`,
  ownerClosedSubject: ({ business }: { business: string }) =>
    `${business} is closed: your booking page is offline`,
  ownerClosedBody: ({
    business,
    deleteOn,
    link,
  }: {
    business: string;
    deleteOn: string;
    link: string;
  }) =>
    `Hi,

${business}'s plan wasn't paid, so the business is closed and its booking page is offline.

Pay before ${deleteOn} to reopen it with everything as you left it. After that date the business and all its data (appointments, customers, services) are permanently deleted.

How to pay:
${link}
`,
  ownerDeletionSubject: ({ business, deleteOn }: { business: string; deleteOn: string }) =>
    `Last notice: ${business} will be deleted on ${deleteOn}`,
  ownerDeletionBody: ({
    business,
    deleteOn,
    link,
  }: {
    business: string;
    deleteOn: string;
    link: string;
  }) =>
    `Hi,

${business} is still closed for non-payment. On ${deleteOn} the business and all its data (appointments, customers, services, photos) will be permanently deleted. This can't be undone.

Pay before then to keep everything:
${link}
`,
  ownerDateFormat: 'LLLL d, yyyy',
  // Customer reminder (24 h before)
  reminderSubject: ({ service, business }: { service: string; business: string }) =>
    `Reminder: ${service} at ${business} tomorrow`,
  reminderBody: ({
    service,
    staff,
    when,
    timezone,
    address,
    link,
  }: {
    service: string;
    staff: string;
    when: string;
    timezone: string;
    address: string;
    link: string;
  }) =>
    `See you soon!

${service} with ${staff}
${when} (${timezone})
${address}

Need to reschedule or cancel? Use this link (it replaces earlier ones):
${link}
`,
  // Customer: booking confirmed by the business (incl. deposit verified)
  confirmedSubject: ({ service, business }: { service: string; business: string }) =>
    `Confirmed: ${service} at ${business}`,
  confirmedBody: ({
    service,
    staff,
    when,
    timezone,
    address,
    deposit,
    link,
  }: {
    service: string;
    staff: string;
    when: string;
    timezone: string;
    address: string;
    deposit: string;
    link: string;
  }) =>
    `Your appointment is confirmed.\n\n${service} with ${staff}\n${when} (${timezone})\n${address}\n${deposit ? `Deposit received: ${deposit}\n` : ''}\nView, reschedule or cancel (this link replaces earlier ones):\n${link}\n`,
  // Customer: deposit not verified (rejected by the business or expired)
  depositFailedSubject: ({ service, business }: { service: string; business: string }) =>
    `Booking cancelled: ${service} at ${business}`,
  depositFailedBody: ({
    service,
    business,
    when,
    expired,
  }: {
    service: string;
    business: string;
    when: string;
    expired: boolean;
  }) =>
    `Your booking for ${service} on ${when} was cancelled because ${expired ? `the SINPE deposit couldn't be verified within 24 hours` : `${business} couldn't verify the SINPE deposit`}.\n\nIf you already paid, please contact ${business} directly.\n`,
  // Waitlist: a slot opened up
  waitlistSubject: ({ business }: { business: string }) => `A time just opened up at ${business}`,
  waitlistBody: ({
    name,
    service,
    day,
    link,
  }: {
    name: string;
    service: string;
    day: string;
    link: string;
  }) =>
    `Hi ${name},

A time just opened up for ${service} on ${day}. It goes to whoever books first, so book soon:
${link}

You're receiving this because you joined the waitlist.
`,
  waitlistDayFormat: 'cccc, LLLL d',
};
