// send-invoice Edge Function
// Sends an invoice email to the guest for a reservation.
// Called from the admin reservation drawer.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { requireAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { sendInvoice } from '../_shared/email.ts'
import { calculatePaymentSummary } from '../_shared/paymentSummary.ts'
import { logAdminAction } from '../_shared/audit.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const inputSchema = z.object({
  reservation_id: z.string().uuid(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS })
  }

  try {
    // 1. Auth
    const authResult = await requireAuth(req)
    if (authResult.error) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
    }
    const { propertyId, user } = authResult

    // 2. Rate limit (property-scoped)
    const rateLimitError = await rateLimit(req, 10, 60_000, propertyId)
    if (rateLimitError) return rateLimitError

    // 3. Parse + validate input
    let body: unknown
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
    }
    const parsed = inputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }), { status: 400, headers: CORS_HEADERS })
    }
    const { reservation_id: reservationId } = parsed.data

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // 4. Fetch reservation with guest join
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('*, guests(*)')
      .eq('id', reservationId)
      .eq('property_id', propertyId)
      .single()

    if (resError || !reservation) {
      return new Response(JSON.stringify({ error: 'Reservation not found' }), { status: 404, headers: CORS_HEADERS })
    }

    const guest = reservation.guests
    if (!guest || !guest.email) {
      return new Response(JSON.stringify({ error: 'Guest has no email address' }), { status: 400, headers: CORS_HEADERS })
    }

    // 5. Fetch payments
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('type, status, amount_cents')
      .eq('reservation_id', reservationId)

    if (paymentsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch payments' }), { status: 500, headers: CORS_HEADERS })
    }

    // 6. Calculate payment summary
    const summary = calculatePaymentSummary(reservation.total_due_cents, payments ?? [])

    const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`
    const balanceDue = formatCents(summary.balanceCents)
    const netPaid = formatCents(summary.netPaidCents)
    const paymentStatus = summary.status

    // 7. Build invoice URL
    const origin = req.headers.get('origin') || Deno.env.get('SITE_URL') || 'https://lodge-ical.com'
    const invoiceUrl = `${origin}/invoice/${reservationId}`

    // 8. Send invoice email
    await sendInvoice(
      guest,
      { ...reservation, property_id: propertyId },
      reservationId,
      balanceDue,
      netPaid,
      paymentStatus,
      invoiceUrl,
      supabase
    )

    // 9. Audit log (fire-and-forget)
    logAdminAction(supabase, propertyId, user.id, 'email', 'invoice', reservationId)
      .catch(e => console.error('[send-invoice] audit error:', e))

    // 10. Return success
    return new Response(
      JSON.stringify({ success: true }),
      { headers: CORS_HEADERS }
    )
  } catch (err) {
    console.error('[send-invoice]', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: CORS_HEADERS,
    })
  }
})
