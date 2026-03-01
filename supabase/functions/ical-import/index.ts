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
import { createClient }   from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAuth }    from '../_shared/auth.ts'

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

// Internal "blocked date" guest — created once per property on first sync.
const BLOCKED_GUEST_EMAIL = 'blocked@lodge-ical.internal'

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

  // 5. Fetch the .ics file
  let icsText: string
  try {
    const resp = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Lodge-ical/1.0 (+https://lodge-ical.com)' },
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    icsText = await resp.text()
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

  // 9. Insert new blocked dates
  let synced = 0
  let skipped = 0

  for (const event of events) {
    if (!event.dtstart || !event.dtend) { skipped++; continue }

    // Derive a stable confirmation number from the UID (or date range)
    const confirmationNumber = deriveConfirmationNumber(event, room_id)

    if (existingSet.has(confirmationNumber)) { skipped++; continue }

    const { error: insertErr } = await supabase.from('reservations').insert({
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

    if (insertErr) {
      // Conflict (duplicate confirmation_number race) — skip silently
      skipped++
    } else {
      synced++
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

// ---------------------------------------------------------------------------
// iCal parser (minimal — handles DTSTART/DTEND/SUMMARY/UID per RFC 5545)
// ---------------------------------------------------------------------------

interface IcsEvent {
  dtstart: string | null
  dtend:   string | null
  summary: string | null
  uid:     string | null
}

function parseIcs(icsText: string): IcsEvent[] {
  const events: IcsEvent[] = []

  // Normalise line endings and unfold continuation lines (RFC 5545 §3.1)
  const unfolded = icsText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '')   // unfold: remove CRLF + whitespace continuations

  const lines = unfolded.split('\n')

  let inEvent = false
  let current: Record<string, string> = {}

  for (const raw of lines) {
    const line = raw.trim()

    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      current = {}
      continue
    }

    if (line === 'END:VEVENT') {
      inEvent = false
      events.push({
        dtstart: parseDate(current['DTSTART']),
        dtend:   parseDate(current['DTEND']),
        summary: current['SUMMARY'] ?? null,
        uid:     current['UID'] ?? null,
      })
      continue
    }

    if (!inEvent) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx < 1) continue

    // Strip parameters (e.g. "DTSTART;VALUE=DATE" → key "DTSTART")
    const rawKey  = line.slice(0, colonIdx)
    const key     = rawKey.split(';')[0].toUpperCase()
    const value   = line.slice(colonIdx + 1)

    // Last-write wins for duplicate keys (safe for our use-case)
    current[key] = value
  }

  return events
}

/** Convert iCal date/datetime value to 'YYYY-MM-DD' */
function parseDate(val: string | undefined): string | null {
  if (!val) return null
  // Strip time component and timezone suffix
  const datePart = val.split('T')[0].replace(/[^0-9]/g, '')
  if (datePart.length !== 8) return null
  return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`
}

/** Produce a stable, short confirmation number from an iCal event */
function deriveConfirmationNumber(event: IcsEvent, roomId: string): string {
  if (event.uid) {
    // Use the first 20 chars of the UID (guaranteed unique per source)
    return `EXT-${event.uid.slice(0, 20).replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`
  }
  // Fallback: date range + room prefix
  const room = roomId.slice(0, 6).toUpperCase()
  return `EXT-${room}-${event.dtstart?.replace(/-/g, '')}-${event.dtend?.replace(/-/g, '')}`
}
