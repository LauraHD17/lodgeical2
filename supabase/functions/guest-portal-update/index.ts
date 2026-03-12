// guest-portal-update Edge Function
// Allows guests to update contact info or attach themselves as booker to a reservation.
// Rate limited to 5 req/min (stricter than lookup). All actions logged to guest_portal_activity.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { rateLimit } from '../_shared/rateLimit.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UPDATE_RATE_LIMIT = 5

const updateContactSchema = z.object({
  action: z.literal('update_contact'),
  confirmation_number: z.string().min(6).max(6).toUpperCase(),
  email: z.string().email(),
  new_email: z.string().email().optional(),
  new_phone: z.string().min(7).max(20).optional(),
  billing_address_line1: z.string().max(200).optional(),
  billing_address_line2: z.string().max(200).optional(),
  billing_city: z.string().max(100).optional(),
  billing_state: z.string().max(100).optional(),
  billing_postal_code: z.string().max(20).optional(),
  billing_country: z.string().max(100).optional(),
})

const attachBookerSchema = z.object({
  action: z.literal('attach_booker'),
  confirmation_number: z.string().min(6).max(6).toUpperCase(),
  email: z.string().email(),
  target_reservation_id: z.string().uuid(),
})

const inputSchema = z.discriminatedUnion('action', [updateContactSchema, attachBookerSchema])

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const rateLimitError = await rateLimit(req, UPDATE_RATE_LIMIT)
  if (rateLimitError) return rateLimitError

  let body: unknown
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
  }

  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }),
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Verify identity: confirmation_number + email
  const { data: reservation, error: resError } = await supabase
    .from('reservations')
    .select('id, guest_id, property_id, confirmation_number, guests!inner(id, email, phone, first_name, last_name)')
    .eq('confirmation_number', parsed.data.confirmation_number)
    .single()

  if (resError || !reservation) {
    return new Response(
      JSON.stringify({ error: 'Reservation not found. Please check your confirmation number and email address.' }),
      { status: 404, headers: CORS_HEADERS }
    )
  }

  const guest = reservation.guests as { id: string; email: string; phone: string | null; first_name: string; last_name: string }
  const inputEmail = parsed.data.email.toLowerCase()
  if (guest.email.toLowerCase() !== inputEmail) {
    return new Response(
      JSON.stringify({ error: 'Reservation not found. Please check your confirmation number and email address.' }),
      { status: 404, headers: CORS_HEADERS }
    )
  }

  const { action } = parsed.data

  // ── Update Contact ───────────────────────────────────────────────────────
  if (action === 'update_contact') {
    const { new_email, new_phone, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_postal_code, billing_country } = parsed.data
    const hasAddressFields = billing_address_line1 !== undefined || billing_address_line2 !== undefined || billing_city !== undefined || billing_state !== undefined || billing_postal_code !== undefined || billing_country !== undefined

    if (!new_email && !new_phone && !hasAddressFields) {
      return new Response(
        JSON.stringify({ error: 'Please provide updated information.' }),
        { status: 400, headers: CORS_HEADERS }
      )
    }

    const updates: Record<string, string> = {}
    const details: Record<string, string | null> = {}

    if (new_email && new_email.toLowerCase() !== guest.email.toLowerCase()) {
      details.old_email = guest.email
      details.new_email = new_email
      updates.email = new_email.toLowerCase()
    }
    if (new_phone && new_phone !== guest.phone) {
      details.old_phone = guest.phone
      details.new_phone = new_phone
      updates.phone = new_phone
    }

    // Address fields — can be updated but not cleared to blank once set
    const addressFields = [
      ['billing_address_line1', billing_address_line1],
      ['billing_address_line2', billing_address_line2],
      ['billing_city', billing_city],
      ['billing_state', billing_state],
      ['billing_postal_code', billing_postal_code],
      ['billing_country', billing_country],
    ] as const
    for (const [field, value] of addressFields) {
      if (value !== undefined && value.trim() !== '') {
        updates[field] = value.trim()
        details[field] = value.trim()
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No changes needed.' }), { headers: CORS_HEADERS })
    }

    const { error: updateError } = await supabase
      .from('guests')
      .update(updates)
      .eq('id', guest.id)

    if (updateError) {
      console.error('[guest-portal-update] update error:', updateError)
      return new Response(
        JSON.stringify({ error: 'Could not update contact information. Please try again.' }),
        { status: 500, headers: CORS_HEADERS }
      )
    }

    // Log activity
    await supabase.from('guest_portal_activity').insert({
      property_id: reservation.property_id,
      guest_id: guest.id,
      action: 'contact_updated',
      details,
    }).then(null, (e: Error) => console.error('[guest-portal-update] activity log error:', e))

    return new Response(
      JSON.stringify({ success: true, message: 'Contact information updated.' }),
      { headers: CORS_HEADERS }
    )
  }

  // ── Attach as Booker ─────────────────────────────────────────────────────
  if (action === 'attach_booker') {
    const { target_reservation_id } = parsed.data

    // Verify the target reservation belongs to the same guest (security: can only attach to own reservations)
    const { data: targetRes, error: targetError } = await supabase
      .from('reservations')
      .select('id, guest_id, property_id, confirmation_number, booker_email')
      .eq('id', target_reservation_id)
      .single()

    if (targetError || !targetRes) {
      return new Response(
        JSON.stringify({ error: 'Target reservation not found.' }),
        { status: 404, headers: CORS_HEADERS }
      )
    }

    // Security: only allow if the guest is the guest on the target reservation
    if (targetRes.guest_id !== guest.id) {
      return new Response(
        JSON.stringify({ error: 'You can only attach yourself as booker to your own reservations.' }),
        { status: 403, headers: CORS_HEADERS }
      )
    }

    const { error: updateError } = await supabase
      .from('reservations')
      .update({ booker_email: guest.email })
      .eq('id', target_reservation_id)

    if (updateError) {
      console.error('[guest-portal-update] booker attach error:', updateError)
      return new Response(
        JSON.stringify({ error: 'Could not update reservation. Please try again.' }),
        { status: 500, headers: CORS_HEADERS }
      )
    }

    // Log activity
    await supabase.from('guest_portal_activity').insert({
      property_id: targetRes.property_id,
      reservation_id: target_reservation_id,
      guest_id: guest.id,
      action: 'booker_attached',
      details: {
        target_reservation_id,
        booker_email: guest.email,
        confirmation_number: targetRes.confirmation_number,
      },
    }).then(null, (e: Error) => console.error('[guest-portal-update] activity log error:', e))

    return new Response(
      JSON.stringify({ success: true, message: 'You have been attached as booker to this reservation.' }),
      { headers: CORS_HEADERS }
    )
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: CORS_HEADERS })
})
