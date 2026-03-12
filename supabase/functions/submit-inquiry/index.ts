// submit-inquiry Edge Function
// Public endpoint — no auth required, rate-limited.
// Inserts a guest inquiry into the inquiries table.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { rateLimit } from '../_shared/rateLimit.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const INQUIRY_RATE_LIMIT = 5

const inputSchema = z.object({
  property_id: z.string().uuid(),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  check_out: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  guest_first_name: z.string().min(1).max(100),
  guest_last_name: z.string().min(1).max(100),
  guest_email: z.string().email(),
  guest_phone: z.string().max(30).optional(),
  num_guests_range: z.enum(['1-2', '3-4', '5-6', '7+']).default('1-2'),
  room_ids: z.array(z.string().uuid()).optional(),
  notes: z.string().max(1000).optional(),
  acknowledged: z.literal(true, { errorMap: () => ({ message: 'Acknowledgement is required' }) }),
}).refine(d => new Date(d.check_out) > new Date(d.check_in), {
  message: 'check_out must be after check_in',
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const rateLimitError = await rateLimit(req, INQUIRY_RATE_LIMIT)
  if (rateLimitError) return rateLimitError

  try {
    let body: unknown
    try { body = await req.json() } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS_HEADERS })
    }

    const parsed = inputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }), {
        status: 400, headers: CORS_HEADERS,
      })
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Verify property exists and is public
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id')
      .eq('id', parsed.data.property_id)
      .eq('is_active', true)
      .eq('is_public', true)
      .single()

    if (propError || !property) {
      return new Response(JSON.stringify({ error: 'Property not found' }), { status: 404, headers: CORS_HEADERS })
    }

    // Insert inquiry
    const { acknowledged: _, ...insertData } = parsed.data
    const { error: insertError } = await supabase
      .from('inquiries')
      .insert(insertData)

    if (insertError) {
      console.error('[submit-inquiry] insert error:', insertError)
      return new Response(JSON.stringify({ error: 'Failed to submit inquiry' }), { status: 500, headers: CORS_HEADERS })
    }

    return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[submit-inquiry]', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: CORS_HEADERS })
  }
})
