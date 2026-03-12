// cancel-scheduled-message Edge Function
// Allows an innkeeper to cancel a specific pending scheduled message for a reservation.
// Called from the reservation drawer in the frontend.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { requireAuth } from '../_shared/auth.ts'
import { rateLimit } from '../_shared/rateLimit.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const inputSchema = z.object({
  scheduled_message_id: z.string().uuid(),
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  const authResult = await requireAuth(req)
  if (authResult.error) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS_HEADERS })
  }
  const { propertyId } = authResult

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

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Fetch the scheduled message and verify it belongs to this property
  const { data: msg, error: fetchError } = await supabase
    .from('scheduled_messages')
    .select('id, property_id, status')
    .eq('id', parsed.data.scheduled_message_id)
    .single()

  if (fetchError || !msg) {
    return new Response(JSON.stringify({ error: 'Scheduled message not found' }), { status: 404, headers: CORS_HEADERS })
  }

  if (msg.property_id !== propertyId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: CORS_HEADERS })
  }

  if (msg.status !== 'pending') {
    return new Response(
      JSON.stringify({ error: `Cannot cancel a message with status '${msg.status}'` }),
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const { error: updateError } = await supabase
    .from('scheduled_messages')
    .update({
      status: 'cancelled',
      cancelled_by: 'innkeeper',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.scheduled_message_id)

  if (updateError) {
    console.error('[cancel-scheduled-message] update error:', updateError.message)
    return new Response(JSON.stringify({ error: 'Failed to cancel message' }), { status: 500, headers: CORS_HEADERS })
  }

  return new Response(JSON.stringify({ success: true }), { headers: CORS_HEADERS })
})
