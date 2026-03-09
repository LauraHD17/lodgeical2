// ical-export Edge Function
// Serves a standards-compliant iCal (.ics) feed for a single room.
// Authentication is via the room's ical_token query param — no JWT needed.
// This lets external calendar apps (Google Calendar, Apple Calendar, etc.)
// subscribe directly without user credentials.
//
// GET /functions/v1/ical-export?token=<ical_token>
// Returns: text/calendar

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { icsEscape, toIcsDate, toIcsDateTime } from '../_shared/ical.ts'

const ICAL_CONTENT_TYPE = 'text/calendar; charset=utf-8'

serve(async (req) => {
  // Allow CORS preflight (calendar apps sometimes send OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    })
  }

  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token || !/^[0-9a-f-]{36}$/.test(token)) {
    return new Response('Missing or invalid token', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Look up room by token (include buffer days)
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id, name, property_id, buffer_days_before, buffer_days_after')
    .eq('ical_token', token)
    .single()

  if (roomErr || !room) {
    return new Response('Not found', { status: 404 })
  }

  // Fetch all non-cancelled reservations that include this room
  const { data: reservations } = await supabase
    .from('reservations')
    .select(`
      id,
      check_in,
      check_out,
      confirmation_number,
      notes,
      status,
      created_at,
      updated_at,
      guests ( first_name, last_name )
    `)
    .eq('property_id', room.property_id)
    .neq('status', 'cancelled')
    .contains('room_ids', [room.id])
    .order('check_in', { ascending: true })

  const icsLines = buildIcs(room.name, reservations ?? [], room.buffer_days_before ?? 0, room.buffer_days_after ?? 0)

  return new Response(icsLines.join('\r\n'), {
    headers: {
      'Content-Type': ICAL_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(room.name)}.ics"`,
      'Cache-Control': 'no-cache, no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
})

// ---------------------------------------------------------------------------
// iCal generation
// ---------------------------------------------------------------------------

/** Shift a YYYY-MM-DD string by N days */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function buildIcs(
  roomName: string,
  reservations: Array<{
    id: string
    check_in: string
    check_out: string
    confirmation_number: string
    notes: string | null
    created_at: string
    updated_at: string
    guests: { first_name: string; last_name: string } | null
  }>,
  bufferBefore: number,
  bufferAfter: number,
): string[] {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lodge-ical//Lodge Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(roomName)}`,
    'X-WR-TIMEZONE:UTC',
  ]

  for (const res of reservations) {
    // Extend date range by buffer days so external calendars block the full period
    const effectiveCheckIn = bufferBefore > 0 ? shiftDate(res.check_in, -bufferBefore) : res.check_in
    const effectiveCheckOut = bufferAfter > 0 ? shiftDate(res.check_out, bufferAfter) : res.check_out
    const dtStart = toIcsDate(effectiveCheckIn)
    const dtEnd   = toIcsDate(effectiveCheckOut)
    if (!dtStart || !dtEnd) continue

    const guest   = res.guests
    const summary = guest
      ? `${guest.first_name} ${guest.last_name}`
      : 'Reserved'

    // RFC 5545 DTSTAMP (when the event was last modified, UTC)
    const dtstamp = toIcsDateTime(res.updated_at ?? res.created_at)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${res.id}@lodge-ical`)
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`)
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`)
    lines.push(`SUMMARY:${icsEscape(summary)}`)
    lines.push(`DESCRIPTION:Confirmation: ${icsEscape(res.confirmation_number)}`)
    if (res.notes) {
      lines.push(`COMMENT:${icsEscape(res.notes)}`)
    }
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines
}

