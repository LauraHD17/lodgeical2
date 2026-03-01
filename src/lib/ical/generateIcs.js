// src/lib/ical/generateIcs.js
// Pure client-side iCal (.ics) generation for previewing or downloading feeds.
// The canonical feed is served by the ical-export edge function; this module is
// used for unit-testing the generation logic and for any future client-side use.

/**
 * Escape special characters per RFC 5545 §3.3.11.
 * CR (\r) is stripped before any other processing to prevent iCal property
 * injection — a lone \r is interpreted as a line terminator by many parsers,
 * which would let user-supplied text (e.g. guest names or notes) inject
 * arbitrary iCal properties into the exported feed.
 * @param {string} str
 * @returns {string}
 */
export function icsEscape(str) {
  return String(str ?? '')
    .replace(/\r/g, '')     // strip CR first to prevent property injection
    .replace(/\\/g, '\\\\')
    .replace(/;/g,  '\\;')
    .replace(/,/g,  '\\,')
    .replace(/\n/g, '\\n')
}

/**
 * Convert 'YYYY-MM-DD' to 'YYYYMMDD'.
 * @param {string} dateStr
 * @returns {string|null}
 */
export function toIcsDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return null
  return dateStr.slice(0, 10).replace(/-/g, '')
}

/**
 * Convert an ISO timestamp to 'YYYYMMDDTHHmmssZ'.
 * @param {string} iso
 * @returns {string}
 */
export function toIcsDateTime(iso) {
  try {
    return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  } catch {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  }
}

/**
 * Generate a VCALENDAR string from an array of reservation objects.
 *
 * @param {string} calendarName  - Display name for the calendar feed
 * @param {Array<{
 *   id: string,
 *   check_in: string,
 *   check_out: string,
 *   confirmation_number: string,
 *   notes?: string|null,
 *   updated_at?: string,
 *   created_at?: string,
 *   guests?: { first_name: string, last_name: string }|null
 * }>} reservations
 * @returns {string}  Full iCal text with \r\n line endings (RFC 5545)
 */
export function generateIcs(calendarName, reservations) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lodge-ical//Lodge Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    'X-WR-TIMEZONE:UTC',
  ]

  for (const res of reservations ?? []) {
    const dtStart = toIcsDate(res.check_in)
    const dtEnd   = toIcsDate(res.check_out)
    if (!dtStart || !dtEnd) continue

    const guest   = res.guests
    const summary = guest
      ? `${guest.first_name} ${guest.last_name}`
      : 'Reserved'

    const dtstamp = toIcsDateTime(res.updated_at ?? res.created_at ?? new Date().toISOString())

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
  return lines.join('\r\n')
}
