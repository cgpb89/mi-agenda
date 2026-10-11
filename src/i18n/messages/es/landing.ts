import type { Messages } from '../en';

export const landing: Messages['landing'] = {
  nav: {
    howItWorks: 'Cómo funciona',
    templates: 'Plantillas',
    pricing: 'Precios',
    logIn: 'Iniciar sesión',
    startFree: 'Empieza gratis',
  },
  hero: {
    title: 'Tu próxima cita empieza aquí.',
    sub: 'Dales a tus clientes una forma más fácil de reservar y gana tiempo para dedicarte a tu negocio.',
    seeHow: 'Mira cómo funciona',
    scrollCue: 'Desplázate para recorrer la calle',
  },
  scenes: [
    { kind: 'Barbería', line: 'El primer turno del día se reservó anoche.' },
    {
      kind: 'Estudio de belleza',
      line: 'Tratamientos, profesionales e indicaciones en una sola página.',
    },
    { kind: 'Clínica de fisioterapia', line: 'Tipos de consulta, en persona o por video.' },
    {
      kind: 'Estudio de entrenamiento',
      line: 'Sesiones individuales, en pareja y en grupos reducidos.',
    },
    { kind: 'Reparaciones y asesoría', line: 'Cualquier negocio que funcione con citas.' },
  ],
  bookedPin: 'RESERVADO',
  pins: [
    'Degradado · Marcus',
    'Facial de autor · Amara',
    'Evaluación inicial · Dra. Ruiz',
    'HIIT en grupo · 4 de 6',
    'Diagnóstico de laptop · Ravi',
  ],
  customer: {
    eyebrow: 'DEL LADO DEL CLIENTE',
    steps: [
      [
        'Encuentra el negocio',
        'Tus clientes llegan a tu página desde un enlace, una búsqueda o tus redes sociales.',
      ],
      [
        'Elige un horario realmente libre',
        'Solo aparecen los horarios disponibles. Los descansos, márgenes y reservas existentes ya están contemplados.',
      ],
      [
        'Confirma con un toque',
        'Un número de confirmación, un archivo de calendario y una forma sencilla de reprogramar.',
      ],
    ],
  },
  owner: {
    eyebrow: 'FUERA DE HORARIO, DEL LADO DEL DUEÑO',
    title: 'Configúralo una vez. Tempo mantiene la agenda en orden.',
    steps: [
      [
        'Define tus horarios',
        'Horario semanal, turnos partidos y descansos. Feriados y cierres puntuales con un clic.',
      ],
      ['Agrega servicios y precios', 'Duración, precio y tiempo de margen para cada servicio.'],
      [
        'Dale a cada persona su horario',
        'Cada miembro del equipo tiene su propio horario y ofrece solo sus servicios.',
      ],
      [
        'Mira el día de un vistazo',
        'Las reservas en línea y las presenciales llegan a la misma agenda.',
      ],
      [
        'Descubre qué funciona',
        'Demanda por día y hora, servicios más populares e ingresos estimados.',
      ],
    ],
  },
  phone: {
    selection: 'Degradado · 60 min · Marcus',
    day: 'Sábado, 10 de oct',
    takenHint: 'Los horarios tachados ya están ocupados',
    booked: 'Cita reservada.',
    service: 'Servicio',
    with: 'Con',
    when: 'Cuándo',
    whenValue: 'Sáb 10 oct · 2:30 p.m.',
    addToCalendar: 'Agregar al calendario',
  },
  panel: {
    titles: ['Disponibilidad', 'Servicios', 'Equipo', 'Hoy', 'Estadísticas'],
    days: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
    dayLetters: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    closed: 'Cerrado',
    min: 'min',
    staffCaption: 'La semana de cada barbero. Más oscuro significa un turno más largo.',
    today: [
      'Degradado · Marcus',
      'Corte clásico · Theo',
      'Corte y barba · Marcus',
      'Arreglo de barba · Jun',
      'Degradado · Theo',
    ],
    valueLabel: 'Valor estimado de las citas · últimas 12 semanas',
    valueNote:
      'Valor estimado de las citas completadas. Los pagos cobrados se registran por separado.',
  },
  templates: {
    title: 'Cinco páginas de reserva. Un solo motor de reservas.',
    sub: 'Cada plantilla cambia el diseño, la tipografía y el estilo. Los servicios, el equipo y la disponibilidad funcionan igual por debajo. Prueba una.',
    tabsLabel: 'Plantillas de página de reservas',
    openDemo: 'Abrir la página de demostración',
    items: {
      barber: {
        label: 'Barbería y peluquería',
        headline: 'NORTHSIDE BARBER CO.',
        desc: 'Oscura, editorial y con mucha fotografía. Los barberos al frente y precios con líneas de puntos.',
      },
      wellness: {
        label: 'Belleza y bienestar',
        headline: 'Una hora de calma, reservada para ti.',
        desc: 'Tranquila, centrada y luminosa. Categorías de tratamientos, profesionales e indicaciones previas.',
      },
      consult: {
        label: 'Consultas',
        headline: 'Reserva una consulta',
        desc: 'Clara y accesible. Perfiles de profesionales, atención presencial o por video y políticas visibles. Solo se piden datos de contacto.',
      },
      fitness: {
        label: 'Fitness y entrenamiento',
        headline: 'ENTRENA CON INTENCIÓN.',
        desc: 'Intensa y dinámica. Tipos de sesión, tamaño de los grupos y entrenadores.',
      },
      services: {
        label: 'Servicios generales',
        headline: 'Reparaciones y asesoría, con cita previa.',
        desc: 'Neutra y modular. Ideal para consultores, talleres de reparación, profesores y fotógrafos.',
      },
    },
    footerFitness: 'Fitness',
  },
  analytics: {
    title: 'Descubre qué horarios rinden más.',
    sub: 'Demanda por día y hora, servicios populares, cancelaciones e ingresos estimados, cada uno con una explicación clara de lo que mide.',
    header: 'Northside Barber Co. · Últimos 90 días',
    demoData: 'DATOS DE EJEMPLO',
    kpis: [
      ['Citas completadas', '1.042', 'Estado: completada'],
      ['Próximas', '86', 'Próximos 30 días, confirmadas o pendientes'],
      ['Valor estimado de las citas', '$43.860', 'Precio × completadas, no pagos'],
      ['Tasa de cancelación', '6,1 %', 'Canceladas ÷ total reservadas'],
    ],
    weekly: 'Valor estimado de las citas, por semana',
    notPayments: 'No son pagos cobrados',
    weekTicks: ['13 jul', '10 ago', '7 sep', '5 oct'],
    busiestDays: 'Días con más movimiento',
    dayLetters: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    peakHours: 'Horas pico de reservas',
    peakNote: 'Citas que empiezan en cada hora. Las 5 p.m. es la hora más llena.',
    popular: 'Servicios más populares',
    suggestEyebrow: 'LO QUE SUGIEREN LOS NÚMEROS',
    suggestTitle:
      'El sábado de 2 a 6 p.m. está reservado al 94 %. El afeitado con toalla caliente es el menos elegido.',
    suggestBody:
      'Vale la pena probar: un sillón más los sábados y destacar el afeitado en tu página de reservas.',
  },
  benefits: {
    title: 'Menos tiempo al teléfono. Más tiempo con quienes están en el sillón.',
    items: [
      [
        'Reservas a toda hora',
        'Tu página toma citas mientras duermes, cortas el pelo o te tomas el día libre.',
      ],
      [
        'Menos reservas duplicadas',
        'Cada horario tiene en cuenta el horario del equipo, la duración del servicio, los descansos y las citas existentes.',
      ],
      [
        'Horarios que se adaptan a ti',
        'Turnos partidos, días distintos, horarios por persona y servicios de cualquier duración.',
      ],
      [
        'Una página con tu estilo',
        'Cinco plantillas, tus colores, tipografía y políticas. Sin programar.',
      ],
      [
        'Números que te ayudan a decidir',
        'Días de más movimiento, horas tranquilas y servicios populares, con una explicación clara de cada métrica.',
      ],
      [
        'Todas las citas en un solo lugar',
        'Reservas en línea, por teléfono y presenciales en una sola agenda y lista.',
      ],
    ],
  },
  pricing: {
    title: 'Empieza gratis. Crece a tu ritmo.',
    sample: 'Planes de ejemplo. Los precios finales se definirán en el lanzamiento.',
    billing: 'Facturación',
    monthly: 'Mensual',
    annual: 'Anual',
    selected: 'Seleccionado',
    perMonth: 'por mes',
    perMonthYearly: 'por mes, facturado anualmente',
    showCompare: 'Comparar todas las funciones',
    hideCompare: 'Ocultar la comparación',
    startWith: ({ plan }) => `Empieza gratis con ${plan}`,
    feature: 'Función',
    plans: [
      {
        name: 'Starter',
        for: 'Para una persona que recibe reservas.',
        feats: [
          'Una página de reservas',
          'Una agenda de equipo',
          'Las cinco plantillas',
          'Agenda y lista de citas',
          'Estadísticas básicas',
        ],
      },
      {
        name: 'Growth',
        for: 'Para un equipo pequeño con horarios fijos.',
        feats: [
          'Todo lo de Starter',
          'Hasta 5 horarios de equipo',
          'Directorio de clientes',
          'Estadísticas completas y filtros',
          'Colores y tipografía de tu marca',
        ],
      },
      {
        name: 'Business',
        for: 'Para equipos con mucho movimiento y varias sedes.',
        feats: [
          'Todo lo de Growth',
          'Equipo ilimitado',
          'Varias sedes',
          'Roles y permisos',
          'Exportación de datos',
        ],
      },
    ],
    compare: [
      ['Páginas de reserva', '1', '1', '1 por sede'],
      ['Agendas del equipo', '1', 'Hasta 5', 'Ilimitadas'],
      ['Plantillas', 'Las cinco', 'Las cinco', 'Las cinco'],
      ['Colores y tipografía propios', 'Predefinidos', '✓', '✓'],
      ['Directorio de clientes', '—', '✓', '✓'],
      ['Estadísticas', 'Básicas', 'Completas', 'Completas + exportación'],
      ['Roles y permisos', '—', '—', '✓'],
      ['Pagos y recordatorios por SMS', 'Previsto', 'Previsto', 'Previsto'],
    ],
  },
  cta: {
    title: 'Haz lugar para más de lo que importa.',
    button: 'Crea tu página de reservas',
  },
  footer: {
    tagline: 'Tu tiempo. Tu negocio. A tu manera.',
    product: 'Producto',
    templates: 'Plantillas',
    help: 'Ayuda',
    helpCentre: 'Centro de ayuda (previsto)',
    contact: 'Contacto (previsto)',
    legal: 'Legal',
    terms: 'Términos (previsto)',
    privacy: 'Privacidad (previsto)',
    copyright: '© 2026 Tempo (nombre provisorio).',
  },
  demo: {
    barber: {
      policy:
        'Cancelación gratuita hasta 4 horas antes. Si llegas más de 15 minutos tarde, puede que tengas que reprogramar.',
      staffTitles: ['Barbero sénior', 'Barbero', 'Barbero y colorista'],
      services: [
        ['Corte clásico', 'Corte con tijera y máquina, lavado y peinado.'],
        ['Degradado', 'Degradado al ras, combinado con el largo que prefieras arriba.'],
        ['Arreglo de barba', 'Perfilado, contornos y toalla caliente al final.'],
        ['Corte y barba', 'Corte completo con perfilado de barba.'],
        ['Afeitado con toalla caliente', 'Afeitado con navaja y dos toallas calientes.'],
      ],
    },
    wellness: {
      policy:
        'Llega 10 minutos antes. Puedes cancelar o mover tu visita sin costo hasta 24 horas antes.',
      staffTitles: ['Esteticista principal', 'Masajista'],
      services: [
        ['Facial de autor', 'Limpieza, exfoliación, máscara y masaje linfático.'],
        ['Masaje descontracturante', 'Presión lenta y profunda para liberar tensiones.'],
        ['Diseño y tinte de cejas', 'Diseño, perfilado y un tinte suave.'],
        ['Lifting de pestañas', 'Curvatura natural que dura de seis a ocho semanas.'],
      ],
    },
    consult: {
      policy:
        'Avisa con 24 horas de anticipación para cancelar. Las consultas por video reciben un enlace seguro por correo antes de la cita.',
      staffTitles: ['Fisioterapeuta', 'Fisioterapeuta deportivo'],
      services: [
        ['Evaluación inicial', 'Evaluación completa y un plan por escrito. Presencial.'],
        ['Sesión de seguimiento', 'Revisión del progreso y tratamiento. Presencial.'],
        ['Consulta por video', 'Asesoramiento y revisión de ejercicios por video.'],
        [
          'Evaluación ergonómica del puesto de trabajo',
          'Revisión del escritorio y la postura. Presencial o por video.',
        ],
      ],
    },
    fitness: {
      policy:
        'Cancela hasta 12 horas antes. Las sesiones grupales se hacen con al menos 2 personas reservadas.',
      staffTitles: ['Entrenador de fuerza', 'Entrenadora de acondicionamiento'],
      services: [
        ['Fuerza 1:1', 'Sesión de fuerza guiada, programada para ti.'],
        ['Sesión en pareja', 'Entrena con un amigo. El precio cubre a dos personas.'],
        ['HIIT en grupo', 'Hasta 6 personas. Circuito de acondicionamiento.'],
        ['Evaluación de movimiento', 'Primera visita. Evaluación de movilidad y plan.'],
      ],
    },
    services: {
      policy:
        'Trae tu dispositivo y el cargador. Puedes reprogramar en cualquier momento hasta 2 horas antes.',
      staffTitles: ['Técnico de hardware', 'Consultora de TI'],
      services: [
        [
          'Diagnóstico de laptop',
          'Encontramos la falla y te pasamos un presupuesto antes de trabajar.',
        ],
        [
          'Cambio de pantalla',
          'La mayoría de los modelos en el día. Los repuestos se cotizan aparte.',
        ],
        [
          'Consulta de recuperación de datos',
          'Evaluamos los discos y las opciones de recuperación.',
        ],
        ['Armado de oficina en casa', 'Red, impresora y escritorio instalados en el lugar.'],
      ],
    },
  },
};
