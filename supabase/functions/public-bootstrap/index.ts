// public-bootstrap Edge Function
// Called by the booking widget using anon key. RLS enforces access.
// Returns only public-safe fields — never Stripe keys or admin data.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { rateLimit } from '../_shared/rateLimit.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const rateLimitError = rateLimit(req)
  if (rateLimitError) return rateLimitError

  const url = new URL(req.url)
  const slug = url.searchParams.get('slug')

  if (!slug) {
    return new Response(JSON.stringify({ error: 'slug parameter is required' }), { status: 400, headers: CORS_HEADERS })
  }

  // Use anon key — RLS enforces is_active + is_public
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!
  )

  // Validate property — slug is safe to expose in URLs
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, name, slug, images, location, timezone')
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('is_public', true)
    .single()

  if (propError || !property) {
    // Generic 404 — don't reveal whether the property exists but is private
    return new Response(JSON.stringify({ error: 'Property not found' }), { status: 404, headers: CORS_HEADERS })
  }

  // Fetch active rooms (RLS policy on rooms enforces is_active + public property)
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name, type, max_guests, base_rate_cents, description, images, amenities, sort_order')
    .eq('property_id', property.id)
    .eq('is_active', true)
    .order('sort_order')

  // Fetch active room links (linked combinations of rooms with their own rate)
  const { data: roomLinks } = await supabase
    .from('room_links')
    .select('id, name, linked_room_ids, base_rate_cents, max_guests, description')
    .eq('property_id', property.id)
    .eq('is_active', true)

  // Fetch public-safe settings (strip Stripe keys)
  const { data: rawSettings } = await supabase
    .from('settings')
    .select('tax_rate, currency, cancellation_policy, check_in_time, check_out_time, min_stay_nights, require_payment_at_booking, allow_partial_payment')
    .eq('property_id', property.id)
    .single()
  // Note: stripe_account_id and stripe_publishable_key are NOT selected — safe by omission

  return new Response(
    JSON.stringify({ property, rooms: rooms ?? [], roomLinks: roomLinks ?? [], settings: rawSettings ?? {} }),
    { headers: CORS_HEADERS }
  )
})
