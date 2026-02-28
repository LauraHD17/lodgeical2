// tests/unit/authGate.test.js
// Tests for the pure authGate state machine.
// 100% coverage target.

import { describe, it, expect } from 'vitest'
import { getAuthGateDecision, AUTH_GATE } from '../../src/lib/auth/authGate.js'
import { getRolePermissions, hasPermission, PERMISSIONS } from '../../src/lib/auth/permissions.js'

const mockUser = { id: 'user-1', email: 'test@example.com' }
const ownerPerms = getRolePermissions('owner')
const staffPerms = getRolePermissions('staff')

// ─── Auth gate state machine ────────────────────────────────────────────────

describe('getAuthGateDecision — public routes', () => {
  it('allows public routes regardless of auth state', () => {
    expect(getAuthGateDecision({ isLoading: true, user: null, permissions: null, isPublicRoute: true, requiredPermission: null }))
      .toBe(AUTH_GATE.ALLOW)
    expect(getAuthGateDecision({ isLoading: false, user: null, permissions: null, isPublicRoute: true, requiredPermission: null }))
      .toBe(AUTH_GATE.ALLOW)
    expect(getAuthGateDecision({ isLoading: false, user: mockUser, permissions: ownerPerms, isPublicRoute: true, requiredPermission: null }))
      .toBe(AUTH_GATE.ALLOW)
  })
})

describe('getAuthGateDecision — loading state', () => {
  it('returns LOADING when auth is still resolving (non-public route)', () => {
    expect(getAuthGateDecision({ isLoading: true, user: null, permissions: null, isPublicRoute: false, requiredPermission: 'view_dashboard' }))
      .toBe(AUTH_GATE.LOADING)
  })
})

describe('getAuthGateDecision — login required', () => {
  it('returns LOGIN_REQUIRED when no user on a protected route', () => {
    expect(getAuthGateDecision({ isLoading: false, user: null, permissions: null, isPublicRoute: false, requiredPermission: 'view_dashboard' }))
      .toBe(AUTH_GATE.LOGIN_REQUIRED)
  })

  it('returns LOGIN_REQUIRED for protected route with no required permission either', () => {
    expect(getAuthGateDecision({ isLoading: false, user: null, permissions: null, isPublicRoute: false, requiredPermission: null }))
      .toBe(AUTH_GATE.LOGIN_REQUIRED)
  })
})

describe('getAuthGateDecision — access denied', () => {
  it('returns ACCESS_DENIED when user lacks required permission', () => {
    expect(getAuthGateDecision({ isLoading: false, user: mockUser, permissions: staffPerms, isPublicRoute: false, requiredPermission: 'manage_settings' }))
      .toBe(AUTH_GATE.ACCESS_DENIED)
  })

  it('returns ACCESS_DENIED when permissions array is null', () => {
    expect(getAuthGateDecision({ isLoading: false, user: mockUser, permissions: null, isPublicRoute: false, requiredPermission: 'view_dashboard' }))
      .toBe(AUTH_GATE.ACCESS_DENIED)
  })
})

describe('getAuthGateDecision — allow', () => {
  it('allows when user has required permission', () => {
    expect(getAuthGateDecision({ isLoading: false, user: mockUser, permissions: ownerPerms, isPublicRoute: false, requiredPermission: 'manage_settings' }))
      .toBe(AUTH_GATE.ALLOW)
  })

  it('allows when user is authenticated and no permission required', () => {
    expect(getAuthGateDecision({ isLoading: false, user: mockUser, permissions: staffPerms, isPublicRoute: false, requiredPermission: null }))
      .toBe(AUTH_GATE.ALLOW)
  })
})

// ─── Permission model ────────────────────────────────────────────────────────

describe('permissions — role model', () => {
  it('owner has all permissions', () => {
    const perms = getRolePermissions('owner')
    expect(perms).toContain(PERMISSIONS.MANAGE_SETTINGS)
    expect(perms).toContain(PERMISSIONS.VIEW_REPORTS)
    expect(perms).toContain(PERMISSIONS.MANAGE_PAYMENTS)
  })

  it('staff cannot manage settings or payments', () => {
    const perms = getRolePermissions('staff')
    expect(perms).not.toContain(PERMISSIONS.MANAGE_SETTINGS)
    expect(perms).not.toContain(PERMISSIONS.MANAGE_PAYMENTS)
  })

  it('staff can view dashboard and manage guests', () => {
    const perms = getRolePermissions('staff')
    expect(perms).toContain(PERMISSIONS.VIEW_DASHBOARD)
    expect(perms).toContain(PERMISSIONS.MANAGE_GUESTS)
  })

  it('manager has manage_payments but not manage_settings', () => {
    const perms = getRolePermissions('manager')
    expect(perms).toContain(PERMISSIONS.MANAGE_PAYMENTS)
    expect(perms).not.toContain(PERMISSIONS.MANAGE_SETTINGS)
  })

  it('returns empty array for unknown role', () => {
    expect(getRolePermissions('unknown')).toEqual([])
  })

  it('hasPermission helper works correctly', () => {
    expect(hasPermission('owner', PERMISSIONS.MANAGE_SETTINGS)).toBe(true)
    expect(hasPermission('staff', PERMISSIONS.MANAGE_SETTINGS)).toBe(false)
    expect(hasPermission('unknown', PERMISSIONS.VIEW_DASHBOARD)).toBe(false)
  })
})
