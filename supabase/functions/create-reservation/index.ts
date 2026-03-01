// create-reservation Edge Function
// Most critical function. All 10 steps from spec Section 8.2.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { requireAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { sendBookingConfirmation } from '../_shared/email.ts'

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
  origin: z.enum(['direct', 'widget', 'import', 'phone']).default('direct'),
}).refine(d => d.guest_id || d.guest_email, { message: 'Either guest_id or guest_email is required' })
  .refine(d => new Date(d.check_out) > new Date(d.check_in), { message: 'check_out must be after check_in' })

/** Generate a 6-char alphanumeric confirmation number (excludes 0, O, I, 1) */
function generateConfirmationNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  // 1. Rate limit
  const rateLimitError = rateLimit(req)
  if (rateLimitError) return rateLimitError

  // 2. Auth
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
  }
  const { propertyId, user } = authResult

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

  // 6. Conflict check: any active reservation overlapping dates for these rooms?
  const { data: conflicts } = await supabase
    .from('reservations')
    .select('id, confirmation_number, check_in, check_out, room_ids')
    .eq('property_id', propertyId)
    .neq('status', 'cancelled')
    .lt('check_in', input.check_out)
    .gt('check_out', input.check_in)

  const conflictingIds = (conflicts ?? [])
    .filter(r => r.room_ids.some((rid: string) => input.room_ids.includes(rid)))
    .map(r => r.id)

  if (conflictingIds.length > 0) {
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

  // 8. Calculate total_due_cents server-side (authoritative)
  const nights = Math.ceil(
    (new Date(input.check_out).getTime() - new Date(input.check_in).getTime()) / (1000 * 60 * 60 * 24)
  )

  const { data: settings } = await supabase
    .from('settings')
    .select('tax_rate, require_payment_at_booking')
    .eq('property_id', propertyId)
    .single()

  const baseTotal = rooms.reduce((sum, r) => sum + r.base_rate_cents * nights, 0)
  const taxRate = settings?.tax_rate ?? 0
  const taxTotal = Math.round(baseTotal * (Number(taxRate) / 100))
  const totalDueCents = baseTotal + taxTotal

  // 9. Generate confirmation number with retry on collision
  let confirmationNumber = ''
  let attempts = 0
  while (attempts < 10) {
    const candidate = generateConfirmationNumber()
    const { data: existing } = await supabase
      .from('reservations')
      .select('id')
      .eq('confirmation_number', candidate)
      .single()
    if (!existing) { confirmationNumber = candidate; break }
    attempts++
  }
  if (!confirmationNumber) {
    return new Response(JSON.stringify({ error: 'Could not generate confirmation number' }), { status: 500, headers: CORS_HEADERS })
  }

  // 10. INSERT reservation
  const reservationStatus = settings?.require_payment_at_booking ? 'pending' : 'confirmed'

  const { data: reservation, error: insertError } = await supabase
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
      confirmation_number: confirmationNumber,
      notes: input.notes ?? null,
    })
    .select()
    .single()

  if (insertError || !reservation) {
    console.error('[create-reservation] insert error:', insertError?.message)
    return new Response(JSON.stringify({ error: 'Failed to create reservation' }), { status: 500, headers: CORS_HEADERS })
  }

  // 11. Send confirmation email (fire-and-forget)
  sendBookingConfirmation(guestRecord, reservation).catch(e => console.error('[create-reservation] email error:', e))

  return new Response(
    JSON.stringify({ success: true, reservation, confirmation_number: confirmationNumber }),
    { status: 201, headers: CORS_HEADERS }
  )
})
