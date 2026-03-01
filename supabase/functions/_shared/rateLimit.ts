// _shared/rateLimit.ts
// Per-IP sliding window rate limiter.
// Default: 30 requests per minute.

const store = new Map<string, number[]>()

export function rateLimit(
  req: Request,
  maxRequests = 30,
  windowMs = 60_000
): Response | null {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'

  const now = Date.now()
  const windowStart = now - windowMs

  // Get or create the request timestamp list for this IP
  const timestamps = (store.get(ip) ?? []).filter(t => t > windowStart)
  timestamps.push(now)
  store.set(ip, timestamps)

  if (timestamps.length > maxRequests) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please slow down.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return null
}
