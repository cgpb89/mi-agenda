/** Dashboard shell: navigation, header, account menu. */
export const app = {
  sidebar: 'Sidebar',
  mainNav: 'Main',
  closeMenu: 'Close menu',
  openMenu: 'Open menu',
  viewBookingPage: 'View booking page ↗',
  platformAdmin: 'Platform admin ↗',
  signOut: 'Sign out',
  newAppointment: '+ New appointment',
  billing: {
    trialDays: ({ n }: { n: number }) =>
      n === 1 ? 'Free trial: 1 day left' : `Free trial: ${n} days left`,
    trialEnds: ({ date }: { date: string }) =>
      `Your trial ends on ${date}. Choose a plan to keep your booking page online.`,
    renewDays: ({ n }: { n: number }) =>
      n === 1 ? 'Your plan ends in 1 day' : `Your plan ends in ${n} days`,
    renewEnds: ({ date }: { date: string }) =>
      `Renew before ${date} to keep your booking page online.`,
    contact: 'Contact us to pay',
    closedTitle: 'Your business is closed',
    closedBody: ({ date }: { date: string }) =>
      `Your trial or paid period ended on ${date}. Your booking page is offline and customers can't book.`,
    closedDeletion: ({ date, n }: { date: string; n: number }) =>
      `Pay before ${date} to reopen it with everything as you left it. After that date the business and all its data (appointments, customers, services) are permanently deleted. ${n === 1 ? '1 day left.' : `${n} days left.`}`,
    closedHow: 'To pay your plan and reopen right away, contact us.',
  },
  titles: {
    availability: 'Availability & working hours',
    customer: 'Customer',
    onboarding: 'Set up your business',
  },
  nav: {
    overview: 'Overview',
    calendar: 'Calendar',
    appointments: 'Appointments',
    services: 'Services',
    staff: 'Staff',
    customers: 'Customers',
    analytics: 'Analytics',
    'booking-page': 'Booking page',
    availability: 'Availability',
    settings: 'Business settings',
  },
  roles: { OWNER: 'Owner', MANAGER: 'Manager', STAFF: 'Staff' },
  pageUnpublished: 'Unpublished',
  pageDraft: 'Draft · not published',
  noBusiness: {
    metaTitle: 'Your businesses',
    eyebrow: 'No business yet',
    title: 'You’re not part of a business',
    body: 'Your account isn’t a member of an active business. If a business invited you, open the invitation link again. If an account was suspended, contact the business owner.',
    platformAdmin: 'Platform admin',
  },
};
