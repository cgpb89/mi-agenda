type Svc = [name: string, description: string];

/** Landing-page copy. Business and people names are proper nouns and stay untranslated. */
export const landing = {
  nav: {
    howItWorks: 'How it works',
    templates: 'Templates',
    pricing: 'Pricing',
    logIn: 'Log in',
    startFree: 'Start free',
  },
  hero: {
    title: 'Your next appointment starts here.',
    sub: 'Give your customers an easier way to book, and give yourself more time to run your business.',
    seeHow: 'See how it works',
    scrollCue: 'Scroll to walk the street',
  },
  scenes: [
    { kind: 'Barbershop', line: 'The first chair of the day was booked last night.' },
    { kind: 'Beauty studio', line: 'Treatments, practitioners and prep notes on one page.' },
    { kind: 'Physio clinic', line: 'Consultation types, in person or by video.' },
    { kind: 'Fitness studio', line: 'One-to-one, partner and small-group sessions.' },
    { kind: 'Repair & advisory', line: 'Any business that runs on appointments.' },
  ],
  bookedPin: 'BOOKED',
  /** Street pins: what was just booked at each shop. */
  pins: [
    'Skin Fade · Marcus',
    'Signature Facial · Amara',
    'Initial assessment · Dr. Ruiz',
    'Small Group HIIT · 4 of 6',
    'Laptop diagnostic · Ravi',
  ],
  customer: {
    eyebrow: 'THE CUSTOMER’S SIDE',
    steps: [
      ['Find the business', 'Customers land on your page from a link, a search or your socials.'],
      [
        'Pick a time that is actually free',
        'Only open slots appear. Breaks, buffers and existing bookings are already accounted for.',
      ],
      [
        'Confirm in one tap',
        'A confirmation number, a calendar file and an easy way to reschedule.',
      ],
    ] as [string, string][],
  },
  owner: {
    eyebrow: 'AFTER HOURS, THE OWNER’S SIDE',
    title: 'Set it up once. Tempo keeps the diary honest.',
    steps: [
      [
        'Set your hours',
        'Weekly hours, split shifts and breaks. Holidays and one-off closures in a click.',
      ],
      ['Add services and prices', 'Duration, price and buffer time for every service.'],
      [
        'Give each person a schedule',
        'Staff keep their own hours and offer only the services they do.',
      ],
      ['See the day at a glance', 'Online and walk-in bookings land in the same calendar.'],
      ['Know what is working', 'Demand by day and hour, popular services and estimated revenue.'],
    ] as [string, string][],
  },
  phone: {
    selection: 'Skin Fade · 60 min · Marcus',
    day: 'Saturday, Oct 10',
    takenHint: 'Struck-through times are taken',
    booked: 'You’re booked.',
    service: 'Service',
    with: 'With',
    when: 'When',
    whenValue: 'Sat, Oct 10 · 2:30 PM',
    addToCalendar: 'Add to calendar',
  },
  panel: {
    titles: ['Availability', 'Services', 'Staff', 'Today', 'Analytics'],
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    dayLetters: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    closed: 'Closed',
    min: 'min',
    staffCaption: 'Each barber’s own week. Darker means a longer shift.',
    today: [
      'Skin Fade · Marcus',
      'Classic Cut · Theo',
      'Cut & Beard · Marcus',
      'Beard Trim · Jun',
      'Skin Fade · Theo',
    ],
    valueLabel: 'Estimated appointment value · last 12 weeks',
    valueNote:
      'Estimated value of completed appointments. Collected payments are tracked separately.',
  },
  templates: {
    title: 'Five booking pages. One booking engine.',
    sub: 'Each template changes the layout, type and mood. Services, staff and availability work the same underneath. Try one.',
    tabsLabel: 'Booking page templates',
    openDemo: 'Open the full demo page',
    items: {
      barber: {
        label: 'Barber & hair',
        headline: 'NORTHSIDE BARBER CO.',
        desc: 'Dark, editorial and photo-led. Barber profiles up front, prices with dotted leaders.',
      },
      wellness: {
        label: 'Beauty & wellness',
        headline: 'A quieter hour, set aside for you.',
        desc: 'Calm, centred and airy. Treatment categories, practitioners and preparation notes.',
      },
      consult: {
        label: 'Consultations',
        headline: 'Book a consultation',
        desc: 'Clear and accessible. Practitioner profiles, in-person or video, and visible policies. Only contact details are collected.',
      },
      fitness: {
        label: 'Fitness & coaching',
        headline: 'TRAIN WITH INTENT.',
        desc: 'Loud and kinetic. Session types, group sizes and coaches.',
      },
      services: {
        label: 'General services',
        headline: 'Repairs and advice, by appointment.',
        desc: 'Neutral and modular. Fits consultants, repair shops, tutors and photographers.',
      },
    },
    footerFitness: 'Fitness',
  },
  analytics: {
    title: 'See which hours earn their keep.',
    sub: 'Demand by day and hour, popular services, cancellations and estimated revenue, each with a plain label for what it counts.',
    header: 'Northside Barber Co. · Last 90 days',
    demoData: 'DEMO DATA',
    kpis: [
      ['Appointments completed', '1,042', 'Status: completed'],
      ['Upcoming', '86', 'Next 30 days, confirmed or pending'],
      ['Estimated appointment value', '$43,860', 'Price × completed, not payments'],
      ['Cancellation rate', '6.1%', 'Cancelled ÷ all booked'],
    ] as [string, string, string][],
    weekly: 'Estimated appointment value, weekly',
    notPayments: 'Not collected payments',
    weekTicks: ['Jul 13', 'Aug 10', 'Sep 7', 'Oct 5'],
    busiestDays: 'Busiest days',
    dayLetters: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    peakHours: 'Peak booking hours',
    peakNote: 'Appointments starting each hour. 5 PM is the fullest.',
    popular: 'Most popular services',
    suggestEyebrow: 'WHAT THE NUMBERS SUGGEST',
    suggestTitle: 'Saturday 2–6 PM is 94% booked. Hot Towel Shave is chosen least.',
    suggestBody:
      'Worth testing: an extra Saturday chair, and featuring the shave on your booking page.',
  },
  benefits: {
    title: 'Less time on the phone. More time with the people in the chair.',
    items: [
      [
        'Bookings around the clock',
        'Your page takes appointments while you sleep, cut hair or take a day off.',
      ],
      [
        'Fewer double bookings',
        'Every slot checks staff hours, service length, breaks and existing appointments.',
      ],
      [
        'Hours that fit how you work',
        'Split shifts, different days, per-person schedules and services of any length.',
      ],
      ['A page that looks like you', 'Five templates, your colours, type and policies. No code.'],
      [
        'Numbers you can act on',
        'Busy days, quiet hours and popular services, with clear labels for what each metric counts.',
      ],
      [
        'One place for every appointment',
        'Online, phone and walk-in bookings in a single calendar and list.',
      ],
    ] as [string, string][],
  },
  pricing: {
    title: 'Start free. Grow into it.',
    sample: 'Your first month is free. Pay yearly and get 2 months free.',
    billing: 'Billing',
    monthly: 'Monthly',
    annual: 'Annual',
    selected: 'Selected',
    perMonth: 'per month',
    perMonthYearly: 'per month, billed yearly',
    showCompare: 'Compare all features',
    hideCompare: 'Hide feature comparison',
    startWith: ({ plan }: { plan: string }) => `Start free with ${plan}`,
    feature: 'Feature',
    plans: [
      {
        name: 'Starter',
        price: { monthly: '$17', annual: '$14' },
        for: 'For one person taking bookings.',
        feats: [
          'One booking page',
          'One staff calendar',
          'All five templates',
          'Calendar and appointment list',
          'Core analytics',
        ],
      },
      {
        name: 'Growth',
        price: { monthly: '$29', annual: '$24' },
        for: 'For a small team with set schedules.',
        feats: [
          'Everything in Starter',
          'Up to 5 staff schedules',
          'Customer directory',
          'Full analytics and filters',
          'Custom brand colours and type',
        ],
      },
      {
        name: 'Business',
        price: { monthly: '$59', annual: '$49' },
        for: 'For busy teams and multiple locations.',
        feats: [
          'Everything in Growth',
          'Unlimited staff',
          'Multiple locations',
          'Roles and permissions',
          'Data export',
        ],
      },
    ],
    compare: [
      ['Booking pages', '1', '1', '1 per location'],
      ['Staff calendars', '1', 'Up to 5', 'Unlimited'],
      ['Templates', 'All five', 'All five', 'All five'],
      ['Custom colours and type', 'Preset', '✓', '✓'],
      ['Customer directory', '—', '✓', '✓'],
      ['Analytics', 'Core', 'Full', 'Full + export'],
      ['Roles and permissions', '—', '—', '✓'],
      ['Payments, SMS reminders', 'Planned', 'Planned', 'Planned'],
    ] as [string, string, string, string][],
  },
  cta: {
    title: 'Make room for more of what matters.',
    button: 'Create your booking page',
  },
  footer: {
    tagline: 'Your time. Your business. Your way.',
    product: 'Product',
    templates: 'Templates',
    help: 'Help',
    helpCentre: 'Help centre (planned)',
    contact: 'Contact (planned)',
    legal: 'Legal',
    terms: 'Terms (planned)',
    privacy: 'Privacy (planned)',
    copyright: '© 2026 Tempo (working name).',
  },
  /** Text for the demo businesses used by the template switcher. */
  demo: {
    barber: {
      policy:
        'Free cancellation up to 4 hours before. Late arrivals over 15 minutes may need to rebook.',
      staffTitles: ['Senior barber', 'Barber', 'Barber & colourist'],
      services: [
        ['Classic Cut', 'Scissor and clipper cut, wash and style.'],
        ['Skin Fade', 'Tight fade blended to your length on top.'],
        ['Beard Trim', 'Shape, line-up and hot towel finish.'],
        ['Cut & Beard', 'Full cut with beard shaping.'],
        ['Hot Towel Shave', 'Straight razor shave, two towels.'],
      ] as Svc[],
    },
    wellness: {
      policy:
        'Please arrive 10 minutes early. Cancel or move your visit up to 24 hours before at no charge.',
      staffTitles: ['Lead aesthetician', 'Massage therapist'],
      services: [
        ['Signature Facial', 'Cleanse, exfoliation, mask and lymphatic massage.'],
        ['Deep Tissue Massage', 'Slow, focused pressure for tension.'],
        ['Brow Shape & Tint', 'Mapping, shaping and a soft tint.'],
        ['Lash Lift', 'Natural curl that lasts six to eight weeks.'],
      ] as Svc[],
    },
    consult: {
      policy:
        'Please give 24 hours notice to cancel. Video consultations receive a secure link by email before the visit.',
      staffTitles: ['Physiotherapist', 'Sports physiotherapist'],
      services: [
        ['Initial assessment', 'Full assessment and a written plan. In person.'],
        ['Follow-up session', 'Progress review and treatment. In person.'],
        ['Video consultation', 'Advice and exercise review by video.'],
        ['Workplace ergonomic review', 'Desk and posture review. In person or video.'],
      ] as Svc[],
    },
    fitness: {
      policy: 'Cancel up to 12 hours before. Group sessions run with at least 2 people booked.',
      staffTitles: ['Strength coach', 'Conditioning coach'],
      services: [
        ['1:1 Strength', 'Coached strength session, programmed for you.'],
        ['Partner Session', 'Train with a friend. Price covers two people.'],
        ['Small Group HIIT', 'Up to 6 people. Conditioning circuit.'],
        ['Movement Assessment', 'First visit. Mobility screen and plan.'],
      ] as Svc[],
    },
    services: {
      policy: 'Bring your device and charger. Reschedule anytime up to 2 hours before.',
      staffTitles: ['Hardware technician', 'IT consultant'],
      services: [
        ['Laptop diagnostic', 'We find the fault and quote before any work.'],
        ['Screen replacement', 'Most models same day. Parts quoted separately.'],
        ['Data recovery consult', 'Assess drives and recovery options.'],
        ['Home office setup', 'On-site network, printer and desk setup.'],
      ] as Svc[],
    },
  },
};
