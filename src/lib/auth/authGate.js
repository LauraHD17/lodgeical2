// src/lib/auth/authGate.js
// Pure state-machine: given auth state + route config, returns a routing decision.
// No side effects. Fully testable.

/**
 * Auth gate decisions
 */
export const AUTH_GATE = {
  LOADING: 'LOADING',         // Auth state not yet resolved — show PageLoader
  LOGIN_REQUIRED: 'LOGIN_REQUIRED', // No session — redirect to /login
  ACCESS_DENIED: 'ACCESS_DENIED',   // Session exists but missing required permission
  ALLOW: 'ALLOW',             // All checks pass — render the page
}

/**
 * Determine the auth gate decision for a given route.
 *
 * @param {object} params
 * @param {boolean} params.isLoading - Auth context still resolving
 * @param {object|null} params.user - Auth user object (or null)
 * @param {string[]|null} params.permissions - User's permission list (or null)
 * @param {boolean} params.isPublicRoute - Route does not require auth
 * @param {string|null} params.requiredPermission - Permission required by route (or null)
 * @returns {string} One of AUTH_GATE values
 */
export function getAuthGateDecision({ isLoading, user, permissions, isPublicRoute, requiredPermission }) {
  // Public route: skip all auth checks
  if (isPublicRoute) return AUTH_GATE.ALLOW

  // Auth still resolving
  if (isLoading) return AUTH_GATE.LOADING

  // No session
  if (!user) return AUTH_GATE.LOGIN_REQUIRED

  // Session exists — check required permission
  if (requiredPermission && !(permissions ?? []).includes(requiredPermission)) {
    return AUTH_GATE.ACCESS_DENIED
  }

  return AUTH_GATE.ALLOW
}
