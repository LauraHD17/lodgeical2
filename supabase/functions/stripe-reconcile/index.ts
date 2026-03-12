// stripe-reconcile Edge Function
// Compares local payment records with Stripe charges for a date range.
// Returns matched, Stripe-only, local-only, and mismatched transactions.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import Stripe from 'https://esm.sh/stripe@14.14.0'
import { requireAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const inputSchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const authResult = await requireAuth(req)
  if (authResult.error) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
  }
  const { propertyId, user } = authResult

  const rateLimitError = await rateLimit(req, 10, 60_000, propertyId)
  if (rateLimitError) return rateLimitError

  let body: unknown
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
  }
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }), { status: 400, headers: CORS_HEADERS })
  }
  const { date_from, date_to } = parsed.data

  // Validate date range (max 90 days)
  const fromDate = new Date(date_from)
  const toDate = new Date(date_to)
  const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0 || diffDays > 90) {
    return new Response(
      JSON.stringify({ error: 'Date range must be 1-90 days' }),
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')
  if (!stripeSecret) {
    return new Response(
      JSON.stringify({ error: 'Stripe not configured for this property' }),
      { status: 400, headers: CORS_HEADERS }
    )
  }

  try {
    const stripe = new Stripe(stripeSecret, { apiVersion: '2023-10-16' })
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Fetch Stripe charges for the date range
    const fromUnix = Math.floor(fromDate.getTime() / 1000)
    const toUnix = Math.floor(toDate.getTime() / 1000) + 86400 // End of day

    const stripeCharges: Stripe.Charge[] = []
    let hasMore = true
    let startingAfter: string | undefined

    while (hasMore) {
      const params: Stripe.ChargeListParams = {
        created: { gte: fromUnix, lt: toUnix },
        limit: 100,
      }
      if (startingAfter) params.starting_after = startingAfter

      const batch = await stripe.charges.list(params)
      stripeCharges.push(...batch.data)
      hasMore = batch.has_more
      if (batch.data.length > 0) {
        startingAfter = batch.data[batch.data.length - 1].id
      }
    }

    // Fetch local payments for the same date range
    const { data: localPayments, error: dbError } = await supabase
      .from('payments')
      .select('id, amount_cents, status, type, stripe_payment_intent_id, stripe_charge_id, created_at, reservation_id')
      .eq('property_id', propertyId)
      .eq('type', 'charge')
      .gte('created_at', `${date_from}T00:00:00Z`)
      .lte('created_at', `${date_to}T23:59:59Z`)

    if (dbError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch local payments' }),
        { status: 500, headers: CORS_HEADERS }
      )
    }

    const payments = localPayments ?? []

    // Build lookup maps
    const stripeByChargeId = new Map<string, Stripe.Charge>()
    const stripeByPiId = new Map<string, Stripe.Charge>()
    for (const charge of stripeCharges) {
      stripeByChargeId.set(charge.id, charge)
      if (charge.payment_intent) {
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id
        stripeByPiId.set(piId, charge)
      }
    }

    const matchedStripeIds = new Set<string>()
    const matched: Array<{ localId: string; stripeId: string; amount: number; status: string }> = []
    const mismatches: Array<{ localId: string; stripeId: string; localAmount: number; stripeAmount: number }> = []
    const localOnly: Array<{ localId: string; amount: number; status: string; reservationId: string | null }> = []

    for (const payment of payments) {
      // Try to match by charge ID first, then by payment intent ID
      let stripeCharge: Stripe.Charge | undefined
      if (payment.stripe_charge_id) {
        stripeCharge = stripeByChargeId.get(payment.stripe_charge_id)
      }
      if (!stripeCharge && payment.stripe_payment_intent_id) {
        stripeCharge = stripeByPiId.get(payment.stripe_payment_intent_id)
      }

      if (stripeCharge) {
        matchedStripeIds.add(stripeCharge.id)
        if (payment.amount_cents === stripeCharge.amount) {
          matched.push({
            localId: payment.id,
            stripeId: stripeCharge.id,
            amount: payment.amount_cents,
            status: payment.status,
          })
        } else {
          mismatches.push({
            localId: payment.id,
            stripeId: stripeCharge.id,
            localAmount: payment.amount_cents,
            stripeAmount: stripeCharge.amount,
          })
        }
      } else if (payment.status === 'succeeded' || payment.status === 'paid') {
        // Only flag as local-only if the payment was supposedly successful
        localOnly.push({
          localId: payment.id,
          amount: payment.amount_cents,
          status: payment.status,
          reservationId: payment.reservation_id,
        })
      }
    }

    // Stripe-only: charges not matched to any local payment
    const stripeOnly: Array<{ stripeId: string; amount: number; status: string; created: string }> = []
    for (const charge of stripeCharges) {
      if (!matchedStripeIds.has(charge.id) && charge.status === 'succeeded') {
        stripeOnly.push({
          stripeId: charge.id,
          amount: charge.amount,
          status: charge.status,
          created: new Date(charge.created * 1000).toISOString(),
        })
      }
    }

    const summary = {
      dateFrom: date_from,
      dateTo: date_to,
      matched: matched.length,
      mismatches: mismatches.length,
      stripeOnly: stripeOnly.length,
      localOnly: localOnly.length,
      totalStripeCharges: stripeCharges.length,
      totalLocalPayments: payments.length,
    }

    // Persist reconciliation run
    await supabase.from('reconciliation_runs').insert({
      property_id: propertyId,
      date_from,
      date_to,
      status: 'completed',
      summary,
      details: { matched, mismatches, stripeOnly, localOnly },
    }).catch(e => console.error('[stripe-reconcile] save error:', e))

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        matched,
        mismatches,
        stripeOnly,
        localOnly,
      }),
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[stripe-reconcile]', err)
    return new Response(
      JSON.stringify({ error: 'Reconciliation failed' }),
      { status: 500, headers: CORS_HEADERS }
    )
  }
})
