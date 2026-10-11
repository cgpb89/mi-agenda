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
};
