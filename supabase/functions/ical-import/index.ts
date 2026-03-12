// ical-import Edge Function
// Fetches an external iCal feed (Airbnb, VRBO, Booking.com, etc.) and
// creates "blocked" reservations in Lodge-ical so those dates show as
// unavailable in the booking widget and admin calendar.
//
// POST /functions/v1/ical-import
// Body:
//   { room_id: UUID, feed_url?: string, label?: string }
//   - If feed_url is provided, it is saved to room_external_feeds then synced.
//   - If feed_url is omitted, the previously saved feed for the room is synced.
// Returns: { success: true, synced: number, skipped: number }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient }        from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAuth }         from '../_shared/auth.ts'
import { rateLimit }           from '../_shared/rateLimit.ts'
import { parseIcs, deriveConfirmationNumber } from '../_shared/ical.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Internal "blocked date" guest — created once per property on first sync.
const BLOCKED_GUEST_EMAIL = 'blocked@lodge-ical.internal'

/**
 * Validate that a user-supplied URL is safe to fetch.
 * - Must be HTTPS (prevents plain-text interception)
 * - Must not target private/link-local/loopback IP ranges (prevents SSRF)
 */
function isSafeExternalUrl(raw: string): boolean {
  let parsed: URL
  try { parsed = new URL(raw) } catch { return false }
  if (parsed.protocol !== 'https:') return false

  const h = parsed.hostname.toLowerCase()
  // Loopback and common internal hostnames
  if (h === 'localhost' || h === '0.0.0.0') return false
  // IPv4 private / reserved ranges
  if (/^127\./.test(h)) return false              // 127.0.0.0/8
  if (/^10\./.test(h)) return false               // 10.0.0.0/8
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false  // 172.16-31.x.x
  if (/^192\.168\./.test(h)) return false          // 192.168.0.0/16
  if (/^169\.254\./.test(h)) return false          // 169.254.0.0/16 link-local
  // IPv6 loopback and ULA
  if (h === '::1' || h === '[::1]') return false
  if (/^\[?fe80:/i.test(h)) return false           // link-local
  if (/^\[?fc00:/i.test(h) || /^\[?fd/i.test(h)) return false  // ULA
  return true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  // 1. Authenticate — must be a logged-in admin
  const authResult = await requireAuth(req)
  if (authResult.error) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: CORS_HEADERS,
    })
  }
  const { propertyId } = authResult

  // Rate limit (property-scoped)
  const rateLimitError = await rateLimit(req, 30, 60_000, propertyId)
  if (rateLimitError) return rateLimitError

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 2. Parse request body
  let body: { room_id?: string; feed_url?: string; label?: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: CORS_HEADERS,
    })
  }

  const { room_id, feed_url, label } = body
  if (!room_id) {
    return new Response(JSON.stringify({ error: 'room_id is required' }), {
      status: 400,
      headers: CORS_HEADERS,
    })
  }

  // 3. Verify room belongs to this property
  const { data: room } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('id', room_id)
    .eq('property_id', propertyId)
    .single()

  if (!room) {
    return new Response(JSON.stringify({ error: 'Room not found' }), {
      status: 404,
      headers: CORS_HEADERS,
    })
  }

  // 4. Resolve the iCal URL to sync
  let targetUrl: string

  if (feed_url) {
    // Validate URL before saving or fetching (SSRF prevention)
    if (!isSafeExternalUrl(feed_url)) {
      return new Response(
        JSON.stringify({ error: 'feed_url must be an HTTPS URL pointing to a public host' }),
        { status: 400, headers: CORS_HEADERS },
      )
    }

    // Save (upsert) the feed record then sync
    await supabase
      .from('room_external_feeds')
      .upsert(
        {
          room_id,
          property_id: propertyId,
          label: label ?? 'External Calendar',
          feed_url,
        },
        { onConflict: 'room_id' },
      )
    targetUrl = feed_url
  } else {
    // Use previously saved feed
    const { data: savedFeed } = await supabase
      .from('room_external_feeds')
      .select('feed_url')
      .eq('room_id', room_id)
      .single()

    if (!savedFeed) {
      return new Response(JSON.stringify({ error: 'No external feed configured for this room' }), {
        status: 400,
        headers: CORS_HEADERS,
      })
    }
    targetUrl = savedFeed.feed_url
  }

  // 5. Fetch the .ics file (15s timeout, 5MB size limit)
  const MAX_ICS_BYTES = 5 * 1024 * 1024 // 5 MB
  let icsText: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    let resp: Response
    try {
      resp = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Lodge-ical/1.0 (+https://lodge-ical.com)' },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const contentLength = parseInt(resp.headers.get('content-length') ?? '0', 10)
    if (contentLength > MAX_ICS_BYTES) throw new Error('Feed exceeds 5 MB size limit')
    icsText = await resp.text()
    if (icsText.length > MAX_ICS_BYTES) throw new Error('Feed exceeds 5 MB size limit')
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Failed to fetch feed: ${(err as Error).message}` }),
      { status: 502, headers: CORS_HEADERS },
    )
  }

  // 6. Parse VEVENT blocks
  const events = parseIcs(icsText)

  // 7. Ensure a "blocked" system guest exists for this property
  const { data: systemGuest } = await supabase
    .from('guests')
    .upsert(
      {
        property_id: propertyId,
        email: BLOCKED_GUEST_EMAIL,
        first_name: 'Blocked',
        last_name: 'Date',
        phone: null,
      },
      { onConflict: 'property_id,email' },
    )
    .select('id')
    .single()

  if (!systemGuest) {
    return new Response(JSON.stringify({ error: 'Failed to resolve system guest' }), {
      status: 500,
      headers: CORS_HEADERS,
    })
  }

  // 8. Load existing blocked confirmations so we can skip duplicates
  const { data: existing } = await supabase
    .from('reservations')
    .select('confirmation_number')
    .eq('property_id', propertyId)
    .eq('origin', 'import')
    .contains('room_ids', [room_id])

  const existingSet = new Set((existing ?? []).map(r => r.confirmation_number))

  // 9. Insert new blocked dates — build the full batch first, then insert in one call.
  let skipped = 0
  const toInsert: Record<string, unknown>[] = []

  for (const event of events) {
    if (!event.dtstart || !event.dtend) { skipped++; continue }

    const confirmationNumber = deriveConfirmationNumber(event, room_id)
    if (existingSet.has(confirmationNumber)) { skipped++; continue }

    toInsert.push({
      property_id: propertyId,
      guest_id: systemGuest.id,
      room_ids: [room_id],
      check_in: event.dtstart,
      check_out: event.dtend,
      num_guests: 1,
      status: 'confirmed',
      origin: 'import',
      total_due_cents: 0,
      is_tax_exempt: true,
      confirmation_number: confirmationNumber,
      notes: event.summary ? `External block: ${event.summary}` : 'Blocked from external calendar',
    })
  }

  let synced = 0
  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from('reservations').insert(toInsert)
    if (insertErr) {
      if (insertErr.code === '23505') {
        // Partial duplicate — fall back to individual inserts so valid rows still land.
        for (const row of toInsert) {
          const { error: rowErr } = await supabase.from('reservations').insert(row)
          if (!rowErr) { synced++ }
          else if (rowErr.code !== '23505') {
            console.error('[ical-import] Unexpected insert error:', rowErr.code, rowErr.message)
            skipped++
          } else {
            skipped++
          }
        }
      } else {
        console.error('[ical-import] Batch insert error:', insertErr.code, insertErr.message)
        skipped += toInsert.length
      }
    } else {
      synced = toInsert.length
    }
  }

  // 10. Update last_synced_at
  await supabase
    .from('room_external_feeds')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('room_id', room_id)

  return new Response(JSON.stringify({ success: true, synced, skipped }), {
    headers: CORS_HEADERS,
  })
})

