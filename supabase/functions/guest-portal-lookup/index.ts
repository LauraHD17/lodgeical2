// guest-portal-lookup Edge Function
// Validates confirmation_number + email match, then returns:
//   - Full detail for the looked-up reservation (payment, modification, cancellation support)
//   - Summary of ALL reservations for that email (history, payments tabs)
// Confirmation number + email are ALWAYS required — no email-only mode (prevents enumeration).
// Returns GENERIC error for both wrong confirmation AND wrong email — never reveals which field failed.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { calculatePaymentSummary } from '../_shared/paymentSummary.ts'

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

  const GENERIC_NOT_FOUND = new Response(
    JSON.stringify({ error: 'Reservation not found. Please check your confirmation number and email address.' }),
    { status: 404, headers: CORS_HEADERS }
  )

  const inputEmail = parsed.data.email.toLowerCase()

  // ── Validate confirmation_number + email ───────────────────────────────────
  const { data: reservation, error: resError } = await supabase
    .from('reservations')
    .select(`
      id, confirmation_number, check_in, check_out, num_guests,
      status, origin, total_due_cents, notes, created_at,
      room_ids, property_id, modification_count,
      booker_email, cc_emails,
      guests!inner(id, first_name, last_name, email, phone, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country),
      properties(name, timezone, location)
    `)
    .eq('confirmation_number', parsed.data.confirmation_number)
    .single()

  if (resError || !reservation) return GENERIC_NOT_FOUND

  const guest = reservation.guests as { id: string; email: string; first_name: string; last_name: string; phone: string | null; billing_address_line1: string | null; billing_address_line2: string | null; billing_city: string | null; billing_state: string | null; billing_postal_code: string | null; billing_country: string | null }
  const guestEmailMatch = guest?.email.toLowerCase() === inputEmail
  const bookerEmailMatch = reservation.booker_email?.toLowerCase() === inputEmail
  if (!guest || (!guestEmailMatch && !bookerEmailMatch)) {
    return GENERIC_NOT_FOUND
  }

  // ── Fetch settings ─────────────────────────────────────────────────────────
  const { data: settings } = await supabase
    .from('settings')
    .select('check_in_time, check_out_time, min_stay_nights, cancellation_policy, house_rules')
    .eq('property_id', reservation.property_id)
    .single()

  const reservationWithTimes = {
    ...reservation,
    properties: {
      ...(reservation.properties as Record<string, unknown> ?? {}),
      check_in_time:       settings?.check_in_time       ?? null,
      check_out_time:      settings?.check_out_time      ?? null,
      min_stay_nights:     settings?.min_stay_nights     ?? null,
      cancellation_policy: settings?.cancellation_policy ?? null,
      house_rules:         settings?.house_rules         ?? null,
    },
  }

  // ── Fetch rooms, payments for this reservation + all reservations for this email ──
  const [{ data: rooms }, { data: allRooms }, { data: payments }, { data: guestReservations }, { data: bookerReservations }] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, name, type, images')
      .in('id', reservation.room_ids),
    supabase
      .from('rooms')
      .select('id, name, type, base_rate_cents, max_guests')
      .eq('property_id', reservation.property_id)
      .eq('is_active', true),
    supabase
      .from('payments')
      .select('type, status, amount_cents, method, created_at')
      .eq('reservation_id', reservation.id),
    // All reservations where guest email matches (for history/payments tabs)
    supabase
      .from('reservations')
      .select(`
        id, confirmation_number, check_in, check_out, num_guests,
        status, origin, total_due_cents, notes, created_at,
        room_ids, property_id, modification_count,
        booker_email, cc_emails,
        guests!inner(id, first_name, last_name, email, phone),
        properties(name, timezone, location)
      `)
      .eq('property_id', reservation.property_id)
      .eq('guests.email', guest.email)
      .order('check_in', { ascending: false }),
    // All reservations where booker email matches
    supabase
      .from('reservations')
      .select(`
        id, confirmation_number, check_in, check_out, num_guests,
        status, origin, total_due_cents, notes, created_at,
        room_ids, property_id, modification_count,
        booker_email, cc_emails,
        guests!inner(id, first_name, last_name, email, phone),
        properties(name, timezone, location)
      `)
      .eq('property_id', reservation.property_id)
      .ilike('booker_email', inputEmail)
      .order('check_in', { ascending: false }),
  ])

  // Deduplicate all reservations
  const allResMap = new Map<string, Record<string, unknown>>()
  for (const r of (guestReservations ?? [])) allResMap.set(r.id, r)
  for (const r of (bookerReservations ?? [])) allResMap.set(r.id, r)
  const allReservationsList = Array.from(allResMap.values())

  // Fetch all payments across all reservations (for Payments tab)
  const allReservationIds = allReservationsList.map((r) => r.id as string)
  const allResRoomIds = [...new Set(allReservationsList.flatMap((r) => (r.room_ids as string[]) ?? []))]

  const [{ data: allPayments }, { data: allResRooms }] = await Promise.all([
    allReservationIds.length > 0
      ? supabase
          .from('payments')
          .select('id, type, status, amount_cents, method, created_at, reservation_id')
          .in('reservation_id', allReservationIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    allResRoomIds.length > 0
      ? supabase.from('rooms').select('id, name, type, images').in('id', allResRoomIds)
      : Promise.resolve({ data: [] }),
  ])

  // Enrich all reservations with settings
  const enrichedReservations = allReservationsList.map((r) => ({
    ...r,
    modification_count: (r.modification_count as number) ?? 0,
    properties: {
      ...(r.properties as Record<string, unknown> ?? {}),
      check_in_time:       settings?.check_in_time       ?? null,
      check_out_time:      settings?.check_out_time      ?? null,
      min_stay_nights:     settings?.min_stay_nights     ?? null,
      cancellation_policy: settings?.cancellation_policy ?? null,
      house_rules:         settings?.house_rules         ?? null,
    },
  }))

  const paymentSummary = calculatePaymentSummary(reservation.total_due_cents, payments ?? [])

  return new Response(
    JSON.stringify({
      reservation: { ...reservationWithTimes, modification_count: reservation.modification_count ?? 0 },
      rooms: rooms ?? [],
      availableRooms: allRooms ?? [],
      paymentSummary,
      // All-reservations data (for history/payments/contact tabs)
      reservations: enrichedReservations,
      guest: {
        id: guest.id, first_name: guest.first_name, last_name: guest.last_name, email: guest.email, phone: guest.phone,
        billing_address_line1: guest.billing_address_line1, billing_address_line2: guest.billing_address_line2,
        billing_city: guest.billing_city, billing_state: guest.billing_state,
        billing_postal_code: guest.billing_postal_code, billing_country: guest.billing_country,
      },
      allRooms: allResRooms ?? [],
      payments: allPayments ?? [],
    }),
    { headers: CORS_HEADERS }
  )
})
