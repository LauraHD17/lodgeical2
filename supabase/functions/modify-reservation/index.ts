// modify-reservation Edge Function
// Guest self-service: preview or apply a one-time reservation modification.
// Requires equal or greater value. If balance due, returns a PaymentIntent client_secret.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { calculatePricing } from '../_shared/pricing.ts'
import { getStripe } from '../_shared/stripe.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const inputSchema = z.object({
  reservation_id: z.string().uuid(),
  preview_only: z.boolean().default(true),
  // Guest identity verification
  email: z.string().email(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  // New reservation details
  new_check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  new_check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  new_room_ids: z.array(z.string().uuid()).min(1),
  new_num_guests: z.number().int().min(1),
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

  const { reservation_id, preview_only, email, first_name, last_name, new_check_in, new_check_out, new_room_ids, new_num_guests } = parsed.data
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Fetch reservation with guest
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

  // Check modification eligibility
  if (reservation.status === 'cancelled') {
    return new Response(JSON.stringify({ error: 'Cannot modify a cancelled reservation' }), { status: 400, headers: CORS_HEADERS })
  }

  if ((reservation.modification_count ?? 0) >= 1) {
    return new Response(JSON.stringify({ error: 'This reservation has already been modified. Only one modification is allowed.' }), { status: 400, headers: CORS_HEADERS })
  }

  // Validate new dates
  if (new_check_out <= new_check_in) {
    return new Response(JSON.stringify({ error: 'Check-out must be after check-in' }), { status: 400, headers: CORS_HEADERS })
  }

  // Check room capacity
  const { data: newRooms } = await supabase
    .from('rooms')
    .select('id, max_guests')
    .in('id', new_room_ids)
    .eq('property_id', reservation.property_id)

  if (!newRooms || newRooms.length !== new_room_ids.length) {
    return new Response(JSON.stringify({ error: 'One or more selected rooms are invalid' }), { status: 400, headers: CORS_HEADERS })
  }

  const maxGuests = newRooms.reduce((sum, r) => sum + (r.max_guests ?? 2), 0)
  if (new_num_guests > maxGuests) {
    return new Response(JSON.stringify({ error: `Guest count (${new_num_guests}) exceeds room capacity (${maxGuests})` }), { status: 400, headers: CORS_HEADERS })
  }

  // Check availability (exclude current reservation)
  const { data: conflicts } = await supabase
    .from('reservations')
    .select('id, room_ids')
    .eq('property_id', reservation.property_id)
    .neq('status', 'cancelled')
    .neq('id', reservation_id)
    .lt('check_in', new_check_out)
    .gt('check_out', new_check_in)

  const conflictingRooms = (conflicts ?? []).filter(r =>
    (r.room_ids ?? []).some((rid: string) => new_room_ids.includes(rid))
  )

  if (conflictingRooms.length > 0) {
    return new Response(JSON.stringify({ error: 'Selected rooms are not available for the chosen dates' }), { status: 409, headers: CORS_HEADERS })
  }

  // Calculate new pricing
  const newPricing = await calculatePricing(supabase, {
    propertyId: reservation.property_id,
    roomIds: new_room_ids,
    checkIn: new_check_in,
    checkOut: new_check_out,
  })

  // Use original_total_due_cents if set, otherwise current total_due_cents
  const originalTotal = reservation.original_total_due_cents ?? reservation.total_due_cents ?? 0

  if (newPricing.totalCents < originalTotal) {
    return new Response(JSON.stringify({
      error: 'Modifications must be equal to or greater than the original reservation value',
      original_total_cents: originalTotal,
      new_total_cents: newPricing.totalCents,
    }), { status: 400, headers: CORS_HEADERS })
  }

  // Calculate net paid
  const { data: payments } = await supabase
    .from('payments')
    .select('type, status, amount_cents')
    .eq('reservation_id', reservation_id)

  const netPaidCents = (payments ?? []).reduce((sum, p) => {
    if (p.status !== 'succeeded') return sum
    return p.type === 'charge' ? sum + p.amount_cents : sum - p.amount_cents
  }, 0)

  const balanceDue = Math.max(0, newPricing.totalCents - netPaidCents)

  // Preview mode — return comparison without applying
  if (preview_only) {
    return new Response(JSON.stringify({
      preview: true,
      original: {
        check_in: reservation.check_in,
        check_out: reservation.check_out,
        room_ids: reservation.room_ids,
        total_cents: originalTotal,
      },
      modified: {
        check_in: new_check_in,
        check_out: new_check_out,
        room_ids: new_room_ids,
        num_guests: new_num_guests,
        total_cents: newPricing.totalCents,
        subtotal_cents: newPricing.subtotalCents,
        tax_cents: newPricing.taxCents,
        stripe_fee_cents: newPricing.stripeFeePassthroughCents,
      },
      balance_due_cents: balanceDue,
      requires_payment: balanceDue > 0,
    }), { headers: CORS_HEADERS })
  }

  // Apply mode
  if (balanceDue > 0) {
    // Create a PaymentIntent for the balance, return client_secret
    try {
      const stripe = getStripe()
      const intent = await stripe.paymentIntents.create({
        amount: balanceDue,
        currency: 'usd',
        metadata: {
          reservation_id,
          modification: 'true',
          new_check_in,
          new_check_out,
          new_room_ids: JSON.stringify(new_room_ids),
          new_num_guests: String(new_num_guests),
          new_total_cents: String(newPricing.totalCents),
        },
      })

      return new Response(JSON.stringify({
        requires_payment: true,
        balance_due_cents: balanceDue,
        client_secret: intent.client_secret,
        payment_intent_id: intent.id,
      }), { headers: CORS_HEADERS })
    } catch (e) {
      console.error('[modify-reservation] stripe error:', e)
      return new Response(JSON.stringify({ error: 'Could not create payment. Please try again.' }), { status: 500, headers: CORS_HEADERS })
    }
  }

  // No balance due — apply modification directly
  const { error: updateError } = await supabase
    .from('reservations')
    .update({
      check_in: new_check_in,
      check_out: new_check_out,
      room_ids: new_room_ids,
      num_guests: new_num_guests,
      total_due_cents: newPricing.totalCents,
      modification_count: (reservation.modification_count ?? 0) + 1,
      original_total_due_cents: reservation.original_total_due_cents ?? reservation.total_due_cents,
    })
    .eq('id', reservation_id)

  if (updateError) {
    console.error('[modify-reservation] update error:', updateError)
    return new Response(JSON.stringify({ error: 'Failed to apply modification' }), { status: 500, headers: CORS_HEADERS })
  }

  return new Response(JSON.stringify({
    success: true,
    requires_payment: false,
    new_total_cents: newPricing.totalCents,
  }), { headers: CORS_HEADERS })
})
