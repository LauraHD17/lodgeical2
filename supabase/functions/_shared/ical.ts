// supabase/functions/_shared/ical.ts
// Shared iCal utilities used by ical-export and ical-import edge functions.

export interface IcsEvent {
  dtstart: string | null
  dtend:   string | null
  summary: string | null
  uid:     string | null
}

/**
 * Escape special characters per RFC 5545 §3.3.11.
 * CR (\r) is stripped first to prevent iCal property injection — a lone \r
 * is treated as a line terminator by many parsers, allowing user-supplied
 * strings (guest names, notes) to inject arbitrary iCal properties.
 */
export function icsEscape(str: string): string {
  return str
    .replace(/\r/g, '')     // strip CR to prevent property injection
    .replace(/\\/g, '\\\\')
    .replace(/;/g,  '\\;')
    .replace(/,/g,  '\\,')
    .replace(/\n/g, '\\n')
}

/** Convert 'YYYY-MM-DD' to 'YYYYMMDD' for iCal DATE values */
export function toIcsDate(dateStr: string): string | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return null
  return dateStr.slice(0, 10).replace(/-/g, '')
}

/** Convert ISO timestamp to 'YYYYMMDDTHHmmssZ' for iCal DATETIME values */
export function toIcsDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  } catch {
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  }
}

/**
 * Parse an iCal text into an array of events (minimal RFC 5545 subset).
 * Handles CRLF normalisation and line unfolding.
 */
export function parseIcs(icsText: string): IcsEvent[] {
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
export function parseDate(val: string | undefined): string | null {
  if (!val) return null
  // Strip time component and timezone suffix
  const datePart = val.split('T')[0].replace(/[^0-9]/g, '')
  if (datePart.length !== 8) return null
  return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`
}

/** FNV-1a 32-bit hash — fast, non-cryptographic, collision-resistant for string keys */
export function fnv1a32(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0  // unsigned 32-bit
  }
  return h.toString(16).padStart(8, '0').toUpperCase()
}

/**
 * Produce a stable, collision-resistant confirmation number from an iCal event.
 * Uses FNV-1a 32-bit hash of the full UID so two events that share a common
 * prefix still produce distinct keys.
 */
export function deriveConfirmationNumber(event: IcsEvent, roomId: string): string {
  if (event.uid) {
    return `EXT-${fnv1a32(event.uid)}`
  }
  // Fallback: hash of room + date range (still collision-resistant)
  const fallbackKey = `${roomId}|${event.dtstart}|${event.dtend}`
  return `EXT-${fnv1a32(fallbackKey)}`
}
