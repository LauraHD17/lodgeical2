// tests/unit/csvImport.test.js
// Unit tests for the CSV parsing logic used by the Import page.

import { describe, it, expect } from 'vitest'
import { parseCsvToRows } from '../../src/lib/csv/parseRfc4180.js'

// ---------------------------------------------------------------------------
// Tests — basic parsing
// ---------------------------------------------------------------------------

const SAMPLE_CSV = [
  'confirmation_number,check_in,check_out,num_guests,guest_first_name,guest_last_name,guest_email,guest_phone,room_name,total_due_cents,status,notes',
  'RES-001,2026-06-01,2026-06-05,2,John,Doe,john@example.com,+1 555 0100,Cabin A,59600,confirmed,Anniversary trip',
  'RES-002,2026-07-10,2026-07-14,1,Jane,Smith,jane@example.com,,Suite B,45000,confirmed,',
].join('\n')

describe('parseCsvToRows', () => {
  it('returns correct headers from first row', () => {
    const { headers } = parseCsvToRows(SAMPLE_CSV)
    expect(headers).toEqual([
      'confirmation_number', 'check_in', 'check_out', 'num_guests',
      'guest_first_name', 'guest_last_name', 'guest_email', 'guest_phone',
      'room_name', 'total_due_cents', 'status', 'notes',
    ])
  })

  it('returns correct row count', () => {
    const { rows } = parseCsvToRows(SAMPLE_CSV)
    expect(rows).toHaveLength(2)
  })

  it('parses first row correctly', () => {
    const { rows } = parseCsvToRows(SAMPLE_CSV)
    expect(rows[0].confirmation_number).toBe('RES-001')
    expect(rows[0].check_in).toBe('2026-06-01')
    expect(rows[0].check_out).toBe('2026-06-05')
    expect(rows[0].num_guests).toBe('2')
    expect(rows[0].guest_email).toBe('john@example.com')
    expect(rows[0].room_name).toBe('Cabin A')
    expect(rows[0].total_due_cents).toBe('59600')
    expect(rows[0].status).toBe('confirmed')
    expect(rows[0].notes).toBe('Anniversary trip')
  })

  it('handles empty cells as empty strings', () => {
    const { rows } = parseCsvToRows(SAMPLE_CSV)
    expect(rows[1].guest_phone).toBe('')
    expect(rows[1].notes).toBe('')
  })

  it('returns empty headers and rows for header-only CSV', () => {
    const headerOnly = 'confirmation_number,check_in,check_out'
    const { headers, rows } = parseCsvToRows(headerOnly)
    expect(headers).toEqual([])
    expect(rows).toEqual([])
  })

  it('returns empty headers and rows for empty string', () => {
    const { headers, rows } = parseCsvToRows('')
    expect(headers).toEqual([])
    expect(rows).toEqual([])
  })

  it('returns empty headers and rows for null/undefined', () => {
    expect(parseCsvToRows(null)).toEqual({ headers: [], rows: [] })
    expect(parseCsvToRows(undefined)).toEqual({ headers: [], rows: [] })
  })

  it('trims whitespace from headers', () => {
    const csv = ' name , email \nAlice,alice@example.com'
    const { headers } = parseCsvToRows(csv)
    expect(headers).toEqual(['name', 'email'])
  })

  it('trims whitespace from unquoted cell values', () => {
    const csv = 'name,email\n Alice , alice@example.com '
    const { rows } = parseCsvToRows(csv)
    expect(rows[0].name).toBe('Alice')
    expect(rows[0].email).toBe('alice@example.com')
  })

  it('strips surrounding quotes from values', () => {
    const csv = 'name,email\n"Alice","alice@example.com"'
    const { rows } = parseCsvToRows(csv)
    expect(rows[0].name).toBe('Alice')
    expect(rows[0].email).toBe('alice@example.com')
  })

  it('handles CRLF line endings', () => {
    const csv = 'name,email\r\nAlice,alice@example.com\r\nBob,bob@example.com'
    const { rows } = parseCsvToRows(csv)
    expect(rows).toHaveLength(2)
  })

  it('ignores blank lines', () => {
    const csv = 'name,email\n\nAlice,alice@example.com\n\nBob,bob@example.com\n'
    const { rows } = parseCsvToRows(csv)
    expect(rows).toHaveLength(2)
  })

  it('handles single data row', () => {
    const csv = 'a,b,c\n1,2,3'
    const { rows } = parseCsvToRows(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '3' })
  })
})

// ---------------------------------------------------------------------------
// RFC 4180 quoted-field handling
// ---------------------------------------------------------------------------

describe('parseCsvToRows — RFC 4180 quoted fields', () => {
  it('preserves comma inside a quoted field', () => {
    const csv = 'name,notes\nAlice,"Loves hiking, camping"'
    const { rows } = parseCsvToRows(csv)
    expect(rows[0].notes).toBe('Loves hiking, camping')
  })

  it('handles multiple commas inside a quoted field', () => {
    const csv = 'id,text\n1,"one, two, three"'
    const { rows } = parseCsvToRows(csv)
    expect(rows[0].text).toBe('one, two, three')
  })

  it('handles escaped double-quote inside a quoted field (RFC 4180 §2.7)', () => {
    const csv = 'name,quote\nAlice,"She said ""hello"""'
    const { rows } = parseCsvToRows(csv)
    expect(rows[0].quote).toBe('She said "hello"')
  })

  it('parses a row where all fields are quoted', () => {
    const csv = '"a","b","c"\n"1","2","3"'
    const { rows } = parseCsvToRows(csv)
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '3' })
  })

  it('correctly handles notes field containing a comma (realistic import row)', () => {
    const csv = [
      'confirmation_number,check_in,check_out,num_guests,guest_first_name,guest_last_name,guest_email,guest_phone,room_name,total_due_cents,status,notes',
      'RES-001,2026-06-01,2026-06-05,2,John,Doe,john@example.com,+1 555 0100,Cabin A,59600,confirmed,"Late check-in, please leave key"',
    ].join('\n')
    const { rows } = parseCsvToRows(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].notes).toBe('Late check-in, please leave key')
    expect(rows[0].confirmation_number).toBe('RES-001')
  })

  it('naive split would break comma-in-notes but RFC 4180 does not', () => {
    // This test documents the bug that was fixed: with split(','), the comma
    // inside the quoted notes field would cause the columns to shift, producing
    // 13 cells instead of 12 and the wrong values.
    const csv = [
      'a,b,c',
      '1,2,"three, point five"',
    ].join('\n')
    const { rows } = parseCsvToRows(csv)
    expect(rows[0].a).toBe('1')
    expect(rows[0].b).toBe('2')
    expect(rows[0].c).toBe('three, point five')
  })
})

// ---------------------------------------------------------------------------
// CSV row validation helpers (mirrors edge function logic)
// ---------------------------------------------------------------------------

function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str))
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)
}

function validateRow(row) {
  const errors = []
  if (!row.confirmation_number?.trim()) errors.push('confirmation_number required')
  if (!isValidDate(row.check_in))       errors.push('check_in must be YYYY-MM-DD')
  if (!isValidDate(row.check_out))      errors.push('check_out must be YYYY-MM-DD')
  if (row.check_in >= row.check_out)    errors.push('check_out must be after check_in')
  if (!isValidEmail(row.guest_email))   errors.push('invalid guest_email')
  if (!row.room_name?.trim())           errors.push('room_name required')
  const cents = Number(row.total_due_cents)
  if (isNaN(cents) || cents < 0)        errors.push('total_due_cents must be a non-negative number')
  return errors
}

describe('validateRow', () => {
  const validRow = {
    confirmation_number: 'RES-001',
    check_in: '2026-06-01',
    check_out: '2026-06-05',
    num_guests: '2',
    guest_first_name: 'John',
    guest_last_name: 'Doe',
    guest_email: 'john@example.com',
    guest_phone: '+1 555 0100',
    room_name: 'Cabin A',
    total_due_cents: '59600',
    status: 'confirmed',
    notes: '',
  }

  it('returns no errors for a valid row', () => {
    expect(validateRow(validRow)).toEqual([])
  })

  it('flags missing confirmation_number', () => {
    const errs = validateRow({ ...validRow, confirmation_number: '' })
    expect(errs).toContain('confirmation_number required')
  })

  it('flags invalid check_in date format', () => {
    const errs = validateRow({ ...validRow, check_in: '01/06/2026' })
    expect(errs).toContain('check_in must be YYYY-MM-DD')
  })

  it('flags check_out before check_in', () => {
    const errs = validateRow({ ...validRow, check_in: '2026-06-05', check_out: '2026-06-01' })
    expect(errs).toContain('check_out must be after check_in')
  })

  it('flags same check_in and check_out', () => {
    const errs = validateRow({ ...validRow, check_in: '2026-06-01', check_out: '2026-06-01' })
    expect(errs).toContain('check_out must be after check_in')
  })

  it('flags invalid email', () => {
    const errs = validateRow({ ...validRow, guest_email: 'not-an-email' })
    expect(errs).toContain('invalid guest_email')
  })

  it('flags missing room_name', () => {
    const errs = validateRow({ ...validRow, room_name: '' })
    expect(errs).toContain('room_name required')
  })

  it('flags negative total_due_cents', () => {
    const errs = validateRow({ ...validRow, total_due_cents: '-100' })
    expect(errs).toContain('total_due_cents must be a non-negative number')
  })

  it('allows zero total_due_cents', () => {
    const errs = validateRow({ ...validRow, total_due_cents: '0' })
    expect(errs).not.toContain('total_due_cents must be a non-negative number')
  })
})
