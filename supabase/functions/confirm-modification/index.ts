// confirm-modification Edge Function
// Called after guest pays the balance for a reservation modification.
// Verifies payment, applies the modification, increments modification_count.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { getStripe } from '../_shared/stripe.ts'
import { sendModificationConfirmation } from '../_shared/email.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const inputSchema = z.object({
  reservation_id: z.string().uuid(),
  payment_intent_id: z.string().min(1),
  // Guest identity verification
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const rateLimitError = await rateLimit(req, 10, 60_000)
  if (rateLimitError) return rateLimitError

  let body: unknown
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
  }

  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400, headers: CORS_HEADERS })
  }

  const { reservation_id, payment_intent_id, email, first_name, last_name } = parsed.data
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Fetch reservation
  const { data: reservation, error: resError } = await supabase
    .from('reservations')
    .select('*, guests(email, first_name, last_name)')
    .eq('id', reservation_id)
    .single()

  if (resError || !reservation) {
    return new Response(JSON.stringify({ error: 'Reservation not found' }), { status: 404, headers: CORS_HEADERS })
  }

  // Verify guest identity
  const guest = reservation.guests
  if (
    guest?.email?.toLowerCase() !== email.toLowerCase() ||
    guest?.first_name?.toLowerCase() !== first_name.toLowerCase() ||
    guest?.last_name?.toLowerCase() !== last_name.toLowerCase()
  ) {
    return new Response(JSON.stringify({ error: 'Identity verification failed' }), { status: 403, headers: CORS_HEADERS })
  }

  if ((reservation.modification_count ?? 0) >= 1) {
    return new Response(JSON.stringify({ error: 'This reservation has already been modified' }), { status: 400, headers: CORS_HEADERS })
  }

  // Verify payment with Stripe
  let paymentIntent
  try {
    const stripe = getStripe()
    paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id)
  } catch (e) {
    console.error('[confirm-modification] stripe retrieve error:', e)
    return new Response(JSON.stringify({ error: 'Could not verify payment' }), { status: 500, headers: CORS_HEADERS })
  }

  if (paymentIntent.status !== 'succeeded') {
    return new Response(JSON.stringify({ error: 'Payment has not been completed' }), { status: 400, headers: CORS_HEADERS })
  }

  // Verify the payment intent metadata matches this reservation
  if (paymentIntent.metadata?.reservation_id !== reservation_id || paymentIntent.metadata?.modification !== 'true') {
    return new Response(JSON.stringify({ error: 'Payment does not match this modification' }), { status: 400, headers: CORS_HEADERS })
  }

  // Extract modification details from payment intent metadata
  const newCheckIn = paymentIntent.metadata.new_check_in
  const newCheckOut = paymentIntent.metadata.new_check_out
  const newRoomIds = JSON.parse(paymentIntent.metadata.new_room_ids || '[]')
  const newNumGuests = parseInt(paymentIntent.metadata.new_num_guests || '1', 10)
  const newTotalCents = parseInt(paymentIntent.metadata.new_total_cents || '0', 10)

  // Record the payment
  await supabase.from('payments').insert({
    reservation_id,
    property_id: reservation.property_id,
    type: 'charge',
    amount_cents: paymentIntent.amount,
    status: 'succeeded',
    method: 'stripe',
    stripe_payment_intent_id: payment_intent_id,
  })

  // Apply the modification
  const { error: updateError } = await supabase
    .from('reservations')
    .update({
      check_in: newCheckIn,
      check_out: newCheckOut,
      room_ids: newRoomIds,
      num_guests: newNumGuests,
      total_due_cents: newTotalCents,
      modification_count: (reservation.modification_count ?? 0) + 1,
      original_total_due_cents: reservation.original_total_due_cents ?? reservation.total_due_cents,
    })
    .eq('id', reservation_id)

  if (updateError) {
    console.error('[confirm-modification] update error:', updateError)
    return new Response(JSON.stringify({ error: 'Failed to apply modification' }), { status: 500, headers: CORS_HEADERS })
  }

  // Send modification confirmation email (fire-and-forget)
  sendModificationConfirmation(
    { first_name, last_name, email },
    { ...reservation, check_in: newCheckIn, check_out: newCheckOut, room_ids: newRoomIds, total_due_cents: newTotalCents },
    supabase
  ).catch(e => console.error('[confirm-modification] email error:', e))

  return new Response(JSON.stringify({
    success: true,
    new_total_cents: newTotalCents,
  }), { headers: CORS_HEADERS })
})
