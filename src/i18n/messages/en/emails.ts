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
};
