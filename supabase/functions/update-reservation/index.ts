// update-reservation Edge Function
// Re-runs conflict check if dates/rooms changed. Recalculates total if needed.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { requireAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const inputSchema = z.object({
  reservation_id: z.string().uuid(),
  room_ids: z.array(z.string().uuid()).min(1).optional(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  num_guests: z.number().int().min(1).optional(),
  status: z.enum(['confirmed', 'pending', 'cancelled', 'no_show']).optional(),
  notes: z.string().optional(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const rateLimitError = rateLimit(req)
  if (rateLimitError) return rateLimitError

  const authResult = await requireAuth(req)
  if (authResult.error) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
  }
  const { propertyId } = authResult

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
    .select('id, room_ids, check_in, check_out, total_due_cents')
    .eq('id', input.reservation_id)
    .eq('property_id', propertyId)
    .single()

  if (fetchError || !existing) {
    return new Response(JSON.stringify({ error: 'Reservation not found' }), { status: 404, headers: CORS_HEADERS })
  }

  const newRoomIds = input.room_ids ?? existing.room_ids
  const newCheckIn = input.check_in ?? existing.check_in
  const newCheckOut = input.check_out ?? existing.check_out

  // Re-run conflict check if dates or rooms changed
  const datesChanged = input.check_in || input.check_out || input.room_ids
  if (datesChanged) {
    const { data: conflicts } = await supabase
      .from('reservations')
      .select('id, room_ids')
      .eq('property_id', propertyId)
      .neq('status', 'cancelled')
      .neq('id', input.reservation_id) // exclude current reservation
      .lt('check_in', newCheckOut)
      .gt('check_out', newCheckIn)

    const conflictingIds = (conflicts ?? [])
      .filter(r => r.room_ids.some((rid: string) => newRoomIds.includes(rid)))
      .map(r => r.id)

    if (conflictingIds.length > 0) {
      return new Response(
        JSON.stringify({ success: false, code: 'CONFLICT', conflictingIds }),
        { status: 409, headers: CORS_HEADERS }
      )
    }
  }

  // Recalculate total if dates or rooms changed
  let totalDueCents = existing.total_due_cents
  if (datesChanged) {
    const { data: rooms } = await supabase
      .from('rooms')
      .select('base_rate_cents')
      .in('id', newRoomIds)
      .eq('property_id', propertyId)

    const nights = Math.ceil(
      (new Date(newCheckOut).getTime() - new Date(newCheckIn).getTime()) / (1000 * 60 * 60 * 24)
    )
    const { data: settings } = await supabase
      .from('settings').select('tax_rate').eq('property_id', propertyId).single()

    const baseTotal = (rooms ?? []).reduce((sum, r) => sum + r.base_rate_cents * nights, 0)
    const taxRate = settings?.tax_rate ?? 0
    totalDueCents = baseTotal + Math.round(baseTotal * (Number(taxRate) / 100))
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

  return new Response(JSON.stringify({ success: true, reservation: updated }), { headers: CORS_HEADERS })
})
