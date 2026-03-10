// src/config/routes.js
// Single source of truth for all routes, permissions, and public-route detection.
// React Router config, navigation items, permission checking, and public-route detection
// all read from this one export. Nothing is defined twice.

export const ROUTES = [
  // Admin routes (require auth)
  { path: '/',                     pageName: 'Dashboard',           permission: 'view_dashboard',      isPublic: false },
  { path: '/reservations',         pageName: 'Reservations',        permission: 'view_reservations',   isPublic: false },
  { path: '/rooms',                pageName: 'Rooms',               permission: 'manage_rooms',        isPublic: false },
  { path: '/guests',               pageName: 'Guests',              permission: 'manage_guests',       isPublic: false },
  { path: '/rates',                pageName: 'Rates',               permission: 'manage_rooms',        isPublic: false },
  { path: '/payments',             pageName: 'Payments',            permission: 'manage_payments',     isPublic: false },
  { path: '/messaging',            pageName: 'Messaging',           permission: 'manage_messaging',    isPublic: false },
  { path: '/documents',            pageName: 'Documents',           permission: 'manage_documents',    isPublic: false, navHidden: true },
  { path: '/maintenance',          pageName: 'Maintenance',         permission: 'manage_maintenance',  isPublic: false },
  { path: '/contacts',             pageName: 'Contacts',            permission: 'manage_contacts',     isPublic: false, navLabel: 'Admin Contacts' },
  { path: '/reports',              pageName: 'Reports',             permission: 'view_reports',        isPublic: false, navLabel: 'Reports & Financials' },
  { path: '/settings',             pageName: 'Settings',            permission: 'manage_settings',     isPublic: false },
  { path: '/import',               pageName: 'Import',              permission: 'manage_reservations', isPublic: false, navHidden: true },
  { path: '/calendar',             pageName: 'Calendar',            permission: 'view_reservations',   isPublic: false },
  { path: '/help',                 pageName: 'Help',                permission: 'view_dashboard',      isPublic: false, navLabel: 'Help & FAQ' },

  // Public routes (no auth required)
  { path: '/check-in',             pageName: 'GuestCheckIn',        isPublic: true },
  { path: '/widget',               pageName: 'Widget',              isPublic: true },
  { path: '/guest-portal',         pageName: 'GuestPortal',         isPublic: true },
  { path: '/booking-confirmation', pageName: 'BookingConfirmation', isPublic: true },
  { path: '/invoice/:id',          pageName: 'Invoice',             isPublic: true },
  { path: '/login',                pageName: 'Login',               isPublic: true },
  { path: '/demo',                 pageName: 'Demo',                isPublic: true },
  { path: '/onboarding',           pageName: 'OnboardingPath',      isPublic: true },
]

/** Array of all public paths (used by RouteGuard to skip auth checks) */
export const PUBLIC_PATHS = ROUTES.filter(r => r.isPublic).map(r => r.path)

/** Admin nav items (non-public, non-hidden routes) */
export const NAV_ITEMS = ROUTES.filter(r => !r.isPublic && !r.navHidden).map(r => ({
  path: r.path,
  label: r.navLabel ?? r.pageName,
  permission: r.permission,
}))
