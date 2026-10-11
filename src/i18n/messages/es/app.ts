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
