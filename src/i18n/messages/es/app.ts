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
