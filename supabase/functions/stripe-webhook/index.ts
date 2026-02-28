// stripe-webhook Edge Function
// Webhook signature verification is STEP ONE — no processing without it.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getStripe } from '../_shared/stripe.ts'

const CORS_HEADERS = { 'Content-Type': 'application/json' }

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS })
  }

  // Step 1: Read raw body + verify Stripe signature
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature' }), { status: 400, headers: CORS_HEADERS })
  }

  const stripe = getStripe()
  let event: { type: string; data: { object: Record<string, unknown> } }

  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )
  } catch (err) {
    // Verification failed — log attempt, return 400 immediately
    console.error('[stripe-webhook] Signature verification failed:', (err as Error).message)
    return new Response(JSON.stringify({ error: 'Webhook signature verification failed' }), { status: 400, headers: CORS_HEADERS })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Process events
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as { id: string; charges?: { data: Array<{ id: string }> } }
    const chargeId = pi.charges?.data?.[0]?.id ?? null

    await supabase
      .from('payments')
      .update({ status: 'succeeded', stripe_charge_id: chargeId })
      .eq('stripe_payment_intent_id', pi.id)
      .eq('type', 'charge')

  } else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object as { id: string; latest_charge?: string }

    await supabase
      .from('payments')
      .update({ status: 'failed' })
      .eq('stripe_payment_intent_id', pi.id)
      .eq('type', 'charge')

    // Trigger payment failed email (best-effort)
    try {
      const { data: payment } = await supabase
        .from('payments')
        .select('reservation_id')
        .eq('stripe_payment_intent_id', pi.id)
        .single()

      if (payment) {
        const { data: res } = await supabase
          .from('reservations')
          .select('*, guests(email, first_name, last_name)')
          .eq('id', payment.reservation_id)
          .single()

        if (res?.guests) {
          const { sendPaymentFailedAlert } = await import('../_shared/email.ts')
          await sendPaymentFailedAlert(res.guests as { first_name: string; last_name: string; email: string }, res)
        }
      }
    } catch (e) {
      console.error('[stripe-webhook] email error:', e)
    }

  } else if (event.type === 'charge.refunded') {
    const charge = event.data.object as { id: string; amount_refunded: number; payment_intent?: string }

    if (charge.payment_intent) {
      await supabase
        .from('payments')
        .update({ status: 'succeeded' })
        .eq('reservation_id',
          supabase
            .from('payments')
            .select('reservation_id')
            .eq('stripe_payment_intent_id', charge.payment_intent)
            .limit(1)
        )
        .eq('type', 'refund')
        .eq('status', 'pending')
    }
  }

  // Return 200 for all events (including unrecognized — Stripe retries on non-200)
  return new Response(JSON.stringify({ received: true }), { headers: CORS_HEADERS })
})
