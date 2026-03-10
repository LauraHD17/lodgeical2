// tests/unit/queryKeysComplete.test.js
// Validates every query key factory follows conventions and parent key nesting works.

import { describe, it, expect } from 'vitest'
import { queryKeys } from '../../src/config/queryKeys.js'

const EXPECTED_ENTITIES = [
  'reservations', 'rooms', 'guests', 'settings', 'payments',
  'paymentSummary', 'property', 'financials', 'maintenance',
  'contacts', 'inquiries', 'weather', 'emailLogs', 'guestPortal',
  'guestActivity', 'onboarding', 'roomLinks', 'importBatches',
]

// Entities that have an .all root key for bulk invalidation
const ENTITIES_WITH_ALL = EXPECTED_ENTITIES.filter(e => Array.isArray(queryKeys[e]?.all))

describe('queryKeys completeness', () => {
  it('exports all expected entity factories', () => {
    for (const entity of EXPECTED_ENTITIES) {
      expect(queryKeys).toHaveProperty(entity)
    }
  })

  it('most entities have an .all root key (array)', () => {
    // weather is the exception — it only has .current()
    expect(ENTITIES_WITH_ALL.length).toBeGreaterThanOrEqual(EXPECTED_ENTITIES.length - 1)
  })

  it('.all root key is a prefix of all generated keys in the same factory', () => {
    for (const entity of ENTITIES_WITH_ALL) {
      const factory = queryKeys[entity]
      const allKey = factory.all

      for (const [key, value] of Object.entries(factory)) {
        if (key === 'all') continue
        if (typeof value === 'function') {
          const generated = value('test', 'test2')
          expect(generated[0]).toBe(allKey[0])
        }
      }
    }
  })

  it('function-only factories still produce arrays', () => {
    // weather has no .all but its functions should return arrays
    const weatherKey = queryKeys.weather.current(40, -74)
    expect(Array.isArray(weatherKey)).toBe(true)
    expect(weatherKey[0]).toBe('weather')
  })
})

describe('queryKeys: key isolation', () => {
  it('entities with .all have unique root keys', () => {
    const rootKeys = ENTITIES_WITH_ALL.map(e => queryKeys[e].all[0])
    const unique = new Set(rootKeys)
    expect(unique.size).toBe(rootKeys.length)
  })

  it('detail keys include the id argument', () => {
    const detailKey = queryKeys.reservations.detail('res-123')
    expect(detailKey).toContain('res-123')
  })

  it('list keys with different filters produce different keys', () => {
    const a = queryKeys.reservations.list({ status: 'confirmed' })
    const b = queryKeys.reservations.list({ status: 'cancelled' })
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })
})
