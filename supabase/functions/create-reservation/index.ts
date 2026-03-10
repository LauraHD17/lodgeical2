// create-reservation Edge Function
// Most critical function. All 10 steps from spec Section 8.2.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { requireAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAdminAction } from '../_shared/audit.ts'
import { sendBookingConfirmation } from '../_shared/email.ts'
import { calculatePricing } from '../_shared/pricing.ts'
import { checkConflicts } from '../_shared/conflicts.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const inputSchema = z.object({
  room_ids: z.array(z.string().uuid()).min(1),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  num_guests: z.number().int().min(1),
  guest_id: z.string().uuid().optional(),
  guest_email: z.string().email().optional(),
  guest_first_name: z.string().min(1).optional(),
  guest_last_name: z.string().min(1).optional(),
  guest_phone: z.string().optional(),
  notes: z.string().optional(),
  booker_email: z.string().email().optional(),
  cc_emails: z.array(z.string().email()).max(5).default([]),
  origin: z.enum(['direct', 'widget', 'import', 'phone']).default('direct'),
  skip_buffers: z.boolean().default(false),
}).refine(d => d.guest_id || d.guest_email, { message: 'Either guest_id or guest_email is required' })
  .refine(d => new Date(d.check_out) > new Date(d.check_in), { message: 'check_out must be after check_in' })

/** Generate a cryptographically random 6-char confirmation number (excludes 0, O, I, 1) */
function generateConfirmationNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => chars[b % chars.length]).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  // 1. Auth
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
  }
  const { propertyId, user } = authResult

  // 2. Rate limit (property-scoped)
  const rateLimitError = await rateLimit(req, 30, 60_000, propertyId)
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
  const input = parsed.data

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // 4. Verify all room_ids belong to the authenticated property
  const { data: rooms, error: roomError } = await supabase
    .from('rooms')
    .select('id, max_guests, base_rate_cents, is_active')
    .in('id', input.room_ids)
    .eq('property_id', propertyId)
    .eq('is_active', true)

  if (roomError || !rooms || rooms.length !== input.room_ids.length) {
    return new Response(JSON.stringify({ error: 'One or more rooms not found or not owned by this property' }), { status: 403, headers: CORS_HEADERS })
  }

  // 5. Verify num_guests does not exceed combined max_guests
  const totalMaxGuests = rooms.reduce((sum, r) => sum + r.max_guests, 0)
  if (input.num_guests > totalMaxGuests) {
    return new Response(JSON.stringify({ error: `Guest count ${input.num_guests} exceeds room capacity of ${totalMaxGuests}` }), { status: 400, headers: CORS_HEADERS })
  }

  // 6. Conflict check (includes buffer days)
  const { hasConflict, conflictingIds } = await checkConflicts(supabase, {
    propertyId,
    roomIds: input.room_ids,
    checkIn: input.check_in,
    checkOut: input.check_out,
    skipBuffers: input.skip_buffers,
  })

  if (hasConflict) {
    return new Response(
      JSON.stringify({ success: false, code: 'CONFLICT', conflictingIds }),
      { status: 409, headers: CORS_HEADERS }
    )
  }

  // 7. Guest resolution
  let guestId: string
  let guestRecord: { first_name: string; last_name: string; email: string }

  if (input.guest_id) {
    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .select('id, first_name, last_name, email, is_tax_exempt')
      .eq('id', input.guest_id)
      .eq('property_id', propertyId)
      .single()
    if (guestError || !guest) {
      return new Response(JSON.stringify({ error: 'Guest not found' }), { status: 404, headers: CORS_HEADERS })
    }
    guestId = guest.id
    guestRecord = guest
  } else {
    // Upsert guest by email
    const { data: guest, error: upsertError } = await supabase
      .from('guests')
      .upsert({
        property_id: propertyId,
        email: input.guest_email!,
        first_name: input.guest_first_name ?? 'Guest',
        last_name: input.guest_last_name ?? '',
        phone: input.guest_phone ?? null,
      }, { onConflict: 'property_id,email' })
      .select('id, first_name, last_name, email, is_tax_exempt')
      .single()
    if (upsertError || !guest) {
      return new Response(JSON.stringify({ error: 'Failed to create or find guest' }), { status: 500, headers: CORS_HEADERS })
    }
    guestId = guest.id
    guestRecord = guest
  }

  // 8. Calculate total_due_cents server-side (authoritative, with seasonal overrides)
  const [pricing, { data: settings }] = await Promise.all([
    calculatePricing(supabase, {
      propertyId,
      roomIds: input.room_ids,
      checkIn: input.check_in,
      checkOut: input.check_out,
    }),
    supabase
      .from('settings')
      .select('tax_rate, require_payment_at_booking, pass_through_stripe_fee')
      .eq('property_id', propertyId)
      .single(),
  ])
  const totalDueCents = pricing.totalCents

  // 9. INSERT reservation — generate confirmation number and insert directly.
  // Rely on the DB UNIQUE constraint (error code 23505) to detect the rare collision
  // rather than a check-then-insert loop, which has a race condition under concurrency.
  // Widget bookings are always confirmed (guest pays or pays at property).
  // Only admin-created ("direct") bookings are pending when payment is required.
  const reservationStatus = (input.origin !== 'widget' && settings?.require_payment_at_booking) ? 'pending' : 'confirmed'

  let reservation: Record<string, unknown> | null = null
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateConfirmationNumber()
    const { data, error: insertError } = await supabase
      .from('reservations')
      .insert({
        property_id: propertyId,
        guest_id: guestId,
        room_ids: input.room_ids,
        check_in: input.check_in,
        check_out: input.check_out,
        num_guests: input.num_guests,
        status: reservationStatus,
        origin: input.origin,
        total_due_cents: totalDueCents,
        confirmation_number: candidate,
        notes: input.notes ?? null,
        booker_email: input.booker_email ?? null,
        cc_emails: input.cc_emails,
      })
      .select()
      .single()

    if (!insertError) { reservation = data; break }
    // 23505 = unique_violation on confirmation_number — retry with new candidate
    if (insertError.code !== '23505') {
      console.error('[create-reservation] insert error:', insertError.message)
      return new Response(JSON.stringify({ error: 'Failed to create reservation' }), { status: 500, headers: CORS_HEADERS })
    }
  }

  if (!reservation) {
    return new Response(JSON.stringify({ error: 'Could not generate confirmation number' }), { status: 500, headers: CORS_HEADERS })
  }

  // 10. Audit log (fire-and-forget)
  logAdminAction(supabase, propertyId, user.id, 'create', 'reservation', reservation.id as string)
    .catch(e => console.error('[create-reservation] audit error:', e))

  // 11. Send confirmation email (fire-and-forget, uses property template if set)
  const resForEmail = { ...reservation, property_id: propertyId, room_ids: input.room_ids }
  sendBookingConfirmation(guestRecord, resForEmail, supabase)
    .catch(e => console.error('[create-reservation] email error:', e))

  // 10b. If a booker email is set and different from guest, send them a copy
  if (input.booker_email && input.booker_email.toLowerCase() !== guestRecord.email.toLowerCase()) {
    const bookerAsRecipient = { ...guestRecord, email: input.booker_email }
    sendBookingConfirmation(bookerAsRecipient, resForEmail, supabase)
      .catch(e => console.error('[create-reservation] booker email error:', e))
  }

  return new Response(
    JSON.stringify({ success: true, reservation, confirmation_number: reservation.confirmation_number }),
    { status: 201, headers: CORS_HEADERS }
  )
})
