// create-payment-intent Edge Function
// Creates a Stripe PaymentIntent and stores a pending payment record.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { requireAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { getStripe } from '../_shared/stripe.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const inputSchema = z.object({
  reservation_id: z.string().uuid(),
  amount_cents: z.number().int().positive().optional(), // if omitted, uses balance
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const rateLimitError = rateLimit(req)
  if (rateLimitError) return rateLimitError

  // Support admin and guest portal
  const isGuestRequest = req.headers.get('x-guest-payment') === 'true'
  let propertyId: string | null = null

  if (!isGuestRequest) {
    const authResult = await requireAuth(req)
    if (authResult.error) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
    }
    propertyId = authResult.propertyId
  }

  let body: unknown
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
  }
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400, headers: CORS_HEADERS })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Fetch reservation
  const resQuery = supabase
    .from('reservations')
    .select('id, total_due_cents, property_id, guests(email)')
    .eq('id', parsed.data.reservation_id)

  if (propertyId) resQuery.eq('property_id', propertyId)

  const { data: reservation, error: resError } = await resQuery.single()
  if (resError || !reservation) {
    return new Response(JSON.stringify({ error: 'Reservation not found' }), { status: 404, headers: CORS_HEADERS })
  }

  // Determine amount — if not provided, calculate balance
  let amountCents = parsed.data.amount_cents
  if (!amountCents) {
    const { data: payments } = await supabase
      .from('payments')
      .select('type, status, amount_cents')
      .eq('reservation_id', parsed.data.reservation_id)

    const netPaid = (payments ?? []).reduce((sum, p) => {
      if (p.status !== 'succeeded') return sum
      return p.type === 'charge' ? sum + p.amount_cents : sum - p.amount_cents
    }, 0)
    amountCents = Math.max(0, reservation.total_due_cents - netPaid)
  }

  if (amountCents <= 0) {
    return new Response(JSON.stringify({ error: 'No balance due' }), { status: 400, headers: CORS_HEADERS })
  }

  // Create Stripe PaymentIntent
  const stripe = getStripe()
  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    metadata: { reservation_id: parsed.data.reservation_id, property_id: reservation.property_id },
  })

  // Store pending payment record
  await supabase.from('payments').insert({
    reservation_id: parsed.data.reservation_id,
    property_id: reservation.property_id,
    type: 'charge',
    amount_cents: amountCents,
    status: 'pending',
    method: 'stripe',
    stripe_payment_intent_id: intent.id,
  })

  return new Response(JSON.stringify({ client_secret: intent.client_secret }), { headers: CORS_HEADERS })
})
