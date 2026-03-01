// src/lib/ical/parseIcs.js
// Minimal RFC-5545 iCal parser.
// Extracts VEVENT blocks and returns the fields relevant for blocking dates.
// Used by the ical-import edge function (TypeScript copy lives there);
// this JS version is used for client-side preview and unit tests.

/**
 * Parse an iCal (.ics) text into an array of event objects.
 *
 * @param {string} icsText
 * @returns {Array<{
 *   dtstart: string|null,
 *   dtend:   string|null,
 *   summary: string|null,
 *   uid:     string|null
 * }>}
 */
export function parseIcs(icsText) {
  if (!icsText) return []

  // Normalise line endings, then unfold continuation lines (RFC 5545 §3.1)
  const unfolded = icsText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n[ \t]/g, '')  // fold: CRLF + space/tab → remove both

  const lines  = unfolded.split('\n')
  const events = []

  let inEvent = false
  let current = {}

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

    // Strip property parameters: "DTSTART;VALUE=DATE" → key "DTSTART"
    const key   = line.slice(0, colonIdx).split(';')[0].toUpperCase()
    const value = line.slice(colonIdx + 1)

    current[key] = value
  }

  return events
}

/**
 * Convert an iCal date or datetime value to 'YYYY-MM-DD'.
 * Handles:
 *   20260601          (DATE)
 *   20260601T150000Z  (DATETIME UTC)
 *   20260601T150000   (DATETIME local)
 *
 * @param {string|undefined} val
 * @returns {string|null}
 */
export function parseDate(val) {
  if (!val) return null
  const datePart = val.split('T')[0].replace(/[^0-9]/g, '')
  if (datePart.length !== 8) return null
  return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`
}
