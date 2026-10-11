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
};
