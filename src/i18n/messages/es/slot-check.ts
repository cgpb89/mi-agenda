import type { Messages } from '../en';

const ISO_DAYS_PLURAL = [
  'los lunes',
  'los martes',
  'los miércoles',
  'los jueves',
  'los viernes',
  'los sábados',
  'los domingos',
];

export const slotCheck: Messages['slotCheck'] = {
  chooseServiceAndStaff: 'Elige un servicio y un miembro del equipo.',
  doesntOffer: ({ staff, service }) => `${staff} no ofrece ${service}.`,
  free: ({ day, range, staff }) => `${day}, ${range}: ${staff} está disponible.`,
  past: 'Ese horario ya pasó.',
  businessClosed: ({ business, day }) => `${business} está cerrado el ${day}.`,
  notWorkingDay: ({ staff, isoDay }) => `${staff} no trabaja ${ISO_DAYS_PLURAL[isoDay - 1]}.`,
  onBreak: ({ staff }) => `Coincide con el descanso de ${staff}.`,
  blocked: ({ staff, range, reason }) => `${staff} bloqueó ${range}${reason ? `: ${reason}` : ''}.`,
  unavailableStaff: ({ staff }) => `${staff} no está disponible en ese horario.`,
  outsideHours: ({ staff, periods }) => `Fuera del horario de trabajo de ${staff} (${periods}).`,
  overlaps: ({ customer, range, service, staff }) =>
    `Se superpone con ${customer}, ${range} (${service}) con ${staff}.`,
  alreadyBooked: ({ staff }) => `${staff} ya tiene una cita en ese horario.`,
  unavailable: 'Ese horario no está disponible.',
};
