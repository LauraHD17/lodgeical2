// _shared/auth.ts
// Auth helpers for Edge Functions.
// requireAuth: validates JWT, returns user + propertyId.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface AuthResult {
  user: { id: string; email: string }
  propertyId: string
  error?: never
}
export interface AuthError {
  user?: never
  propertyId?: never
  error: string
}

/**
 * Validate the JWT from the Authorization header.
 * Returns user + propertyId from user_property_access.
 * propertyId comes from the DB — never trusted from client input.
 */
export async function requireAuth(req: Request): Promise<AuthResult | AuthError> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing Authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Verify the JWT by calling getUser (validates signature + expiry)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return { error: 'Invalid or expired token' }
  }

  // Fetch propertyId from DB — always server-side, never from client input
  const { data: access, error: accessError } = await supabase
    .from('user_property_access')
    .select('property_id')
    .eq('user_id', user.id)
    .single()

  if (accessError || !access) {
    return { error: 'No property access found for this user' }
  }

  return { user: { id: user.id, email: user.email! }, propertyId: access.property_id }
}
