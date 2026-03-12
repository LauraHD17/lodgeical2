// cancel-reservation Edge Function
// Applies cancellation policy, calculates refund, updates status.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { requireAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAdminAction } from '../_shared/audit.ts'
import { getStripe } from '../_shared/stripe.ts'
import { sendCancellationNotice } from '../_shared/email.ts'
import { cancelScheduledMessages } from '../_shared/scheduleMessages.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const inputSchema = z.object({
  reservation_id: z.string().uuid(),
  preview_only: z.boolean().default(false),
  // Required when the request is unauthenticated (guest self-service)
  email: z.string().email().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
})

export function calculateRefundCents(
  policy: string,
  totalDueCents: number,
  netPaidCents: number,
  checkInDate: string,
  today: string = new Date().toISOString().slice(0, 10)
): number {
  const daysUntilCheckIn = Math.ceil(
    (new Date(checkInDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (policy === 'flexible') {
    // Full refund if cancelled > 1 day before check-in
    return daysUntilCheckIn >= 1 ? netPaidCents : 0
  }

  if (policy === 'moderate') {
    // Full refund if cancelled > 5 days before; 50% if 1-5 days; none on day-of
    if (daysUntilCheckIn >= 5) return netPaidCents
    if (daysUntilCheckIn >= 1) return Math.floor(netPaidCents / 2)
    return 0
  }

  if (policy === 'strict') {
    // Full refund only if cancelled > 14 days before; no refund otherwise
    return daysUntilCheckIn >= 14 ? netPaidCents : 0
  }

  return 0
}

function getPolicyNote(policy: string, checkInDate: string, today: string = new Date().toISOString().slice(0, 10)): string {
  const daysUntilCheckIn = Math.ceil(
    (new Date(checkInDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
  )
  const dayLabel = daysUntilCheckIn === 1 ? '1 day' : `${daysUntilCheckIn} days`

  if (policy === 'flexible') {
    if (daysUntilCheckIn >= 1) {
      return `Flexible policy: Full refund for cancellations made at least 1 day before check-in. Your check-in is in ${dayLabel} — you qualify for a full refund.`
    }
    return 'Flexible policy: Full refund for cancellations made at least 1 day before check-in. Your check-in is today — no refund applies.'
  }

  if (policy === 'moderate') {
    if (daysUntilCheckIn >= 5) {
      return `Moderate policy: Full refund for cancellations made at least 5 days before check-in. Your check-in is in ${dayLabel} — you qualify for a full refund.`
    }
    if (daysUntilCheckIn >= 1) {
      return `Moderate policy: 50% refund for cancellations made 1–4 days before check-in. Your check-in is in ${dayLabel} — you qualify for a 50% refund.`
    }
    return 'Moderate policy: No refund for same-day cancellations. Your check-in is today — no refund applies.'
  }

  if (policy === 'strict') {
    if (daysUntilCheckIn >= 14) {
      return `Strict policy: Full refund for cancellations made at least 14 days before check-in. Your check-in is in ${dayLabel} — you qualify for a full refund.`
    }
    return `Strict policy: Full refund only for cancellations made at least 14 days before check-in. Your check-in is in ${dayLabel} — no refund applies.`
  }

  return ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  // A request is a guest (unauthenticated) request if it carries no Authorization header.
  // Admin requests must supply a valid JWT; guest requests must supply identity fields in
  // the body so we can verify them against the reservation record.
  const hasAuthHeader = !!req.headers.get('authorization')
  const isGuestRequest = !hasAuthHeader
  let propertyId: string | null = null
  let userId: string | null = null

  if (!isGuestRequest) {
    const authResult = await requireAuth(req)
    if (authResult.error) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
    }
    propertyId = authResult.propertyId
    userId = authResult.user.id
  }

  // Rate limit (property-scoped for admin, IP-only for guest)
  const rateLimitError = await rateLimit(req, 30, 60_000, propertyId ?? undefined)
  if (rateLimitError) return rateLimitError

  let body: unknown
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
  }
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400, headers: CORS_HEADERS })
  }

  // Guest requests must supply all three identity fields up-front so we can verify
  // them before touching any data.
  if (isGuestRequest) {
    const { email, first_name, last_name } = parsed.data
    if (!email || !first_name || !last_name) {
      return new Response(
        JSON.stringify({ error: 'email, first_name, and last_name are required to cancel a reservation' }),
        { status: 401, headers: CORS_HEADERS }
      )
    }
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Fetch reservation — admin requests are additionally scoped to their property
  const resQuery = supabase
    .from('reservations')
    .select('*, guests(email, first_name, last_name)')
    .eq('id', parsed.data.reservation_id)

  if (propertyId) resQuery.eq('property_id', propertyId)

  const { data: reservation, error: resError } = await resQuery.single()
  if (resError || !reservation) {
    return new Response(JSON.stringify({ error: 'Reservation not found' }), { status: 404, headers: CORS_HEADERS })
  }

  // Verify guest identity for unauthenticated requests
  if (isGuestRequest) {
    const { email, first_name, last_name } = parsed.data as Required<typeof parsed.data>
    const guest = reservation.guests
    const emailMatch = guest?.email?.toLowerCase() === email.toLowerCase()
    const firstMatch = guest?.first_name?.toLowerCase() === first_name.toLowerCase()
    const lastMatch = guest?.last_name?.toLowerCase() === last_name.toLowerCase()

    if (!emailMatch || !firstMatch || !lastMatch) {
      return new Response(
        JSON.stringify({ error: 'Identity verification failed' }),
        { status: 403, headers: CORS_HEADERS }
      )
    }
  }

  if (reservation.status === 'cancelled') {
    return new Response(JSON.stringify({ error: 'Reservation is already cancelled' }), { status: 400, headers: CORS_HEADERS })
  }

  // Fetch settings for cancellation policy
  const { data: settings } = await supabase
    .from('settings')
    .select('cancellation_policy')
    .eq('property_id', reservation.property_id)
    .single()

  const policy = settings?.cancellation_policy ?? 'moderate'

  // Calculate net paid (succeeded charges minus refunds)
  const { data: payments } = await supabase
    .from('payments')
    .select('type, status, amount_cents, stripe_payment_intent_id')
    .eq('reservation_id', parsed.data.reservation_id)

  const netPaidCents = (payments ?? []).reduce((sum, p) => {
    if (p.status !== 'succeeded') return sum
    return p.type === 'charge' ? sum + p.amount_cents : sum - p.amount_cents
  }, 0)

  const refundCents = calculateRefundCents(policy, reservation.total_due_cents, netPaidCents, reservation.check_in)

  // If preview only, return the refund amount without cancelling
  if (parsed.data.preview_only) {
    const policy_note = getPolicyNote(policy, reservation.check_in)
    return new Response(JSON.stringify({ refund_cents: refundCents, policy, policy_note }), { headers: CORS_HEADERS })
  }

  // Process refund via Stripe if applicable
  if (refundCents > 0) {
    const stripePayment = (payments ?? []).find(p => p.type === 'charge' && p.status === 'succeeded' && p.stripe_payment_intent_id)
    if (stripePayment?.stripe_payment_intent_id) {
      try {
        const stripe = getStripe()
        await stripe.refunds.create({
          payment_intent: stripePayment.stripe_payment_intent_id,
          amount: refundCents,
        })
        // Create refund record
        await supabase.from('payments').insert({
          reservation_id: parsed.data.reservation_id,
          property_id: reservation.property_id,
          type: 'refund',
          amount_cents: refundCents,
          status: 'pending', // webhook will mark as succeeded
          method: 'stripe',
        })
      } catch (e) {
        console.error('[cancel-reservation] refund error:', e)
      }
    }
  }

  // Cancel the reservation
  await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', parsed.data.reservation_id)

  // Audit log (fire-and-forget, admin requests only)
  if (!isGuestRequest && propertyId && userId) {
    logAdminAction(supabase, propertyId, userId, 'cancel', 'reservation', parsed.data.reservation_id)
      .catch(e => console.error('[cancel-reservation] audit error:', e))
  }

  // Cancel all pending scheduled messages for this reservation (fire-and-forget)
  cancelScheduledMessages(supabase, parsed.data.reservation_id)
    .catch(e => console.error('[cancel-reservation] schedule cancel error:', e))

  // Send cancellation email (fire-and-forget — don't block the response)
  sendCancellationNotice(reservation.guests, reservation, refundCents, supabase).catch(e =>
    console.error('[cancel-reservation] email error:', e)
  )

  return new Response(
    JSON.stringify({ success: true, refund_cents: refundCents, policy }),
    { headers: CORS_HEADERS }
  )
})
