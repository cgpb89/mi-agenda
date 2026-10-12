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
  tour: {
    next: 'Siguiente',
    back: 'Atrás',
    skip: 'Saltar guía',
    finish: 'Terminar',
    goTo: ({ page }) => `Ir a ${page}`,
    stepOf: ({ n, total }) => `${n} de ${total}`,
    replay: 'Guía de inicio',
    label: 'Guía de inicio',
    steps: {
      welcome: [
        '¡Bienvenido! Configuremos tu negocio',
        'Esta guía corta te lleva por todo lo necesario para empezar a recibir reservas en línea. Puedes saltarla y verla de nuevo cuando quieras desde "Guía de inicio" en el menú.',
      ],
      sidebar: [
        'Tu menú',
        'Aquí está todo: tu agenda, citas, servicios, equipo, página de reservas y configuración.',
      ],
      services: [
        '1. Crea tus servicios',
        'Agrega lo que ofreces con su duración y precio. Los clientes eligen de esta lista al reservar.',
      ],
      staff: [
        '2. Agrega a tu equipo',
        'Cada persona tiene su propia agenda; elige qué servicios ofrece. Para darle acceso, invítala desde Configuración.',
      ],
      hours: [
        '3. Define tu horario',
        'Elige los días y horas en que atiendes. Los clientes solo pueden reservar dentro de ese horario.',
      ],
      template: [
        '4. Elige el estilo de tu página',
        'Escoge la plantilla que va con tu negocio. Puedes cambiarla cuando quieras sin perder nada.',
      ],
      brand: [
        'Hazla tuya',
        'Agrega tu color y tu logo para que la página se vea como tu negocio (plan Growth en adelante).',
      ],
      photos: ['Fotos', 'Sube fotos de tu local o de tu trabajo. La primera es la portada.'],
      publish: [
        '5. Publica tu página',
        'Cuando tus servicios y horario estén listos, publica la página y comparte el enlace por WhatsApp, Instagram o Google.',
      ],
      newAppointment: [
        'Citas por teléfono o en persona',
        '¿Alguien llamó o llegó al local? Agrega la cita aquí y aparece en tu agenda.',
      ],
      policy: [
        'Reglas de reserva',
        'Define hasta cuándo pueden cancelar, si confirmas tú las citas y, si quieres, un depósito por SINPE Móvil para reducir las ausencias.',
      ],
      billing: ['Tu plan', 'Mira tu plan, lo que incluye y cómo pagarlo por SINPE Móvil.'],
      done: [
        '¡Todo listo!',
        'Ya puedes recibir reservas. Vuelve a ver esta guía cuando quieras desde "Guía de inicio" en el menú.',
      ],
      staffWelcome: ['¡Bienvenido!', 'Un vistazo rápido a dónde vas a trabajar cada día.'],
      staffCalendar: ['Tu agenda', 'Tus citas por día. Toca una para ver los detalles.'],
      staffAppointments: [
        'Tus citas',
        'Abre una cita para confirmarla, marcarla como completada o registrar un pago.',
      ],
      staffDone: [
        '¡Eso es todo!',
        'Vuelve a ver esta guía cuando quieras desde "Guía de inicio" en el menú.',
      ],
    },
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
