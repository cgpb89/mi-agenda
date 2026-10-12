import { z } from 'zod';
import { can, type MembershipRole, type Permission } from '@/lib/auth/permissions';

/**
 * In-app guided tours (pure, client-safe). A tour walks across dashboard pages:
 * each step names the page it lives on and, optionally, the element it points
 * at (`data-tour="..."` in the UI). Steps the role can't act on are skipped.
 * Texts are in i18n under app.tour.steps.<stepId>.
 */
export const TOUR_IDS = ['setup', 'staff'] as const;
export type TourId = (typeof TOUR_IDS)[number];

export interface TourStep {
  id: string;
  /** Dashboard page key (/app/<slug>/<page>), or null for "wherever you are". */
  page: string | null;
  /** `data-tour` value of the element to highlight; none = centered card. */
  target?: string;
  /** Only shown to roles with this permission. */
  perm?: Permission;
}

export const TOURS: Record<TourId, TourStep[]> = {
  // Owners and managers: set the business up from zero to the first booking.
  setup: [
    { id: 'welcome', page: 'overview' },
    { id: 'sidebar', page: 'overview', target: 'sidebar' },
    { id: 'services', page: 'services', target: 'services-add', perm: 'services.manage' },
    { id: 'staff', page: 'staff', target: 'staff-add', perm: 'staff.manage' },
    {
      id: 'hours',
      page: 'availability',
      target: 'availability-hours',
      perm: 'availability.manage',
    },
    { id: 'template', page: 'booking-page', target: 'bp-template', perm: 'bookingPage.manage' },
    { id: 'brand', page: 'booking-page', target: 'bp-brand', perm: 'bookingPage.manage' },
    { id: 'photos', page: 'booking-page', target: 'bp-photos', perm: 'bookingPage.manage' },
    { id: 'publish', page: 'booking-page', target: 'bp-status', perm: 'bookingPage.manage' },
    {
      id: 'newAppointment',
      page: 'calendar',
      target: 'new-appointment',
      perm: 'appointments.create',
    },
    { id: 'policy', page: 'settings', target: 'settings-policy', perm: 'policy.manage' },
    { id: 'billing', page: 'billing', target: 'billing-plan', perm: 'billing.view' },
    { id: 'done', page: null },
  ],
  // Staff: their day-to-day.
  staff: [
    { id: 'staffWelcome', page: 'overview' },
    { id: 'staffCalendar', page: 'calendar', target: 'calendar-grid' },
    {
      id: 'newAppointment',
      page: 'calendar',
      target: 'new-appointment',
      perm: 'appointments.create',
    },
    { id: 'staffAppointments', page: 'appointments', target: 'appointments-list' },
    { id: 'staffDone', page: null },
  ],
};

export function tourFor(role: MembershipRole): TourId {
  return role === 'STAFF' ? 'staff' : 'setup';
}

export function stepsFor(tour: TourId, role: MembershipRole): TourStep[] {
  return TOURS[tour].filter((s) => !s.perm || can(role, s.perm));
}

export interface TourState {
  step: number;
  done: boolean;
}

const progressSchema = z.record(
  z.string(),
  z.object({ step: z.number().int().min(0).max(100), done: z.boolean() }),
);

/** Per-tour progress stored on the user (users.tour_progress). */
export function readTourProgress(raw: unknown): Record<string, TourState> {
  const parsed = progressSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}
