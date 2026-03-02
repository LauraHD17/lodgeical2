// _shared/rateLimit.ts
// DB-backed sliding-window rate limiter.
// Replaces the previous in-memory Map implementation which was non-functional
// across concurrent Edge Function isolates (each isolate had its own Map).
//
// Uses an atomic INSERT ... ON CONFLICT DO UPDATE on the rate_limits table
// so counts are accurate across all running instances.
//
// Default: 30 requests per minute per IP.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function rateLimit(
  req: Request,
  maxRequests = 30,
  windowMs = 60_000
): Promise<Response | null> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  // Round down to the start of the current window
  const now = Date.now()
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs).toISOString()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Atomically increment the counter for this (ip, window) pair.
  // The UNIQUE PRIMARY KEY (key, window_start) ensures no double-counting.
  const { data, error } = await supabase.rpc('increment_rate_limit', {
    p_key: ip,
    p_window_start: windowStart,
  })

  if (error) {
    // If rate limiting is broken (e.g. migration not run), fail open rather
    // than blocking all traffic. Log for ops visibility.
    console.error('[rateLimit] DB error — failing open:', error.message)
    return null
  }

  const count: number = data ?? 1

  if (count > maxRequests) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please slow down.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return null
}
