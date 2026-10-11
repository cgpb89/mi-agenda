/** Field names used inside validation messages ("Enter a name", "Keep the name under…"). */
const FIELD = {
  name: { a: 'a name', the: 'the name' },
  businessName: { a: 'a business name', the: 'business name' },
  customerName: { a: 'a customer name', the: 'customer name' },
  serviceName: { a: 'a service name', the: 'service name' },
};
export type FieldLabel = keyof typeof FIELD;

const SCHEDULE = { business: 'Business hours', staff: 'Staff hours' };
/** ISO weekday 1 (Monday) … 7 (Sunday). */
const ISO_DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Server-side messages (errors, validation). Referenced with `msg(key, params)`. */
export const errors = {
  generic: 'Something went wrong. Please try again.',
  checkFields: 'Please check the highlighted fields.',
  notFound: 'Not found.',
  noAccess: "You don't have access to do that.",
  signInToContinue: 'Please sign in to continue.',
  crossSite: 'Cross-site request blocked.',
  rateLimited: 'Too many attempts. Please wait a moment and try again.',
  requestTooLarge: 'Request too large.',
  invalidRequest: 'Invalid request.',

  // Validation
  enterEmail: 'Enter your email',
  emailTooLong: 'Email is too long',
  enterValidEmail: 'Enter a valid email',
  enterValidEmailPeriod: 'Enter a valid email.',
  passwordTooShort: 'Use at least 10 characters',
  passwordTooLong: 'Password is too long',
  enterPassword: 'Enter your password',
  passwordsDontMatch: 'Passwords do not match',
  enterField: ({ field }: { field: FieldLabel }) => `Enter ${FIELD[field].a}`,
  fieldTooLong: ({ field, max }: { field: FieldLabel; max: number }) =>
    `Keep the ${FIELD[field].the} under ${max} characters`,
  textTooLong: ({ max }: { max: number }) => `Keep this under ${max} characters`,
  invalidId: 'Invalid identifier',
  invalidField: 'Check this field',
  slugFormat: 'Use 3–48 lowercase letters, numbers and single hyphens',
  slugHyphens: 'Use single hyphens only',
  slugReserved: 'That address is reserved — try another',
  unknownTimeZone: 'Unknown time zone',
  amountFormat: 'Enter an amount like 38 or 38.50',
  chooseCountry: 'Choose a country',
  chooseCategory: 'Choose a category',
  chooseDuration: 'Choose a duration',
  chooseWindow: 'Choose a window',
  wholeNumber: 'Use a whole number',
  atLeast: ({ n }: { n: number }) => `At least ${n}`,
  atMost: ({ n }: { n: number }) => `At most ${n}`,
  addReason: 'Add a reason',
  pickDate: 'Pick a date',
  endAfterStart: 'End time must be after start time.',
  endDateAfterStart: 'End date must be after the start date.',
  invalidPeriods: ({
    schedule,
    overlap,
    day,
  }: {
    schedule: keyof typeof SCHEDULE;
    overlap: boolean;
    day: number;
  }) =>
    `${SCHEDULE[schedule]}: ${overlap ? 'periods overlap' : 'end time must be after start time'} (${ISO_DAY[day - 1]}).`,

  // Auth & invitations
  invalidLogin: 'Email or password is incorrect.',
  emailExists: 'An account with this email already exists. Try signing in.',
  emailExistsField: 'An account with this email already exists',
  slugTaken: 'That booking address is taken.',
  slugTakenField: 'That address is taken — try another',
  resetLinkInvalid: 'This reset link is invalid or has expired. Request a new one.',
  invitationInvalid: 'This invitation is invalid or has expired.',
  invitationUsed: 'This invitation was already used.',
  invitationOtherEmail:
    'This invitation is for a different email address. Sign in as the invited person.',
  invitationAccountExists:
    'An account with this email already exists. Sign in to accept the invitation.',
  alreadyOnTeam: 'That person is already on the team.',
  alreadyOnTeamField: 'Already on the team',
  invitationNotFound: 'Invitation not found.',
  memberNotFound: 'Member not found.',
  needsOwner: 'A business needs at least one active owner.',

  // Bookings
  businessNotFound: 'Business not found.',
  appointmentNotFound: 'Appointment not found.',
  customerNotFound: 'Customer not found.',
  serviceNotFound: 'Service not found.',
  staffNotFound: 'Staff member not found.',
  overrideNotFound: 'Override not found.',
  paymentNotFound: 'Payment not found.',
  userNotFound: 'User not found.',
  membershipNotFound: 'Membership not found.',
  flagNotFound: 'Flag not found.',
  unknownStaff: 'Unknown staff member.',
  ownCalendarOnly: 'You can only add appointments to your own calendar.',
  chooseValidDateTime: 'Choose a valid date and time.',
  chooseService: 'Choose a service.',
  chooseCustomer: 'Choose a customer.',
  staffDoesntOffer: "That person doesn't offer this service.",
  nobodyOffers: 'Nobody offers this service right now.',
  enterReachablePhone: 'Enter a phone number we can reach.',
  enterReachablePhoneField: 'Enter a phone number we can reach',
  phoneWrongForCountry: 'That phone number doesn’t look right for the selected country',
  phoneLooksWrong: 'That phone number doesn’t look right.',
  checkNumberAndCountry: 'Check the number and country',
  phoneUsedByOther: 'Another customer already uses that phone number.',
  phoneUsedByOtherField: 'Already used by another customer',
  phoneLimitOne:
    'This phone number already has an upcoming appointment here. Cancel or finish it before booking another.',
  phoneLimitMany: ({ max }: { max: number }) =>
    `This phone number already has ${max} upcoming appointments here, which is the most this business allows.`,
  slotPast: 'That time has already passed. Please choose another time.',
  slotTooSoon: 'That time is too soon to book online. Please choose a later time.',
  slotTooFar: 'That date is too far ahead to book. Please choose an earlier date.',
  slotTaken: 'That time was just taken. Please choose another time.',
  slotUnavailable: "That time isn't available. Please choose another time.",
  cantMove: 'This appointment can no longer be moved.',
  bookingFailed: "We couldn't complete that booking. Please try again.",
  manageLinkInvalid: 'This booking link is no longer valid.',
  cantChangeOnline: 'This appointment can no longer be changed online.',
  tooCloseToChange:
    'It’s too close to the appointment to change it online. Please contact the business.',
  onlyPendingConfirm: 'Only pending appointments can be confirmed.',
  cantCancel: 'This appointment can no longer be cancelled.',
  alreadyClosed: 'This appointment is already closed.',
  notStarted: "This appointment hasn't started yet.",
  publishRequirements:
    'Add at least one online service, a staff member who offers it, and business hours before publishing.',
  chooseStaffFromTeam: 'Choose staff from your team.',
  chooseServicesFromList: 'Choose services from your list.',

  // Payments
  amountPositive: 'Enter an amount greater than zero.',
  refundTooLarge: 'A refund cannot exceed the amount collected.',
  amountTooHigh: 'That amount is much higher than the appointment price. Check it and try again.',
  cancelledRecordRefund: 'This appointment was cancelled. Record a refund instead.',
  alreadyVoided: 'This entry is already voided.',
  voidRefundFirst: 'Void the related refund first.',

  // Booking-page photos
  photoLimit: ({ n }: { n: number }) => `You can add up to ${n} photos. Remove one to add another.`,
  photosUnavailable: 'Photo uploads are not available right now.',
  photoMissing: "We couldn't find that upload. Please try again.",

  // Platform admin
  alreadySuspended: 'Already suspended.',
  notSuspended: 'This business is not suspended.',
  alreadyCurrentPlan: 'That is already the current plan.',
  cantSuspendSelf: "You can't suspend your own account.",
  adminsViaCli: 'Platform admins are managed with the admin CLI.',
};
