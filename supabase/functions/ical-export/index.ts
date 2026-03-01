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

  // Look up room by token
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .select('id, name, property_id')
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

  const icsLines = buildIcs(room.name, reservations ?? [])

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
    const dtStart = toIcsDate(res.check_in)
    const dtEnd   = toIcsDate(res.check_out)
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

/** Convert 'YYYY-MM-DD' to 'YYYYMMDD' for iCal DATE values */
function toIcsDate(dateStr: string): string | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return null
  return dateStr.slice(0, 10).replace(/-/g, '')
}

/** Convert ISO timestamp to 'YYYYMMDDTHHmmssZ' for iCal DATETIME values */
function toIcsDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  } catch {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  }
}

/**
 * Escape special characters per RFC 5545 §3.3.11.
 * CR (\r) is stripped first to prevent iCal property injection — a lone \r
 * is treated as a line terminator by many parsers, allowing user-supplied
 * strings (guest names, notes) to inject arbitrary iCal properties.
 */
function icsEscape(str: string): string {
  return str
    .replace(/\r/g, '')     // strip CR to prevent property injection
    .replace(/\\/g, '\\\\')
    .replace(/;/g,  '\\;')
    .replace(/,/g,  '\\,')
    .replace(/\n/g, '\\n')
}
