// get-payment-summary Edge Function
// THE ONLY PLACE payment balance math exists. Frontend never calculates payments.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { requireAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { calculatePaymentSummary } from '../_shared/paymentSummary.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const inputSchema = z.object({
  reservation_id: z.string().uuid(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  // Supports both admin auth and guest token (guest portal)
  const isGuestToken = req.headers.get('x-guest-token') === 'true'

  let propertyId: string | null = null

  if (!isGuestToken) {
    const authResult = await requireAuth(req)
    if (authResult.error) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
    }
    propertyId = authResult.propertyId
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

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Fetch reservation (verify property ownership for admin requests)
  const reservationQuery = supabase
    .from('reservations')
    .select('id, total_due_cents, status, property_id')
    .eq('id', parsed.data.reservation_id)

  if (propertyId) {
    reservationQuery.eq('property_id', propertyId)
  }

  const { data: reservation, error: resError } = await reservationQuery.single()

  if (resError || !reservation) {
    return new Response(JSON.stringify({ error: 'Reservation not found' }), { status: 404, headers: CORS_HEADERS })
  }

  // Fetch all payments for this reservation
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, type, status, amount_cents, method, created_at')
    .eq('reservation_id', parsed.data.reservation_id)
    .order('created_at', { ascending: true })

  if (paymentsError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch payments' }), { status: 500, headers: CORS_HEADERS })
  }

  const summary = calculatePaymentSummary(reservation.total_due_cents, payments ?? [])

  return new Response(
    JSON.stringify({ ...summary, charges: payments ?? [] }),
    { headers: CORS_HEADERS }
  )
})
