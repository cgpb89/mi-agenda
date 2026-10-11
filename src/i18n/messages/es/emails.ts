import type { Messages } from '../en';

export const emails: Messages['emails'] = {
  resetSubject: 'Restablece tu contraseña de Tempo',
  resetBody: ({ link }) =>
    `Alguien pidió restablecer la contraseña de tu cuenta de Tempo.\n\nUsa este enlace en los próximos 30 minutos:\n${link}\n\nSi no fuiste tú, ignora este correo: tu contraseña no cambiará.`,
  inviteSubject: ({ business }) => `Te invitaron a ${business} en Tempo`,
  inviteBody: ({ inviter, business, role, link }) =>
    `${inviter} te invitó a unirte a ${business} en Tempo como ${role === 'MANAGER' ? 'administrador' : 'parte del equipo'}.\n\nAcepta dentro de los próximos 7 días:\n${link}\n\nSi no esperabas esta invitación, puedes ignorar este correo.`,
  bookedSubject: ({ service, business }) => `Reservado: ${service} en ${business}`,
  bookedWhenFormat: "cccc d 'de' LLLL 'a las' h:mm a",
  bookedBody: ({ service, staff, when, timezone, address, code, link }) =>
    `Tu cita quedó reservada.\n\n${service} con ${staff}\n${when} (${timezone})\n${address}\nConfirmación ${code}\n\nVer, reprogramar o cancelar:\n${link}\n`,
  ownerEndingSubject: ({ business, n }) =>
    `${business}: tu plan vence en ${n === 1 ? '1 día' : `${n} días`}`,
  ownerEndingBody: ({ business, date, link }) =>
    `Hola:

El período de prueba o pagado de ${business} en Tempo termina el ${date}. Después de esa fecha tu página de reservas queda fuera de línea y los clientes no pueden reservar hasta que se pague el plan.

Mira tu plan y cómo pagar:
${link}
`,
  ownerClosedSubject: ({ business }) =>
    `${business} está cerrado: tu página de reservas está fuera de línea`,
  ownerClosedBody: ({ business, deleteOn, link }) =>
    `Hola:

El plan de ${business} no se pagó, así que el negocio está cerrado y su página de reservas está fuera de línea.

Paga antes del ${deleteOn} para reabrirlo con todo tal como lo dejaste. Después de esa fecha, el negocio y todos sus datos (citas, clientes, servicios) se eliminan permanentemente.

Cómo pagar:
${link}
`,
  ownerDeletionSubject: ({ business, deleteOn }) =>
    `Último aviso: ${business} se eliminará el ${deleteOn}`,
  ownerDeletionBody: ({ business, deleteOn, link }) =>
    `Hola:

${business} sigue cerrado por falta de pago. El ${deleteOn}, el negocio y todos sus datos (citas, clientes, servicios, fotos) se eliminarán permanentemente. No se puede deshacer.

Paga antes para conservarlo todo:
${link}
`,
  ownerDateFormat: "d 'de' LLLL 'de' yyyy",
  reminderSubject: ({ service, business }) => `Recordatorio: ${service} en ${business} mañana`,
  reminderBody: ({ service, staff, when, timezone, address, link }) =>
    `¡Te esperamos!

${service} con ${staff}
${when} (${timezone})
${address}

¿Necesitas reprogramar o cancelar? Usa este enlace (reemplaza los anteriores):
${link}
`,
  confirmedSubject: ({ service, business }) => `Confirmada: ${service} en ${business}`,
  confirmedBody: ({ service, staff, when, timezone, address, deposit, link }) =>
    `Tu cita está confirmada.\n\n${service} con ${staff}\n${when} (${timezone})\n${address}\n${deposit ? `Depósito recibido: ${deposit}\n` : ''}\nVer, reprogramar o cancelar (este enlace reemplaza los anteriores):\n${link}\n`,
  depositFailedSubject: ({ service, business }) => `Reserva cancelada: ${service} en ${business}`,
  depositFailedBody: ({ service, business, when, expired }) =>
    `Tu reserva de ${service} para el ${when} se canceló porque ${expired ? 'no se pudo verificar el depósito por SINPE en 24 horas' : `${business} no pudo verificar el depósito por SINPE`}.\n\nSi ya pagaste, comunícate directamente con ${business}.\n`,
};
