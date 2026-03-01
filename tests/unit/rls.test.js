// tests/unit/rls.test.js
// Tests for RLS policy logic.
// These verify the SQL policy INTENT using JavaScript simulation.
// Integration tests against real Supabase would verify actual DB enforcement.

import { describe, it, expect } from 'vitest'

// ─── Simulated DB state ──────────────────────────────────────────────────────

const propertyA = { id: 'prop-a', is_active: true, is_public: true }
const propertyB = { id: 'prop-b', is_active: true, is_public: true }
const privateProperty = { id: 'prop-private', is_active: true, is_public: false }
const inactiveProperty = { id: 'prop-inactive', is_active: false, is_public: true }

const userA = { id: 'user-a' }
const userB = { id: 'user-b' }

const accessRecords = [
  { user_id: 'user-a', property_id: 'prop-a', role: 'owner' },
  { user_id: 'user-b', property_id: 'prop-b', role: 'staff' },
]

const reservationsA = [
  { id: 'res-1', property_id: 'prop-a', confirmation_number: 'ABCDEF' },
  { id: 'res-2', property_id: 'prop-a', confirmation_number: 'GHIJKL' },
]
const reservationsB = [
  { id: 'res-3', property_id: 'prop-b', confirmation_number: 'MNOPQR' },
]
const allReservations = [...reservationsA, ...reservationsB]

// ─── RLS policy simulation functions ─────────────────────────────────────────

/**
 * Simulates: "does auth.uid() have access to this property via user_property_access?"
 */
function hasPropertyAccess(userId, propertyId) {
  return accessRecords.some(r => r.user_id === userId && r.property_id === propertyId)
}

/**
 * Simulates admin_access_reservations RLS policy
 */
function applyAdminReservationPolicy(userId, reservations) {
  return reservations.filter(res => hasPropertyAccess(userId, res.property_id))
}

/**
 * Simulates public_read_active_rooms / public_read_active_property
 */
function applyPublicPropertyPolicy(properties) {
  return properties.filter(p => p.is_active && p.is_public)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RLS: admin_access_reservations policy', () => {
  it('User A can only read their own property reservations', () => {
    const visible = applyAdminReservationPolicy(userA.id, allReservations)
    expect(visible).toHaveLength(2)
    expect(visible.every(r => r.property_id === 'prop-a')).toBe(true)
  })

  it('User B can only read their own property reservations', () => {
    const visible = applyAdminReservationPolicy(userB.id, allReservations)
    expect(visible).toHaveLength(1)
    expect(visible[0].property_id).toBe('prop-b')
  })

  it('Cross-property access is blocked — User A cannot see User B reservations', () => {
    const visible = applyAdminReservationPolicy(userA.id, allReservations)
    const bReservations = visible.filter(r => r.property_id === 'prop-b')
    expect(bReservations).toHaveLength(0)
  })

  it('Unauthenticated user (no userId) sees nothing', () => {
    const visible = applyAdminReservationPolicy(null, allReservations)
    expect(visible).toHaveLength(0)
  })
})

describe('RLS: public_read_active_property policy', () => {
  const allProperties = [propertyA, propertyB, privateProperty, inactiveProperty]

  it('Returns only active + public properties', () => {
    const visible = applyPublicPropertyPolicy(allProperties)
    expect(visible).toHaveLength(2)
    expect(visible.map(p => p.id)).toContain('prop-a')
    expect(visible.map(p => p.id)).toContain('prop-b')
  })

  it('Private property not returned to public', () => {
    const visible = applyPublicPropertyPolicy(allProperties)
    expect(visible.find(p => p.id === 'prop-private')).toBeUndefined()
  })

  it('Inactive property not returned to public', () => {
    const visible = applyPublicPropertyPolicy(allProperties)
    expect(visible.find(p => p.id === 'prop-inactive')).toBeUndefined()
  })
})

describe('RLS: user_property_access', () => {
  it('hasPropertyAccess returns true for valid user-property pair', () => {
    expect(hasPropertyAccess('user-a', 'prop-a')).toBe(true)
    expect(hasPropertyAccess('user-b', 'prop-b')).toBe(true)
  })

  it('hasPropertyAccess returns false for cross-property access', () => {
    expect(hasPropertyAccess('user-a', 'prop-b')).toBe(false)
    expect(hasPropertyAccess('user-b', 'prop-a')).toBe(false)
  })

  it('hasPropertyAccess returns false for unauthenticated user', () => {
    expect(hasPropertyAccess(null, 'prop-a')).toBe(false)
    expect(hasPropertyAccess(undefined, 'prop-a')).toBe(false)
  })
})

describe('Schema: migration files exist', () => {
  it('All 9 migration files are accounted for', async () => {
    const { readdirSync } = await import('fs')
    const { join } = await import('path')
    const migrationsDir = join(process.cwd(), 'supabase/migrations')
    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
    expect(files).toHaveLength(9)

    const expectedFiles = [
      '001_properties.sql',
      '002_rooms.sql',
      '003_guests.sql',
      '004_reservations.sql',
      '005_payments.sql',
      '006_settings.sql',
      '007_user_property_access.sql',
      '008_enable_rls.sql',
      '009_rls_policies.sql',
    ]
    for (const expected of expectedFiles) {
      expect(files).toContain(expected)
    }
  })
})
