// tests/unit/formatUtils.test.js
// Tests for currency formatting utilities.

import { describe, it, expect } from 'vitest'
import { dollars, fmtMoney } from '../../src/lib/utils.js'

describe('dollars (rounded, no decimals)', () => {
  it('formats positive cents as rounded dollar string', () => {
    expect(dollars(12345)).toBe('$123')
  })

  it('returns $0 for zero', () => {
    expect(dollars(0)).toBe('$0')
  })

  it('returns $0 for null/undefined', () => {
    expect(dollars(null)).toBe('$0')
    expect(dollars(undefined)).toBe('$0')
  })

  it('formats large values with comma separators', () => {
    expect(dollars(1234567)).toBe('$12,346')
  })

  it('rounds down fractional cents', () => {
    expect(dollars(99)).toBe('$1')
  })
})

describe('fmtMoney (full currency with decimals)', () => {
  it('formats cents as $X.XX', () => {
    expect(fmtMoney(12345)).toBe('$123.45')
  })

  it('formats zero cents', () => {
    expect(fmtMoney(0)).toBe('$0.00')
  })

  it('returns $0.00 for null', () => {
    expect(fmtMoney(null)).toBe('$0.00')
  })

  it('returns $0.00 for undefined', () => {
    expect(fmtMoney(undefined)).toBe('$0.00')
  })

  it('formats single digit cents with leading zero', () => {
    expect(fmtMoney(5)).toBe('$0.05')
  })

  it('formats large amounts with comma separators', () => {
    expect(fmtMoney(10000000)).toBe('$100,000.00')
  })

  it('handles negative amounts', () => {
    const result = fmtMoney(-5000)
    expect(result).toContain('50.00')
    // Locale may use -$50.00 or ($50.00) — just verify magnitude
  })
})
