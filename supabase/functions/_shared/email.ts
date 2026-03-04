// _shared/email.ts
// Resend email client. All outbound emails go through sendEmail().
// Higher-level helpers accept a Supabase client so they can fetch the
// property's custom template (from email_templates table) before falling
// back to the built-in default. See _shared/emailTemplates.ts.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { renderTemplate, TemplateVars } from './emailTemplates.ts'

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
  property_id?: string
  room_ids?: string[]
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

/** Build common TemplateVars for a guest + reservation pair. */
async function buildVars(
  supabase: SupabaseClient | null,
  guest: Guest,
  reservation: Reservation,
  extra: Partial<TemplateVars> = {}
): Promise<TemplateVars> {
  const nights = Math.ceil(
    (new Date(reservation.check_out).getTime() - new Date(reservation.check_in).getTime()) /
    (1000 * 60 * 60 * 24)
  )

  let propertyName = 'the property'
  let checkInTime = ''
  let checkOutTime = ''
  let roomNames = ''

  if (supabase && reservation.property_id) {
    const [{ data: settings }, { data: rooms }] = await Promise.all([
      supabase
        .from('settings')
        .select('check_in_time, check_out_time')
        .eq('property_id', reservation.property_id)
        .single(),
      reservation.room_ids?.length
        ? supabase.from('rooms').select('name').in('id', reservation.room_ids)
        : Promise.resolve({ data: [] }),
    ])
    const { data: property } = await supabase
      .from('properties')
      .select('name')
      .eq('id', reservation.property_id)
      .single()

    checkInTime  = settings?.check_in_time  ?? ''
    checkOutTime = settings?.check_out_time ?? ''
    propertyName = property?.name ?? propertyName
    roomNames    = (rooms ?? []).map((r: { name: string }) => r.name).join(', ')
  }

  return {
    guest_first_name:    guest.first_name,
    guest_last_name:     guest.last_name,
    guest_email:         guest.email,
    confirmation_number: reservation.confirmation_number,
    check_in_date:       reservation.check_in,
    check_out_date:      reservation.check_out,
    num_nights:          String(nights),
    total_due:           `$${(reservation.total_due_cents / 100).toFixed(2)}`,
    property_name:       propertyName,
    check_in_time:       checkInTime,
    check_out_time:      checkOutTime,
    room_names:          roomNames,
    ...extra,
  }
}

export async function sendBookingConfirmation(
  guest: Guest,
  reservation: Reservation,
  supabase: SupabaseClient | null = null
): Promise<void> {
  const vars = await buildVars(supabase, guest, reservation)

  let subject: string
  let html: string

  if (supabase && reservation.property_id) {
    ;({ subject, html } = await renderTemplate(supabase, reservation.property_id, 'booking_confirmation', vars))
  } else {
    // Fallback (no supabase client available)
    subject = `Booking Confirmation — ${reservation.confirmation_number}`
    html = `<h2>Booking Confirmed</h2><p>Hi ${guest.first_name},</p>
      <p>Confirmation: <strong>${reservation.confirmation_number}</strong></p>
      <p>Check-in: ${reservation.check_in} | Check-out: ${reservation.check_out}</p>
      <p>Total: $${(reservation.total_due_cents / 100).toFixed(2)}</p>`
  }

  await sendEmail(guest.email, subject, html)
}

export async function sendCancellationNotice(
  guest: Guest,
  reservation: Reservation,
  refundCents: number,
  supabase: SupabaseClient | null = null
): Promise<void> {
  const vars = await buildVars(supabase, guest, reservation, {
    refund_amount: `$${(refundCents / 100).toFixed(2)}`,
  })

  let subject: string
  let html: string

  if (supabase && reservation.property_id) {
    ;({ subject, html } = await renderTemplate(supabase, reservation.property_id, 'cancellation_notice', vars))
  } else {
    subject = `Reservation Cancelled — ${reservation.confirmation_number}`
    html = `<h2>Reservation Cancelled</h2><p>Hi ${guest.first_name},</p>
      <p>Your reservation ${reservation.confirmation_number} has been cancelled.</p>
      ${refundCents > 0 ? `<p>Refund: $${(refundCents / 100).toFixed(2)}</p>` : ''}`
  }

  await sendEmail(guest.email, subject, html)
}

export async function sendPaymentFailedAlert(
  guest: Guest,
  reservation: Reservation,
  supabase: SupabaseClient | null = null
): Promise<void> {
  const vars = await buildVars(supabase, guest, reservation)

  let subject: string
  let html: string

  if (supabase && reservation.property_id) {
    ;({ subject, html } = await renderTemplate(supabase, reservation.property_id, 'payment_failed', vars))
  } else {
    subject = `Payment Failed — Action Required`
    html = `<h2>Payment Failed</h2><p>Hi ${guest.first_name},</p>
      <p>Payment for ${reservation.confirmation_number} could not be processed.</p>`
  }

  await sendEmail(guest.email, subject, html)
}

/** Send automated check-in reminder (called from a scheduled job or manually). */
export async function sendCheckInReminder(
  guest: Guest,
  reservation: Reservation,
  supabase: SupabaseClient
): Promise<void> {
  const vars = await buildVars(supabase, guest, reservation)
  const { subject, html } = await renderTemplate(supabase, reservation.property_id!, 'check_in_reminder', vars)
  await sendEmail(guest.email, subject, html)
}

/** Send automated check-out reminder. */
export async function sendCheckOutReminder(
  guest: Guest,
  reservation: Reservation,
  supabase: SupabaseClient
): Promise<void> {
  const vars = await buildVars(supabase, guest, reservation)
  const { subject, html } = await renderTemplate(supabase, reservation.property_id!, 'check_out_reminder', vars)
  await sendEmail(guest.email, subject, html)
}
