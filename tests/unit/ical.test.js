// tests/unit/ical.test.js
// Unit tests for src/lib/ical/generateIcs.js and src/lib/ical/parseIcs.js

import { describe, it, expect } from 'vitest'
import {
  icsEscape,
  toIcsDate,
  toIcsDateTime,
  generateIcs,
} from '../../src/lib/ical/generateIcs.js'
import { parseIcs, parseDate } from '../../src/lib/ical/parseIcs.js'

// ---------------------------------------------------------------------------
// icsEscape
// ---------------------------------------------------------------------------
describe('icsEscape', () => {
  it('strips carriage return to prevent iCal property injection', () => {
    // A lone \r is treated as a line terminator by many iCal parsers;
    // allowing it through would let a guest name like "Alice\rDTSTART:20200101"
    // inject arbitrary properties into the feed.
    expect(icsEscape('Alice\rSmith')).toBe('AliceSmith')
    expect(icsEscape('note\rDTSTART:20200101')).toBe('noteDTSTART:20200101')
    expect(icsEscape('\r')).toBe('')
  })

  it('escapes backslash', () => {
    expect(icsEscape('a\\b')).toBe('a\\\\b')
  })

  it('escapes semicolon', () => {
    expect(icsEscape('a;b')).toBe('a\\;b')
  })

  it('escapes comma', () => {
    expect(icsEscape('a,b')).toBe('a\\,b')
  })

  it('escapes newline', () => {
    expect(icsEscape('a\nb')).toBe('a\\nb')
  })

  it('returns empty string for empty input', () => {
    expect(icsEscape('')).toBe('')
  })

  it('handles null/undefined gracefully', () => {
    expect(icsEscape(null)).toBe('')
    expect(icsEscape(undefined)).toBe('')
  })

  it('does not modify plain text', () => {
    expect(icsEscape('Hello World')).toBe('Hello World')
  })
})

// ---------------------------------------------------------------------------
// toIcsDate
// ---------------------------------------------------------------------------
describe('toIcsDate', () => {
  it('converts YYYY-MM-DD to YYYYMMDD', () => {
    expect(toIcsDate('2026-06-01')).toBe('20260601')
  })

  it('returns null for null input', () => {
    expect(toIcsDate(null)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(toIcsDate('')).toBeNull()
  })

  it('returns null for invalid format', () => {
    expect(toIcsDate('01/06/2026')).toBeNull()
  })

  it('ignores time component', () => {
    expect(toIcsDate('2026-06-01T15:00:00Z')).toBe('20260601')
  })
})

// ---------------------------------------------------------------------------
// toIcsDateTime
// ---------------------------------------------------------------------------
describe('toIcsDateTime', () => {
  it('produces a valid UTC datetime stamp', () => {
    const result = toIcsDateTime('2026-06-01T12:00:00.000Z')
    expect(result).toBe('20260601T120000Z')
  })

  it('returns a fallback for invalid ISO strings', () => {
    const result = toIcsDateTime('not-a-date')
    // Should still return a string (fallback to now)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^\d{8}T\d{6}Z$/)
  })
})

// ---------------------------------------------------------------------------
// generateIcs
// ---------------------------------------------------------------------------
describe('generateIcs', () => {
  const sampleReservation = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    check_in: '2026-06-01',
    check_out: '2026-06-05',
    confirmation_number: 'ABC123',
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    guests: { first_name: 'Alice', last_name: 'Smith' },
  }

  it('returns a string starting with BEGIN:VCALENDAR', () => {
    const ics = generateIcs('Cabin A', [sampleReservation])
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
  })

  it('ends with END:VCALENDAR', () => {
    const ics = generateIcs('Cabin A', [sampleReservation])
    expect(ics.endsWith('END:VCALENDAR')).toBe(true)
  })

  it('includes VEVENT for each reservation', () => {
    const ics = generateIcs('Cabin A', [sampleReservation])
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VEVENT')
  })

  it('sets DTSTART and DTEND as DATE values', () => {
    const ics = generateIcs('Cabin A', [sampleReservation])
    expect(ics).toContain('DTSTART;VALUE=DATE:20260601')
    expect(ics).toContain('DTEND;VALUE=DATE:20260605')
  })

  it('sets SUMMARY to guest name', () => {
    const ics = generateIcs('Cabin A', [sampleReservation])
    expect(ics).toContain('SUMMARY:Alice Smith')
  })

  it('uses "Reserved" as SUMMARY when no guest provided', () => {
    const ics = generateIcs('Cabin A', [{ ...sampleReservation, guests: null }])
    expect(ics).toContain('SUMMARY:Reserved')
  })

  it('includes confirmation number in DESCRIPTION', () => {
    const ics = generateIcs('Cabin A', [sampleReservation])
    expect(ics).toContain('ABC123')
  })

  it('skips reservations with invalid dates', () => {
    const bad = { ...sampleReservation, check_in: 'bad', check_out: 'also-bad' }
    const ics = generateIcs('Cabin A', [bad])
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('handles empty reservations array', () => {
    const ics = generateIcs('Cabin A', [])
    expect(ics).not.toContain('BEGIN:VEVENT')
    expect(ics).toContain('BEGIN:VCALENDAR')
  })

  it('uses \\r\\n line endings (RFC 5545)', () => {
    const ics = generateIcs('Cabin A', [sampleReservation])
    expect(ics).toContain('\r\n')
  })

  it('includes calendar name in X-WR-CALNAME', () => {
    const ics = generateIcs('My Cabin', [])
    expect(ics).toContain('X-WR-CALNAME:My Cabin')
  })

  it('escapes special characters in calendar name', () => {
    const ics = generateIcs('Cabin; One', [])
    expect(ics).toContain('X-WR-CALNAME:Cabin\\; One')
  })

  it('includes COMMENT when notes are present', () => {
    const withNotes = { ...sampleReservation, notes: 'Quiet room please' }
    const ics = generateIcs('Cabin A', [withNotes])
    expect(ics).toContain('COMMENT:Quiet room please')
  })
})

// ---------------------------------------------------------------------------
// parseDate
// ---------------------------------------------------------------------------
describe('parseDate', () => {
  it('converts YYYYMMDD to YYYY-MM-DD', () => {
    expect(parseDate('20260601')).toBe('2026-06-01')
  })

  it('strips time component from datetime', () => {
    expect(parseDate('20260601T150000Z')).toBe('2026-06-01')
  })

  it('returns null for undefined', () => {
    expect(parseDate(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseDate('')).toBeNull()
  })

  it('returns null for short date strings', () => {
    expect(parseDate('2026')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// parseIcs
// ---------------------------------------------------------------------------
describe('parseIcs', () => {
  const sampleIcs = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Test//EN',
    'BEGIN:VEVENT',
    'UID:test-event-001@example.com',
    'DTSTART;VALUE=DATE:20260601',
    'DTEND;VALUE=DATE:20260605',
    'SUMMARY:Alice Smith',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  it('returns an array of events', () => {
    const events = parseIcs(sampleIcs)
    expect(Array.isArray(events)).toBe(true)
    expect(events).toHaveLength(1)
  })

  it('parses DTSTART correctly', () => {
    const [ev] = parseIcs(sampleIcs)
    expect(ev.dtstart).toBe('2026-06-01')
  })

  it('parses DTEND correctly', () => {
    const [ev] = parseIcs(sampleIcs)
    expect(ev.dtend).toBe('2026-06-05')
  })

  it('parses SUMMARY', () => {
    const [ev] = parseIcs(sampleIcs)
    expect(ev.summary).toBe('Alice Smith')
  })

  it('parses UID', () => {
    const [ev] = parseIcs(sampleIcs)
    expect(ev.uid).toBe('test-event-001@example.com')
  })

  it('handles CRLF line endings', () => {
    const events = parseIcs(sampleIcs)
    expect(events).toHaveLength(1)
  })

  it('handles LF-only line endings', () => {
    const lfIcs = sampleIcs.replace(/\r\n/g, '\n')
    const events = parseIcs(lfIcs)
    expect(events).toHaveLength(1)
  })

  it('handles datetime DTSTART (with T and Z)', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20260601T150000Z',
      'DTEND:20260605T110000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n')
    const [ev] = parseIcs(ics)
    expect(ev.dtstart).toBe('2026-06-01')
    expect(ev.dtend).toBe('2026-06-05')
  })

  it('parses multiple events', () => {
    const multiIcs = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260601',
      'DTEND;VALUE=DATE:20260605',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260701',
      'DTEND;VALUE=DATE:20260703',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n')
    const events = parseIcs(multiIcs)
    expect(events).toHaveLength(2)
    expect(events[0].dtstart).toBe('2026-06-01')
    expect(events[1].dtstart).toBe('2026-07-01')
  })

  it('returns empty array for empty string', () => {
    expect(parseIcs('')).toEqual([])
  })

  it('returns empty array for null/undefined', () => {
    expect(parseIcs(null)).toEqual([])
    expect(parseIcs(undefined)).toEqual([])
  })

  it('returns empty array when no VEVENT blocks present', () => {
    const noEvents = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR'
    expect(parseIcs(noEvents)).toEqual([])
  })

  it('unfolds continuation lines (RFC 5545 §3.1)', () => {
    // Long lines are folded at 75 chars with CRLF + space continuation
    const foldedIcs = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260601',
      'DTEND;VALUE=DATE:20260605',
      'SUMMARY:This is a very long summar',
      ' y that was folded',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const [ev] = parseIcs(foldedIcs)
    expect(ev.summary).toBe('This is a very long summary that was folded')
  })

  it('handles DTSTART with VALUE=DATE parameter', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260615',
      'DTEND;VALUE=DATE:20260620',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n')
    const [ev] = parseIcs(ics)
    expect(ev.dtstart).toBe('2026-06-15')
  })
})

// ---------------------------------------------------------------------------
// Round-trip: generate then parse
// ---------------------------------------------------------------------------
describe('generateIcs → parseIcs round-trip', () => {
  it('parse recovers the same date range from generated iCal', () => {
    const reservation = {
      id: 'aabbccdd-0000-0000-0000-000000000001',
      check_in: '2026-09-10',
      check_out: '2026-09-14',
      confirmation_number: 'ROUND1',
      notes: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      guests: { first_name: 'Bob', last_name: 'Jones' },
    }

    const ics = generateIcs('Suite 1', [reservation])
    const events = parseIcs(ics)

    expect(events).toHaveLength(1)
    expect(events[0].dtstart).toBe('2026-09-10')
    expect(events[0].dtend).toBe('2026-09-14')
    expect(events[0].summary).toBe('Bob Jones')
  })
})
