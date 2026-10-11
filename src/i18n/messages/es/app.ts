import type { Messages } from '../en';

export const app: Messages['app'] = {
  sidebar: 'Barra lateral',
  mainNav: 'Principal',
  closeMenu: 'Cerrar menú',
  openMenu: 'Abrir menú',
  viewBookingPage: 'Ver página de reservas ↗',
  platformAdmin: 'Administración de la plataforma ↗',
  signOut: 'Cerrar sesión',
  newAppointment: '+ Nueva cita',
  billingPage: {
    title: 'Plan y facturación',
    yourPlan: 'Tu plan',
    trialUntil: ({ date, n }) =>
      `Prueba gratis hasta el ${date} · ${n === 1 ? 'queda 1 día' : `quedan ${n} días`}`,
    paidUntil: ({ date, n }) =>
      `Pagado hasta el ${date} · ${n === 1 ? 'queda 1 día' : `quedan ${n} días`}`,
    closedSince: ({ date }) => `Cerrado desde el ${date} (sin pago)`,
    staff: ({ n }) => `Miembros activos del equipo: ${n}`,
    photos: ({ n }) => `Fotos de la página de reservas: ${n}`,
    unlimited: 'ilimitado',
    included: 'Incluye',
    plans: 'Planes',
    perMonth: 'por mes',
    current: 'Actual',
    howToPay: 'Cómo pagar',
    sinpeTo: 'Envía el monto del plan por SINPE Móvil a:',
    reference: 'Usa esto como descripción del pago:',
    afterPaying:
      'Después de pagar, envíanos el comprobante de SINPE. Registramos el pago y se extiende tu acceso (1 mes o 1 año).',
    whatsapp: 'Enviar comprobante por WhatsApp',
    email: 'Enviar comprobante por correo',
    whatsappText: ({ business, ref }) =>
      `Hola, pagué el plan de Tempo para ${business} (referencia ${ref}). Adjunto el comprobante de SINPE.`,
    notConfigured: 'Pronto verás aquí los datos de pago. Contacta a soporte para pagar tu plan.',
    seeBilling: 'Plan y facturación',
  },
  plans: {
    availableFrom: ({ plan }) => `Disponible en el plan ${plan}`,
    upgradeBody: 'Mejora tu plan para desbloquear esta y otras funciones.',
    seePlans: 'Ver planes',
    customersBody:
      'Ten un directorio de clientes con historial de visitas, gasto y próximas citas de todos los que reservan contigo.',
    analyticsLimited:
      'Tu plan muestra los últimos 30 días. Mejora tu plan para ver más tiempo y filtrar por persona y servicio.',
  },
  billing: {
    trialDays: ({ n }) =>
      n === 1 ? 'Prueba gratis: queda 1 día' : `Prueba gratis: quedan ${n} días`,
    trialEnds: ({ date }) =>
      `Tu prueba termina el ${date}. Elige un plan para mantener tu página de reservas en línea.`,
    renewDays: ({ n }) => (n === 1 ? 'Tu plan vence en 1 día' : `Tu plan vence en ${n} días`),
    renewEnds: ({ date }) =>
      `Renueva antes del ${date} para mantener tu página de reservas en línea.`,
    contact: 'Contáctanos para pagar',
    closedTitle: 'Tu negocio está cerrado',
    closedBody: ({ date }) =>
      `Tu prueba o período pagado terminó el ${date}. Tu página de reservas está fuera de línea y los clientes no pueden reservar.`,
    closedDeletion: ({ date, n }) =>
      `Paga antes del ${date} para reabrirlo con todo tal como lo dejaste. Después de esa fecha, el negocio y todos sus datos (citas, clientes, servicios) se eliminan permanentemente. ${n === 1 ? 'Queda 1 día.' : `Quedan ${n} días.`}`,
    closedHow: 'Para pagar tu plan y reabrir de inmediato, contáctanos.',
  },
  titles: {
    availability: 'Disponibilidad y horarios',
    customer: 'Cliente',
    onboarding: 'Configura tu negocio',
  },
  nav: {
    overview: 'Resumen',
    calendar: 'Agenda',
    appointments: 'Citas',
    services: 'Servicios',
    staff: 'Equipo',
    customers: 'Clientes',
    analytics: 'Estadísticas',
    'booking-page': 'Página de reservas',
    availability: 'Disponibilidad',
    settings: 'Configuración del negocio',
    billing: 'Plan y facturación',
  },
  roles: { OWNER: 'Propietario', MANAGER: 'Administrador', STAFF: 'Equipo' },
  pageUnpublished: 'Sin publicar',
  pageDraft: 'Borrador · sin publicar',
  noBusiness: {
    metaTitle: 'Tus negocios',
    eyebrow: 'Todavía no hay negocio',
    title: 'No formas parte de ningún negocio',
    body: 'Tu cuenta no pertenece a ningún negocio activo. Si un negocio te invitó, vuelve a abrir el enlace de la invitación. Si una cuenta fue suspendida, comunícate con el propietario del negocio.',
    platformAdmin: 'Administración de la plataforma',
  },
};
