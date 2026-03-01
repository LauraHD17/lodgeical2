// _shared/email.ts
// Resend email client and transactional email helpers.

interface Guest {
  first_name: string
  last_name: string
  email: string
}

interface Reservation {
  confirmation_number: string
  check_in: string
  check_out: string
  total_due_cents: number
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send')
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Lodge-ical <noreply@lodge-ical.com>',
      to,
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[email] Send failed:', err)
  }
}

export async function sendBookingConfirmation(guest: Guest, reservation: Reservation): Promise<void> {
  const nightlyTotal = (reservation.total_due_cents / 100).toFixed(2)
  await sendEmail(
    guest.email,
    `Booking Confirmation — ${reservation.confirmation_number}`,
    `
    <h2>Booking Confirmed</h2>
    <p>Hi ${guest.first_name},</p>
    <p>Your reservation has been confirmed.</p>
    <ul>
      <li><strong>Confirmation:</strong> ${reservation.confirmation_number}</li>
      <li><strong>Check-in:</strong> ${reservation.check_in}</li>
      <li><strong>Check-out:</strong> ${reservation.check_out}</li>
      <li><strong>Total due:</strong> $${nightlyTotal}</li>
    </ul>
    `
  )
}

export async function sendCancellationNotice(guest: Guest, reservation: Reservation, refundCents: number): Promise<void> {
  const refund = (refundCents / 100).toFixed(2)
  await sendEmail(
    guest.email,
    `Reservation Cancelled — ${reservation.confirmation_number}`,
    `
    <h2>Reservation Cancelled</h2>
    <p>Hi ${guest.first_name},</p>
    <p>Your reservation (${reservation.confirmation_number}) has been cancelled.</p>
    ${refundCents > 0 ? `<p>A refund of $${refund} has been initiated.</p>` : ''}
    `
  )
}

export async function sendPaymentFailedAlert(guest: Guest, reservation: Reservation): Promise<void> {
  await sendEmail(
    guest.email,
    `Payment Failed — Action Required`,
    `
    <h2>Payment Failed</h2>
    <p>Hi ${guest.first_name},</p>
    <p>A payment for reservation ${reservation.confirmation_number} could not be processed.</p>
    <p>Please visit the guest portal to update your payment information.</p>
    `
  )
}
