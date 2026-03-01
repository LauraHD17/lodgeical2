// src/lib/auth/permissions.js
// Permission constants and role-to-permission mapping.
// RouteGuard and nav filtering both read from here.

export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  MANAGE_RESERVATIONS: 'manage_reservations',
  VIEW_RESERVATIONS: 'view_reservations',
  MANAGE_ROOMS: 'manage_rooms',
  MANAGE_GUESTS: 'manage_guests',
  MANAGE_PAYMENTS: 'manage_payments',
  MANAGE_DOCUMENTS: 'manage_documents',
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_REPORTS: 'view_reports',
  MANAGE_MESSAGING: 'manage_messaging',
}

/** Permissions granted to each role */
const ROLE_PERMISSIONS = {
  owner: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.MANAGE_RESERVATIONS,
    PERMISSIONS.VIEW_RESERVATIONS,
    PERMISSIONS.MANAGE_ROOMS,
    PERMISSIONS.MANAGE_GUESTS,
    PERMISSIONS.MANAGE_PAYMENTS,
    PERMISSIONS.MANAGE_DOCUMENTS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_MESSAGING,
  ],
  manager: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.MANAGE_RESERVATIONS,
    PERMISSIONS.VIEW_RESERVATIONS,
    PERMISSIONS.MANAGE_ROOMS,
    PERMISSIONS.MANAGE_GUESTS,
    PERMISSIONS.MANAGE_PAYMENTS,
    PERMISSIONS.MANAGE_DOCUMENTS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_MESSAGING,
  ],
  staff: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_RESERVATIONS,
    PERMISSIONS.MANAGE_GUESTS,
    PERMISSIONS.MANAGE_DOCUMENTS,
    PERMISSIONS.MANAGE_MESSAGING,
  ],
}

/**
 * Returns the permission set for a given role.
 * @param {string} role - 'owner' | 'manager' | 'staff'
 * @returns {string[]}
 */
export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] ?? []
}

/**
 * Checks if a role has a specific permission.
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  return getRolePermissions(role).includes(permission)
}
