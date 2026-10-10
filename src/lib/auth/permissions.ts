/**
 * Role → permission matrix. Deny by default: anything not listed is refused.
 * Pure module (no server imports) so it is unit-testable and usable in UI to
 * hide controls — but hiding is never the enforcement; services call `assertCan`.
 */
export type MembershipRole = 'OWNER' | 'MANAGER' | 'STAFF';

export type Permission =
  | 'dashboard.view'
  | 'appointments.read'
  | 'appointments.create'
  | 'appointments.manage.any' // confirm / cancel / reschedule / complete anyone's
  | 'appointments.manage.own' // same, only appointments assigned to the user's staff profile
  | 'payments.record.any'
  | 'payments.record.own'
  | 'payments.void'
  | 'customers.read'
  | 'customers.write'
  | 'services.manage'
  | 'staff.manage'
  | 'availability.manage'
  | 'policy.manage'
  | 'bookingPage.manage'
  | 'business.manage'
  | 'team.invite'
  | 'team.roles'
  | 'analytics.read'
  | 'revenue.read'
  | 'audit.read';

const STAFF: Permission[] = [
  'dashboard.view',
  'appointments.read',
  'appointments.create',
  'appointments.manage.own',
  'payments.record.own',
  'customers.read',
];

const MANAGER: Permission[] = [
  ...STAFF,
  'appointments.manage.any',
  'payments.record.any',
  'payments.void',
  'customers.write',
  'services.manage',
  'staff.manage',
  'availability.manage',
  'policy.manage',
  'bookingPage.manage',
  'business.manage',
  'team.invite',
  'analytics.read',
  'revenue.read',
  'audit.read',
];

const OWNER: Permission[] = [...MANAGER, 'team.roles'];

const MATRIX: Record<MembershipRole, ReadonlySet<Permission>> = {
  OWNER: new Set(OWNER),
  MANAGER: new Set(MANAGER),
  STAFF: new Set(STAFF),
};

export function can(role: MembershipRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role]?.has(permission) ?? false;
}

export const ROLE_RANK: Record<MembershipRole, number> = { STAFF: 1, MANAGER: 2, OWNER: 3 };
