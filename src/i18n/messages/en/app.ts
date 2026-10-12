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
  support: {
    banner: ({ business }: { business: string }) => `Support mode · ${business}`,
    note: 'You are acting as the owner. Changes are saved for real.',
    exit: 'Exit support mode',
  },
  tour: {
    next: 'Next',
    back: 'Back',
    skip: 'Skip guide',
    finish: 'Finish',
    goTo: ({ page }: { page: string }) => `Go to ${page}`,
    stepOf: ({ n, total }: { n: number; total: number }) => `${n} of ${total}`,
    replay: 'Setup guide',
    label: 'Setup guide',
    steps: {
      welcome: [
        "Welcome! Let's set up your business",
        'This short guide walks you through everything you need to start taking bookings online. You can skip it and replay it any time from "Setup guide" in the sidebar.',
      ],
      sidebar: [
        'Your menu',
        'Everything lives here: your calendar, appointments, services, team, booking page and settings.',
      ],
      services: [
        '1. Create your services',
        'Add what you offer with its duration and price. Customers choose from this list when they book.',
      ],
      staff: [
        '2. Add your team',
        'Each person gets their own calendar; choose which services they offer. To give someone a login, invite them from Settings.',
      ],
      hours: [
        '3. Set your hours',
        "Choose the days and hours you're open. Customers can only book inside these times.",
      ],
      template: [
        "4. Choose your page's style",
        'Pick the template that fits your business. You can change it any time without losing anything.',
      ],
      brand: [
        'Make it yours',
        'Add your brand color and logo so the page looks like your business (Growth plan and up).',
      ],
      photos: ['Photos', 'Upload photos of your place or your work. The first one is the cover.'],
      publish: [
        '5. Publish your page',
        'When your services and hours are ready, publish the page and share the link on WhatsApp, Instagram or Google.',
      ],
      newAppointment: [
        'Bookings by phone or walk-in',
        'Someone called or came by? Add the appointment here and it shows up in your calendar.',
      ],
      policy: [
        'Booking rules',
        'Set how late customers can cancel, whether you confirm bookings yourself and, if you want, a SINPE Móvil deposit to cut no-shows.',
      ],
      billing: ['Your plan', 'See your plan, what it includes and how to pay it by SINPE Móvil.'],
      done: [
        "You're all set!",
        'You can start taking bookings. Replay this guide any time from "Setup guide" in the sidebar.',
      ],
      staffWelcome: ['Welcome!', "Here's a quick look at where you'll work every day."],
      staffCalendar: ['Your calendar', 'Your appointments, by day. Tap one to see the details.'],
      staffAppointments: [
        'Your appointments',
        'Open an appointment to confirm it, mark it done or record a payment.',
      ],
      staffDone: ["That's it!", 'Replay this guide any time from "Setup guide" in the sidebar.'],
    } as Record<string, [string, string]>,
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
