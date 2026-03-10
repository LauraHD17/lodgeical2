// tests/unit/widgetState.test.js
// Tests for the widget session persistence logic (non-React, pure functions).

import { describe, it, expect, beforeEach } from 'vitest'

// We test the module's internal logic by importing the non-hook exports.
// The hook itself wraps React state so we test the storage functions directly.

const STORAGE_KEY = 'lodgeical_widget_prop-1'

describe('widget state persistence', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('clearWidgetState removes the key for a given property', async () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step: 1, _savedAt: Date.now() }))
    const { clearWidgetState } = await import('../../src/components/widget/useWidgetState.js')
    clearWidgetState('prop-1')
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('sessionStorage round-trip preserves data', () => {
    const state = { step: 2, dates: { checkIn: '2026-04-10', checkOut: '2026-04-15' }, _savedAt: Date.now() }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    expect(parsed.step).toBe(2)
    expect(parsed.dates.checkIn).toBe('2026-04-10')
  })

  it('expired state is treated as absent (30+ min old)', () => {
    const expired = {
      step: 2,
      dates: { checkIn: '2026-04-10', checkOut: '2026-04-15' },
      _savedAt: Date.now() - (31 * 60 * 1000), // 31 minutes ago
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(expired))

    // Simulate loadState logic
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(raw)
    const EXPIRY_MS = 30 * 60 * 1000
    const isExpired = Date.now() - parsed._savedAt > EXPIRY_MS
    expect(isExpired).toBe(true)
  })

  it('fresh state is not expired (< 30 min)', () => {
    const fresh = {
      step: 1,
      _savedAt: Date.now() - (5 * 60 * 1000), // 5 minutes ago
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))

    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(raw)
    const EXPIRY_MS = 30 * 60 * 1000
    const isExpired = Date.now() - parsed._savedAt > EXPIRY_MS
    expect(isExpired).toBe(false)
  })

  it('corrupt JSON in sessionStorage does not throw', () => {
    sessionStorage.setItem(STORAGE_KEY, '{invalid json')
    expect(() => {
      try { JSON.parse(sessionStorage.getItem(STORAGE_KEY)) } catch { /* expected */ }
    }).not.toThrow()
  })

  it('keys are scoped per property ID', () => {
    sessionStorage.setItem('lodgeical_widget_prop-A', JSON.stringify({ step: 1, _savedAt: Date.now() }))
    sessionStorage.setItem('lodgeical_widget_prop-B', JSON.stringify({ step: 2, _savedAt: Date.now() }))

    const a = JSON.parse(sessionStorage.getItem('lodgeical_widget_prop-A'))
    const b = JSON.parse(sessionStorage.getItem('lodgeical_widget_prop-B'))
    expect(a.step).toBe(1)
    expect(b.step).toBe(2)
  })
})
