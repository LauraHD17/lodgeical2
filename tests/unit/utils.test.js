// tests/unit/utils.test.js
// Phase 1 smoke tests — verifies core utility modules

import { describe, it, expect } from 'vitest'
import { withTimeout, TimeoutError } from '../../src/lib/withTimeout.js'

describe('withTimeout', () => {
  it('resolves when promise completes before timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 1000)
    expect(result).toBe('ok')
  })

  it('rejects with TimeoutError when timeout expires', async () => {
    const slow = new Promise(resolve => setTimeout(resolve, 5000))
    await expect(withTimeout(slow, 10)).rejects.toBeInstanceOf(TimeoutError)
  })

  it('TimeoutError has user-friendly message', async () => {
    const slow = new Promise(resolve => setTimeout(resolve, 5000))
    try {
      await withTimeout(slow, 10, 'Custom timeout message')
    } catch (e) {
      expect(e.message).toBe('Custom timeout message')
      expect(e.name).toBe('TimeoutError')
    }
  })
})

describe('routes config', () => {
  it('exports ROUTES array with required shape', async () => {
    const { ROUTES, PUBLIC_PATHS } = await import('../../src/config/routes.js')

    expect(Array.isArray(ROUTES)).toBe(true)
    expect(ROUTES.length).toBeGreaterThan(0)

    // Every route has required fields
    for (const route of ROUTES) {
      expect(route).toHaveProperty('path')
      expect(route).toHaveProperty('pageName')
      expect(route).toHaveProperty('isPublic')
    }

    // Public paths derived correctly
    expect(Array.isArray(PUBLIC_PATHS)).toBe(true)
    expect(PUBLIC_PATHS).toContain('/login')
    expect(PUBLIC_PATHS).toContain('/widget')

    // Admin paths require permission
    const adminRoutes = ROUTES.filter(r => !r.isPublic)
    for (const route of adminRoutes) {
      expect(route).toHaveProperty('permission')
    }
  })
})

describe('queryKeys', () => {
  it('exports key factories for all entities', async () => {
    const { queryKeys } = await import('../../src/config/queryKeys.js')

    expect(queryKeys).toHaveProperty('reservations')
    expect(queryKeys).toHaveProperty('rooms')
    expect(queryKeys).toHaveProperty('guests')
    expect(queryKeys).toHaveProperty('settings')
    expect(queryKeys).toHaveProperty('payments')
    expect(queryKeys).toHaveProperty('paymentSummary')

    // Keys should be functions or arrays
    expect(typeof queryKeys.reservations.all).toBe('object')
    expect(typeof queryKeys.reservations.detail).toBe('function')

    const detailKey = queryKeys.reservations.detail('test-id')
    expect(detailKey).toContain('test-id')
  })
})
