// update-reservation Edge Function
// Re-runs conflict check if dates/rooms changed. Recalculates total if needed.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { requireAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { logAdminAction } from '../_shared/audit.ts'
import { checkConflicts } from '../_shared/conflicts.ts'
import { sendModificationConfirmation } from '../_shared/email.ts'
import { calculatePricing } from '../_shared/pricing.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const inputSchema = z.object({
  reservation_id: z.string().uuid(),
  room_ids: z.array(z.string().uuid()).min(1).optional(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  num_guests: z.number().int().min(1).optional(),
  status: z.enum(['confirmed', 'pending', 'cancelled', 'no_show']).optional(),
  notes: z.string().optional(),
  skip_buffers: z.boolean().default(false),
  send_notification: z.boolean().default(false),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const authResult = await requireAuth(req)
  if (authResult.error) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
  }
  const { propertyId, user } = authResult

  const rateLimitError = await rateLimit(req, 30, 60_000, propertyId)
  if (rateLimitError) return rateLimitError

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

  // Fetch existing reservation (verify ownership) — select only the fields needed for update logic
  const { data: existing, error: fetchError } = await supabase
    .from('reservations')
    .select('id, room_ids, check_in, check_out, total_due_cents, guest_id, confirmation_number')
    .eq('id', input.reservation_id)
    .eq('property_id', propertyId)
    .single()

  if (fetchError || !existing) {
    return new Response(JSON.stringify({ error: 'Reservation not found' }), { status: 404, headers: CORS_HEADERS })
  }

  const newRoomIds = input.room_ids ?? existing.room_ids
  const newCheckIn = input.check_in ?? existing.check_in
  const newCheckOut = input.check_out ?? existing.check_out

  // Re-run conflict check if dates or rooms changed (includes buffer days)
  const datesChanged = input.check_in || input.check_out || input.room_ids
  if (datesChanged) {
    const { hasConflict, conflictingIds } = await checkConflicts(supabase, {
      propertyId,
      roomIds: newRoomIds,
      checkIn: newCheckIn,
      checkOut: newCheckOut,
      excludeReservationId: input.reservation_id,
      skipBuffers: input.skip_buffers,
    })

    if (hasConflict) {
      return new Response(
        JSON.stringify({ success: false, code: 'CONFLICT', conflictingIds }),
        { status: 409, headers: CORS_HEADERS }
      )
    }
  }

  // Recalculate total if dates or rooms changed — use authoritative calculatePricing()
  // so rate overrides, tax, and Stripe fee pass-through are all correctly applied.
  let totalDueCents = existing.total_due_cents
  if (datesChanged) {
    const pricing = await calculatePricing(supabase, {
      propertyId,
      roomIds: newRoomIds,
      checkIn: newCheckIn,
      checkOut: newCheckOut,
    })
    totalDueCents = pricing.totalCents
  }

  // Apply updates
  const updates: Record<string, unknown> = {}
  if (input.room_ids)   updates.room_ids = input.room_ids
  if (input.check_in)   updates.check_in = input.check_in
  if (input.check_out)  updates.check_out = input.check_out
  if (input.num_guests) updates.num_guests = input.num_guests
  if (input.status)     updates.status = input.status
  if (input.notes !== undefined) updates.notes = input.notes
  if (datesChanged)     updates.total_due_cents = totalDueCents

  const { data: updated, error: updateError } = await supabase
    .from('reservations')
    .update(updates)
    .eq('id', input.reservation_id)
    .select()
    .single()

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update reservation' }), { status: 500, headers: CORS_HEADERS })
  }

  // Audit log (fire-and-forget)
  logAdminAction(supabase, propertyId, user.id, 'update', 'reservation', input.reservation_id)
    .catch(e => console.error('[update-reservation] audit error:', e))

  // Guest notification (fire-and-forget)
  if (input.send_notification) {
    const { data: guest } = await supabase
      .from('guests')
      .select('first_name, last_name, email')
      .eq('id', existing.guest_id)
      .single()

    if (guest?.email) {
      sendModificationConfirmation(guest, { ...updated, property_id: propertyId }, supabase)
        .catch(e => console.error('[update-reservation] notification error:', e))
    }
  }

  return new Response(JSON.stringify({ success: true, reservation: updated }), { headers: CORS_HEADERS })
})
