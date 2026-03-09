// preview-pricing Edge Function
// Public endpoint for the booking widget to get server-side pricing preview.
// Uses the same calculatePricing as create-reservation — single source of truth.
// No auth required (public widget), but rate-limited.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { rateLimit } from '../_shared/rateLimit.ts'
import { calculatePricing } from '../_shared/pricing.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const inputSchema = z.object({
  property_id: z.string().uuid(),
  room_ids: z.array(z.string().uuid()).min(1),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
}).refine(d => new Date(d.check_out) > new Date(d.check_in), { message: 'check_out must be after check_in' })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const rateLimitError = rateLimit(req)
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

  // Use service role key — the pricing function needs to read rooms, settings, and rate_overrides
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Verify property exists and is public (prevent pricing enumeration for private properties)
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', input.property_id)
    .eq('is_active', true)
    .eq('is_public', true)
    .single()

  if (propError || !property) {
    return new Response(JSON.stringify({ error: 'Property not found' }), { status: 404, headers: CORS_HEADERS })
  }

  try {
    const pricing = await calculatePricing(supabase, {
      propertyId: input.property_id,
      roomIds: input.room_ids,
      checkIn: input.check_in,
      checkOut: input.check_out,
    })

    return new Response(JSON.stringify(pricing), { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[preview-pricing]', err)
    return new Response(JSON.stringify({ error: 'Pricing calculation failed' }), { status: 500, headers: CORS_HEADERS })
  }
})
