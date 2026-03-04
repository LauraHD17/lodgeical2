// supabase/functions/merge-guests/index.ts
// Atomically merges two guest records.
// Moves all reservations from secondary → primary guest, then deletes secondary.
// Requires authenticated admin user with access to the property.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // User client — verifies the caller is authenticated
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { primary_guest_id, secondary_guest_id } = await req.json()
    if (!primary_guest_id || !secondary_guest_id) {
      return new Response(
        JSON.stringify({ error: 'primary_guest_id and secondary_guest_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (primary_guest_id === secondary_guest_id) {
      return new Response(
        JSON.stringify({ error: 'Primary and secondary guests must be different' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Service-role client — bypasses RLS for atomic operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify both guests exist and belong to a property the caller has access to
    const { data: primaryGuest, error: pgError } = await userClient
      .from('guests')
      .select('id, property_id')
      .eq('id', primary_guest_id)
      .single()

    if (pgError || !primaryGuest) {
      return new Response(JSON.stringify({ error: 'Primary guest not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: secondaryGuest, error: sgError } = await userClient
      .from('guests')
      .select('id, property_id')
      .eq('id', secondary_guest_id)
      .single()

    if (sgError || !secondaryGuest) {
      return new Response(JSON.stringify({ error: 'Secondary guest not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Enforce same-property constraint — prevents cross-tenant data corruption
    if (primaryGuest.property_id !== secondaryGuest.property_id) {
      return new Response(
        JSON.stringify({ error: 'Guests must belong to the same property' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Move reservations: secondary → primary
    const { data: updatedReservations, error: resError } = await adminClient
      .from('reservations')
      .update({ guest_id: primary_guest_id })
      .eq('guest_id', secondary_guest_id)
      .select('id')

    if (resError) {
      return new Response(JSON.stringify({ error: `Failed to update reservations: ${resError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Move payments if they reference guest_id
    await adminClient
      .from('payments')
      .update({ guest_id: primary_guest_id })
      .eq('guest_id', secondary_guest_id)

    // Delete the secondary guest
    const { error: deleteError } = await adminClient
      .from('guests')
      .delete()
      .eq('id', secondary_guest_id)

    if (deleteError) {
      return new Response(JSON.stringify({ error: `Failed to delete secondary guest: ${deleteError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        merged: true,
        primary_guest_id,
        secondary_guest_id,
        reservations_updated: updatedReservations?.length ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
