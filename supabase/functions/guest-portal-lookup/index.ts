// guest-portal-lookup Edge Function
// Validates confirmation_number + email match.
// Returns GENERIC error for both wrong confirmation AND wrong email — never reveals which field failed.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { calculatePaymentSummary } from '../get-payment-summary/index.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

// Strict rate limit for portal lookup (prevents enumeration)
const PORTAL_RATE_LIMIT = 10

const inputSchema = z.object({
  confirmation_number: z.string().min(6).max(6).toUpperCase(),
  email: z.string().email(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const rateLimitError = rateLimit(req, PORTAL_RATE_LIMIT)
  if (rateLimitError) return rateLimitError

  let body: unknown
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
  }
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Reservation not found' }), { status: 404, headers: CORS_HEADERS })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Fetch reservation by confirmation number
  // check_in_time / check_out_time live on the settings table, not properties
  const { data: reservation, error: resError } = await supabase
    .from('reservations')
    .select(`
      id, confirmation_number, check_in, check_out, num_guests,
      status, origin, total_due_cents, notes, created_at,
      room_ids, property_id,
      guests!inner(id, first_name, last_name, email, phone),
      properties(name, timezone, location)
    `)
    .eq('confirmation_number', parsed.data.confirmation_number)
    .single()

  // Verify email matches — same error message whether confirmation or email is wrong
  const GENERIC_NOT_FOUND = new Response(
    JSON.stringify({ error: 'Reservation not found. Please check your confirmation number and email address.' }),
    { status: 404, headers: CORS_HEADERS }
  )

  if (resError || !reservation) return GENERIC_NOT_FOUND

  // Type-safe access to guest email
  const guest = reservation.guests as { email: string; first_name: string; last_name: string; phone: string | null }
  if (!guest || guest.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    return GENERIC_NOT_FOUND
  }

  // Fetch check_in_time / check_out_time / min_stay_nights from settings (not properties)
  const { data: settings } = await supabase
    .from('settings')
    .select('check_in_time, check_out_time, min_stay_nights')
    .eq('property_id', reservation.property_id)
    .single()

  // Merge settings into the properties object to preserve the API shape the frontend expects
  const reservationWithTimes = {
    ...reservation,
    properties: {
      ...(reservation.properties as Record<string, unknown> ?? {}),
      check_in_time: settings?.check_in_time ?? null,
      check_out_time: settings?.check_out_time ?? null,
      min_stay_nights: settings?.min_stay_nights ?? null,
    },
  }

  // Fetch rooms for display
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name, type, images')
    .in('id', reservation.room_ids)

  // Fetch payment summary
  const { data: payments } = await supabase
    .from('payments')
    .select('type, status, amount_cents, method, created_at')
    .eq('reservation_id', reservation.id)

  const paymentSummary = calculatePaymentSummary(reservation.total_due_cents, payments ?? [])

  return new Response(
    JSON.stringify({ reservation: reservationWithTimes, rooms: rooms ?? [], paymentSummary }),
    { headers: CORS_HEADERS }
  )
})
