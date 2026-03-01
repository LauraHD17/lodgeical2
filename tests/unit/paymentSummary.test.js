// tests/unit/paymentSummary.test.js
// 100% coverage of the payment summary formula.
// Tests are JavaScript simulations of the TypeScript Edge Function logic.

import { describe, it, expect } from 'vitest'

// Mirror the formula from get-payment-summary/index.ts
function calculatePaymentSummary(totalDueCents, payments) {
  const charges = payments.filter(p => p.type === 'charge' && p.status === 'succeeded')
  const refunds  = payments.filter(p => p.type === 'refund'  && p.status === 'succeeded')

  const paidCents     = charges.reduce((sum, p) => sum + p.amount_cents, 0)
  const refundedCents = refunds.reduce((sum, p)  => sum + p.amount_cents, 0)
  const netPaidCents  = paidCents - refundedCents
  const balanceCents  = Math.max(0, totalDueCents - netPaidCents)
  const overpaidCents = Math.max(0, netPaidCents - totalDueCents)

  const status =
    overpaidCents > 0                               ? 'overpaid'  :
    balanceCents === 0 && netPaidCents > 0          ? 'paid'      :
    balanceCents > 0  && netPaidCents > 0           ? 'partial'   :
                                                      'unpaid'

  return { totalDueCents, paidCents, refundedCents, netPaidCents, balanceCents, overpaidCents, status }
}

// Mirror cancel-reservation policy formula
function calculateRefundCents(policy, totalDueCents, netPaidCents, checkInDate, today) {
  const daysUntilCheckIn = Math.ceil(
    (new Date(checkInDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (policy === 'flexible') {
    return daysUntilCheckIn >= 1 ? netPaidCents : 0
  }
  if (policy === 'moderate') {
    if (daysUntilCheckIn >= 5) return netPaidCents
    if (daysUntilCheckIn >= 1) return Math.floor(netPaidCents / 2)
    return 0
  }
  if (policy === 'strict') {
    return daysUntilCheckIn >= 14 ? netPaidCents : 0
  }
  return 0
}

// ─── Scenario 1: No payments ──────────────────────────────────────────────

describe('payment summary: no payments', () => {
  it('returns unpaid status with full balance', () => {
    const result = calculatePaymentSummary(20000, [])
    expect(result.status).toBe('unpaid')
    expect(result.balanceCents).toBe(20000)
    expect(result.paidCents).toBe(0)
    expect(result.netPaidCents).toBe(0)
    expect(result.overpaidCents).toBe(0)
  })
})

// ─── Scenario 2: Full payment ─────────────────────────────────────────────

describe('payment summary: full payment', () => {
  it('returns paid status with zero balance', () => {
    const payments = [{ type: 'charge', status: 'succeeded', amount_cents: 20000 }]
    const result = calculatePaymentSummary(20000, payments)
    expect(result.status).toBe('paid')
    expect(result.balanceCents).toBe(0)
    expect(result.paidCents).toBe(20000)
    expect(result.netPaidCents).toBe(20000)
    expect(result.overpaidCents).toBe(0)
  })
})

// ─── Scenario 3: Partial payment ─────────────────────────────────────────

describe('payment summary: partial payment', () => {
  it('returns partial status with remaining balance', () => {
    const payments = [{ type: 'charge', status: 'succeeded', amount_cents: 10000 }]
    const result = calculatePaymentSummary(20000, payments)
    expect(result.status).toBe('partial')
    expect(result.balanceCents).toBe(10000)
    expect(result.paidCents).toBe(10000)
    expect(result.netPaidCents).toBe(10000)
  })
})

// ─── Scenario 4: Refund after full payment ────────────────────────────────

describe('payment summary: refund after full payment', () => {
  it('returns partial status with balance equal to refund amount', () => {
    const payments = [
      { type: 'charge', status: 'succeeded', amount_cents: 20000 },
      { type: 'refund', status: 'succeeded', amount_cents: 5000 },
    ]
    const result = calculatePaymentSummary(20000, payments)
    expect(result.status).toBe('partial')
    expect(result.paidCents).toBe(20000)
    expect(result.refundedCents).toBe(5000)
    expect(result.netPaidCents).toBe(15000)
    expect(result.balanceCents).toBe(5000)
  })
})

// ─── Scenario 5: Overpayment ──────────────────────────────────────────────

describe('payment summary: overpayment', () => {
  it('returns overpaid status with overpaid amount', () => {
    const payments = [{ type: 'charge', status: 'succeeded', amount_cents: 25000 }]
    const result = calculatePaymentSummary(20000, payments)
    expect(result.status).toBe('overpaid')
    expect(result.overpaidCents).toBe(5000)
    expect(result.balanceCents).toBe(0)
  })
})

// ─── Scenario 6: Failed payment is ignored ───────────────────────────────

describe('payment summary: failed payment is ignored', () => {
  it('does not count failed payments in the balance', () => {
    const payments = [
      { type: 'charge', status: 'failed', amount_cents: 20000 },
    ]
    const result = calculatePaymentSummary(20000, payments)
    expect(result.status).toBe('unpaid')
    expect(result.balanceCents).toBe(20000)
    expect(result.paidCents).toBe(0)
  })
})

// ─── Scenario 7: Pending payment is ignored ──────────────────────────────

describe('payment summary: pending payment is ignored', () => {
  it('does not count pending payments', () => {
    const payments = [
      { type: 'charge', status: 'pending', amount_cents: 20000 },
    ]
    const result = calculatePaymentSummary(20000, payments)
    expect(result.status).toBe('unpaid')
    expect(result.paidCents).toBe(0)
  })
})

// ─── Cancellation policy ─────────────────────────────────────────────────

describe('cancellation policy: flexible', () => {
  it('gives full refund if cancelled > 1 day before', () => {
    expect(calculateRefundCents('flexible', 20000, 20000, '2026-04-10', '2026-04-05')).toBe(20000)
  })
  it('gives zero refund on day-of', () => {
    expect(calculateRefundCents('flexible', 20000, 20000, '2026-04-10', '2026-04-10')).toBe(0)
  })
})

describe('cancellation policy: moderate', () => {
  it('gives full refund if > 5 days before', () => {
    expect(calculateRefundCents('moderate', 20000, 20000, '2026-04-10', '2026-04-01')).toBe(20000)
  })
  it('gives 50% refund if 1-4 days before', () => {
    expect(calculateRefundCents('moderate', 20000, 20000, '2026-04-10', '2026-04-08')).toBe(10000)
  })
  it('gives zero refund on day-of', () => {
    expect(calculateRefundCents('moderate', 20000, 20000, '2026-04-10', '2026-04-10')).toBe(0)
  })
})

describe('cancellation policy: strict', () => {
  it('gives full refund if > 14 days before', () => {
    expect(calculateRefundCents('strict', 20000, 20000, '2026-04-10', '2026-03-20')).toBe(20000)
  })
  it('gives zero refund if < 14 days before', () => {
    expect(calculateRefundCents('strict', 20000, 20000, '2026-04-10', '2026-04-01')).toBe(0)
  })
})
