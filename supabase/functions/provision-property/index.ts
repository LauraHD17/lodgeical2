// provision-property Edge Function
// Provisions a new property for a freshly signed-up user.
// Creates property, user_property_access (owner role), and default settings.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3'
import { requireUser } from '../_shared/auth.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

const inputSchema = z.object({
  property_name: z.string().min(1).max(100),
  timezone: z.string().optional().default('America/New_York'),
})

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

function randomSuffix(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  let result = ''
  const rand = new Uint8Array(4)
  crypto.getRandomValues(rand)
  for (let i = 0; i < 4; i++) {
    result += chars[rand[i] % chars.length]
  }
  return result
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: CORS_HEADERS,
    })
  }

  try {
    // 1. Validate JWT — user may not have a property yet
    const authResult = await requireUser(req)
    if (authResult.error) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: CORS_HEADERS,
      })
    }
    const { user } = authResult

    // 2. Parse and validate input
    const body = await req.json()
    const parsed = inputSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid input', details: parsed.error.flatten() }), {
        status: 400, headers: CORS_HEADERS,
      })
    }
    const { property_name, timezone } = parsed.data

    // 3. Service role client for privileged inserts
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 4. Check user doesn't already have a property
    const { data: existingAccess } = await supabase
      .from('user_property_access')
      .select('property_id')
      .eq('user_id', user.id)
      .single()

    if (existingAccess) {
      return new Response(JSON.stringify({ error: 'User already has a property' }), {
        status: 409, headers: CORS_HEADERS,
      })
    }

    // 5. Generate unique slug
    let slug = generateSlug(property_name)
    const { data: slugCollision } = await supabase
      .from('properties')
      .select('id')
      .eq('slug', slug)
      .single()

    if (slugCollision) {
      slug = `${slug}-${randomSuffix()}`
    }

    // 6. Insert property
    const { data: property, error: propError } = await supabase
      .from('properties')
      .insert({ name: property_name, slug, timezone })
      .select('id, name, slug')
      .single()

    if (propError || !property) {
      console.error('[provision-property] insert property error:', propError)
      return new Response(JSON.stringify({ error: 'Failed to create property' }), {
        status: 500, headers: CORS_HEADERS,
      })
    }

    // 7. Grant owner access
    const { error: accessError } = await supabase
      .from('user_property_access')
      .insert({ user_id: user.id, property_id: property.id, role: 'owner' })

    if (accessError) {
      console.error('[provision-property] insert access error:', accessError)
      return new Response(JSON.stringify({ error: 'Failed to grant property access' }), {
        status: 500, headers: CORS_HEADERS,
      })
    }

    // 8. Insert default settings
    const { error: settingsError } = await supabase
      .from('settings')
      .insert({ property_id: property.id })

    if (settingsError) {
      console.error('[provision-property] insert settings error:', settingsError)
      return new Response(JSON.stringify({ error: 'Failed to create default settings' }), {
        status: 500, headers: CORS_HEADERS,
      })
    }

    // 9. Return created property
    return new Response(JSON.stringify({ property }), {
      status: 201, headers: CORS_HEADERS,
    })
  } catch (err) {
    console.error('[provision-property]', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: CORS_HEADERS,
    })
  }
})
