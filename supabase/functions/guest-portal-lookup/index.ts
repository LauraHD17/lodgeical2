// guest-portal-lookup Edge Function
// Validates confirmation_number + email match.
// Two modes:
//   1. confirmation_number + email → single reservation (original behavior)
//   2. email only → all reservations for that guest (for history/payments tabs)
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
  confirmation_number: z.string().min(6).max(6).toUpperCase().optional(),
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

  // ── Mode 1: Single reservation lookup (confirmation_number + email) ──────
  if (parsed.data.confirmation_number) {
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select(`
        id, confirmation_number, check_in, check_out, num_guests,
        status, origin, total_due_cents, notes, created_at,
        room_ids, property_id, modification_count,
        booker_email, cc_emails,
        guests!inner(id, first_name, last_name, email, phone),
        properties(name, timezone, location)
      `)
      .eq('confirmation_number', parsed.data.confirmation_number)
      .single()

    if (resError || !reservation) return GENERIC_NOT_FOUND

    const guest = reservation.guests as { id: string; email: string; first_name: string; last_name: string; phone: string | null }
    const guestEmailMatch = guest?.email.toLowerCase() === inputEmail
    const bookerEmailMatch = reservation.booker_email?.toLowerCase() === inputEmail
    if (!guest || (!guestEmailMatch && !bookerEmailMatch)) {
      return GENERIC_NOT_FOUND
    }

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

    const [{ data: rooms }, { data: allRooms }, { data: payments }] = await Promise.all([
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
    ])

    const paymentSummary = calculatePaymentSummary(reservation.total_due_cents, payments ?? [])

    return new Response(
      JSON.stringify({
        reservation: { ...reservationWithTimes, modification_count: reservation.modification_count ?? 0 },
        rooms: rooms ?? [],
        availableRooms: allRooms ?? [],
        paymentSummary,
      }),
      { headers: CORS_HEADERS }
    )
  }

  // ── Mode 2: All reservations by email ────────────────────────────────────
  // First find the guest by email
  const { data: guestRows } = await supabase
    .from('guests')
    .select('id, first_name, last_name, email, phone, property_id')
    .ilike('email', inputEmail)

  if (!guestRows || guestRows.length === 0) {
    return GENERIC_NOT_FOUND
  }

  const guest = guestRows[0]
  const propertyId = guest.property_id

  // Fetch all reservations for this guest + any where they are booker
  const [{ data: guestReservations }, { data: bookerReservations }] = await Promise.all([
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
      .eq('guest_id', guest.id)
      .order('check_in', { ascending: false }),
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
      .ilike('booker_email', inputEmail)
      .neq('guest_id', guest.id)
      .order('check_in', { ascending: false }),
  ])

  // Deduplicate and merge
  const allReservations = [...(guestReservations ?? []), ...(bookerReservations ?? [])]
  const seen = new Set<string>()
  const reservations = allReservations.filter(r => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })

  if (reservations.length === 0) {
    return GENERIC_NOT_FOUND
  }

  // Fetch settings, rooms, and all payments for these reservations
  const reservationIds = reservations.map(r => r.id)
  const allRoomIds = [...new Set(reservations.flatMap(r => r.room_ids ?? []))]

  const [{ data: settings }, { data: rooms }, { data: allRooms }, { data: payments }] = await Promise.all([
    supabase
      .from('settings')
      .select('check_in_time, check_out_time, min_stay_nights, cancellation_policy, house_rules')
      .eq('property_id', propertyId)
      .single(),
    supabase
      .from('rooms')
      .select('id, name, type, images')
      .in('id', allRoomIds),
    supabase
      .from('rooms')
      .select('id, name, type, base_rate_cents, max_guests')
      .eq('property_id', propertyId)
      .eq('is_active', true),
    supabase
      .from('payments')
      .select('type, status, amount_cents, method, created_at, reservation_id')
      .in('reservation_id', reservationIds)
      .order('created_at', { ascending: false }),
  ])

  // Enrich reservations with settings
  const enrichedReservations = reservations.map(r => ({
    ...r,
    modification_count: r.modification_count ?? 0,
    properties: {
      ...(r.properties as Record<string, unknown> ?? {}),
      check_in_time:       settings?.check_in_time       ?? null,
      check_out_time:      settings?.check_out_time      ?? null,
      min_stay_nights:     settings?.min_stay_nights     ?? null,
      cancellation_policy: settings?.cancellation_policy ?? null,
      house_rules:         settings?.house_rules         ?? null,
    },
  }))

  return new Response(
    JSON.stringify({
      reservations: enrichedReservations,
      guest: { id: guest.id, first_name: guest.first_name, last_name: guest.last_name, email: guest.email, phone: guest.phone },
      rooms: rooms ?? [],
      availableRooms: allRooms ?? [],
      payments: payments ?? [],
    }),
    { headers: CORS_HEADERS }
  )
})
