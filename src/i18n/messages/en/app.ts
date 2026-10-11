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
  billingPage: {
    title: 'Plan & billing',
    yourPlan: 'Your plan',
    trialUntil: ({ date, n }: { date: string; n: number }) =>
      `Free trial until ${date} · ${n === 1 ? '1 day left' : `${n} days left`}`,
    paidUntil: ({ date, n }: { date: string; n: number }) =>
      `Paid until ${date} · ${n === 1 ? '1 day left' : `${n} days left`}`,
    closedSince: ({ date }: { date: string }) => `Closed since ${date} (unpaid)`,
    staff: ({ n }: { n: string }) => `Active staff: ${n}`,
    photos: ({ n }: { n: number }) => `Booking-page photos: ${n}`,
    unlimited: 'unlimited',
    included: 'Included',
    plans: 'Plans',
    perMonth: 'per month',
    current: 'Current',
    howToPay: 'How to pay',
    sinpeTo: 'Send the plan amount by SINPE Móvil to:',
    reference: 'Use this as the payment description:',
    afterPaying:
      'After paying, send us the SINPE receipt. We record the payment and your access is extended (1 month or 1 year).',
    whatsapp: 'Send receipt by WhatsApp',
    email: 'Send receipt by email',
    whatsappText: ({ business, ref }: { business: string; ref: string }) =>
      `Hi, I paid the Tempo plan for ${business} (reference ${ref}). Here is the SINPE receipt.`,
    notConfigured: 'Payment details will appear here soon. Contact support to pay your plan.',
    seeBilling: 'Plan & billing',
  },
  plans: {
    availableFrom: ({ plan }: { plan: string }) => `Available on the ${plan} plan`,
    upgradeBody: 'Upgrade your plan to unlock this and more.',
    seePlans: 'See plans',
    customersBody:
      'Keep a customer directory with visit history, spend and upcoming bookings for everyone who books with you.',
    analyticsLimited:
      'Your plan shows the last 30 days. Upgrade for longer ranges and filters by staff and service.',
  },
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
    billing: 'Plan & billing',
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
