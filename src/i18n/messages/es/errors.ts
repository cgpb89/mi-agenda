import type { Messages } from '../en';

const FIELD = {
  name: { a: 'un nombre', the: 'el nombre' },
  businessName: { a: 'el nombre del negocio', the: 'el nombre del negocio' },
  customerName: { a: 'el nombre del cliente', the: 'el nombre del cliente' },
  serviceName: { a: 'el nombre del servicio', the: 'el nombre del servicio' },
};

const SCHEDULE = { business: 'Horario del negocio', staff: 'Horario del equipo' };
const ISO_DAY = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export const errors: Messages['errors'] = {
  generic: 'Algo salió mal. Inténtalo de nuevo.',
  checkFields: 'Revisa los campos marcados.',
  notFound: 'No encontrado.',
  noAccess: 'No tienes permiso para hacer eso.',
  signInToContinue: 'Inicia sesión para continuar.',
  crossSite: 'Solicitud entre sitios bloqueada.',
  rateLimited: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
  requestTooLarge: 'La solicitud es demasiado grande.',
  invalidRequest: 'Solicitud no válida.',

  enterEmail: 'Ingresa tu correo electrónico',
  emailTooLong: 'El correo electrónico es demasiado largo',
  enterValidEmail: 'Ingresa un correo electrónico válido',
  enterValidEmailPeriod: 'Ingresa un correo electrónico válido.',
  passwordTooShort: 'Usa al menos 10 caracteres',
  passwordTooLong: 'La contraseña es demasiado larga',
  enterPassword: 'Ingresa tu contraseña',
  passwordsDontMatch: 'Las contraseñas no coinciden',
  enterField: ({ field }) => `Ingresa ${FIELD[field].a}`,
  fieldTooLong: ({ field, max }) =>
    `${cap(FIELD[field].the)} debe tener menos de ${max} caracteres`,
  textTooLong: ({ max }) => `Debe tener menos de ${max} caracteres`,
  invalidId: 'Identificador no válido',
  invalidField: 'Revisa este campo',
  slugFormat: 'Usa de 3 a 48 letras minúsculas, números y guiones simples',
  slugHyphens: 'Usa solo guiones simples',
  slugReserved: 'Esa dirección está reservada. Prueba con otra',
  unknownTimeZone: 'Zona horaria desconocida',
  amountFormat: 'Ingresa un monto como 38 o 38.50',
  chooseCountry: 'Elige un país',
  chooseCategory: 'Elige una categoría',
  chooseDuration: 'Elige una duración',
  chooseWindow: 'Elige un plazo',
  wholeNumber: 'Usa un número entero',
  atLeast: ({ n }) => `Como mínimo ${n}`,
  atMost: ({ n }) => `Como máximo ${n}`,
  addReason: 'Agrega un motivo',
  pickDate: 'Elige una fecha',
  endAfterStart: 'La hora de fin debe ser posterior a la de inicio.',
  endDateAfterStart: 'La fecha de fin debe ser posterior a la de inicio.',
  invalidPeriods: ({ schedule, overlap, day }) =>
    `${SCHEDULE[schedule]}: ${overlap ? 'los períodos se superponen' : 'la hora de fin debe ser posterior a la de inicio'} (${ISO_DAY[day - 1]}).`,

  invalidLogin: 'El correo electrónico o la contraseña no son correctos.',
  emailExists: 'Ya existe una cuenta con este correo electrónico. Intenta iniciar sesión.',
  emailExistsField: 'Ya existe una cuenta con este correo electrónico',
  slugTaken: 'Esa dirección de reservas ya está en uso.',
  slugTakenField: 'Esa dirección ya está en uso. Prueba con otra',
  resetLinkInvalid:
    'Este enlace para restablecer la contraseña no es válido o venció. Solicita uno nuevo.',
  invitationInvalid: 'Esta invitación no es válida o venció.',
  invitationUsed: 'Esta invitación ya fue utilizada.',
  invitationOtherEmail:
    'Esta invitación es para otro correo electrónico. Inicia sesión con la cuenta invitada.',
  invitationAccountExists:
    'Ya existe una cuenta con este correo electrónico. Inicia sesión para aceptar la invitación.',
  alreadyOnTeam: 'Esa persona ya forma parte del equipo.',
  alreadyOnTeamField: 'Ya forma parte del equipo',
  invitationNotFound: 'No se encontró la invitación.',
  memberNotFound: 'No se encontró el miembro.',
  needsOwner: 'Un negocio necesita al menos un propietario activo.',

  businessNotFound: 'No se encontró el negocio.',
  appointmentNotFound: 'No se encontró la cita.',
  customerNotFound: 'No se encontró el cliente.',
  serviceNotFound: 'No se encontró el servicio.',
  staffNotFound: 'No se encontró el miembro del equipo.',
  staffHasUpcoming: ({ n }) =>
    `Esta persona tiene ${n} ${n === 1 ? 'cita próxima' : 'citas próximas'}. Reasígnalas o cancélalas primero.`,
  serviceHasUpcoming: ({ n }) =>
    `Este servicio tiene ${n} ${n === 1 ? 'cita próxima' : 'citas próximas'}. Reprográmalas o cancélalas primero.`,
  overrideNotFound: 'No se encontró la excepción.',
  paymentNotFound: 'No se encontró el pago.',
  userNotFound: 'No se encontró el usuario.',
  membershipNotFound: 'No se encontró la membresía.',
  flagNotFound: 'No se encontró la función.',
  unknownStaff: 'Miembro del equipo desconocido.',
  ownCalendarOnly: 'Solo puedes agregar citas a tu propia agenda.',
  chooseValidDateTime: 'Elige una fecha y hora válidas.',
  chooseService: 'Elige un servicio.',
  chooseCustomer: 'Elige un cliente.',
  staffDoesntOffer: 'Esa persona no ofrece este servicio.',
  nobodyOffers: 'Nadie ofrece este servicio en este momento.',
  enterReachablePhone: 'Ingresa un teléfono de contacto.',
  enterReachablePhoneField: 'Ingresa un teléfono de contacto',
  phoneWrongForCountry: 'Ese teléfono no parece correcto para el país seleccionado',
  phoneLooksWrong: 'Ese teléfono no parece correcto.',
  checkNumberAndCountry: 'Revisa el número y el país',
  phoneUsedByOther: 'Otro cliente ya usa ese teléfono.',
  phoneUsedByOtherField: 'Ya lo usa otro cliente',
  phoneLimitOne:
    'Este teléfono ya tiene una cita próxima aquí. Cancélala o espera a que termine antes de reservar otra.',
  phoneLimitMany: ({ max }) =>
    `Este teléfono ya tiene ${max} citas próximas aquí, que es el máximo que permite este negocio.`,
  slotPast: 'Ese horario ya pasó. Elige otro.',
  slotTooSoon: 'Ese horario es demasiado próximo para reservar en línea. Elige uno más tarde.',
  slotTooFar: 'Esa fecha es demasiado lejana para reservar. Elige una fecha más cercana.',
  slotTaken: 'Alguien acaba de reservar ese horario. Elige otro.',
  slotUnavailable: 'Ese horario no está disponible. Elige otro.',
  cantMove: 'Esta cita ya no se puede mover.',
  bookingFailed: 'No pudimos completar la reserva. Inténtalo de nuevo.',
  manageLinkInvalid: 'Este enlace de reserva ya no es válido.',
  cantChangeOnline: 'Esta cita ya no se puede modificar en línea.',
  tooCloseToChange:
    'Falta muy poco para la cita como para modificarla en línea. Comunícate con el negocio.',
  onlyPendingConfirm: 'Solo se pueden confirmar citas pendientes.',
  cantCancel: 'Esta cita ya no se puede cancelar.',
  alreadyClosed: 'Esta cita ya está cerrada.',
  notStarted: 'Esta cita todavía no comenzó.',
  publishRequirements:
    'Antes de publicar, agrega al menos un servicio en línea, un miembro del equipo que lo ofrezca y el horario del negocio.',
  chooseStaffFromTeam: 'Elige personas de tu equipo.',
  chooseServicesFromList: 'Elige servicios de tu lista.',

  amountPositive: 'Ingresa un monto mayor que cero.',
  refundTooLarge: 'Un reembolso no puede superar el monto cobrado.',
  amountTooHigh:
    'Ese monto es mucho mayor que el precio de la cita. Revísalo e inténtalo de nuevo.',
  cancelledRecordRefund: 'Esta cita se canceló. Registra un reembolso en su lugar.',
  alreadyVoided: 'Este movimiento ya está anulado.',
  voidRefundFirst: 'Primero anula el reembolso relacionado.',

  photoLimit: ({ n }) => `Puedes agregar hasta ${n} fotos. Elimina una para agregar otra.`,
  photosUnavailable: 'La carga de fotos no está disponible en este momento.',
  photoMissing: 'No encontramos esa carga. Inténtalo de nuevo.',
  alreadySuspended: 'Ya está suspendido.',
  notSuspended: 'Este negocio no está suspendido.',
  alreadyCurrentPlan: 'Ese ya es el plan actual.',
  cantSuspendSelf: 'No puedes suspender tu propia cuenta.',
  adminsViaCli: 'Los administradores de la plataforma se gestionan con la CLI de administración.',
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
