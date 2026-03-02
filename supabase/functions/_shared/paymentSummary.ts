// _shared/paymentSummary.ts
// Authoritative payment balance calculation.
// Previously defined in get-payment-summary/index.ts and imported cross-function
// by guest-portal-lookup — moved here so neither function depends on the other.

export function calculatePaymentSummary(
  totalDueCents: number,
  payments: Array<{ type: string; status: string; amount_cents: number }>
) {
  const charges = payments.filter(p => p.type === 'charge' && p.status === 'succeeded')
  const refunds  = payments.filter(p => p.type === 'refund'  && p.status === 'succeeded')

  const paidCents     = charges.reduce((sum, p) => sum + p.amount_cents, 0)
  const refundedCents = refunds.reduce((sum, p) => sum + p.amount_cents, 0)
  const netPaidCents  = paidCents - refundedCents
  const balanceCents  = Math.max(0, totalDueCents - netPaidCents)
  const overpaidCents = Math.max(0, netPaidCents - totalDueCents)

  const status =
    overpaidCents > 0                               ? 'overpaid'  :
    balanceCents === 0 && netPaidCents > 0          ? 'paid'      :
    balanceCents > 0  && netPaidCents > 0           ? 'partial'   :
                                                      'unpaid'

  return {
    totalDueCents,
    paidCents,
    refundedCents,
    netPaidCents,
    balanceCents,
    overpaidCents,
    status,
  }
}
