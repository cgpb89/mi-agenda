import type { Messages } from '../en';

export const common: Messages['common'] = {
  language: 'Idioma',
  today: 'Hoy',
  close: 'Cerrar',
  tomorrow: 'Mañana',
  categories: {
    BARBER: 'Barbería y peluquería',
    WELLNESS: 'Belleza y bienestar',
    CONSULT: 'Salud y consultas',
    FITNESS: 'Fitness y entrenamiento',
    SERVICES: 'Servicios generales',
  },
  templates: {
    BARBER: 'Barbería',
    WELLNESS: 'Bienestar',
    CONSULT: 'Consultorio',
    FITNESS: 'Fitness',
    SERVICES: 'Servicios generales',
  },
  status: {
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmada',
    COMPLETED: 'Completada',
    CANCELLED: 'Cancelada',
    NO_SHOW: 'No asistió',
    ACTIVE: 'Activo',
    TRIAL: 'Prueba',
    SUSPENDED: 'Suspendido',
    CHURNED: 'Dado de baja',
    INACTIVE: 'Inactivo',
  },
  homeLabel: 'Inicio de Tempo',
  metaTitle: 'Tempo — Tu próxima cita empieza aquí',
  metaDescription:
    'Páginas de reserva, agenda y estadísticas para negocios que trabajan con citas.',
  notFound: {
    title: 'No encontramos esa página',
    body: 'Puede que el enlace esté mal o que la página ya no esté disponible.',
    home: 'Ir a la página de inicio',
  },
  error: {
    eyebrow: 'Algo salió mal',
    title: 'Tuvimos un problema',
    body: 'Inténtalo de nuevo. Si sigue pasando, espera un minuto y recarga la página.',
    retry: 'Reintentar',
    home: 'Inicio',
  },
};
