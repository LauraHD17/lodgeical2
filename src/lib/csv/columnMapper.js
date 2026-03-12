// src/lib/csv/columnMapper.js
// Helpers for mapping arbitrary CSV column names to Lodge-ical's import schema.
// Used when an innkeeper uploads a CSV export from their old system.

// ---------------------------------------------------------------------------
// Field definitions — the Lodge-ical fields we need from an import CSV
// ---------------------------------------------------------------------------
export const IMPORT_FIELDS = [
  { key: 'guest_name',          label: 'Guest name',      required: true,  special: 'fullname',  hint: 'Will be split into first and last name'       },
  { key: 'room_name',           label: 'Room',            required: true                                                                               },
  { key: 'check_in',            label: 'Check-in date',   required: true,                         hint: 'Must be YYYY-MM-DD'                           },
  { key: 'check_out',           label: 'Check-out date',  required: true,                         hint: 'Must be YYYY-MM-DD'                           },
  { key: 'num_guests',          label: '# Guests',        required: false, default: '1'                                                                },
  { key: 'guest_email',         label: 'Guest email',     required: false, default: '__skip__'                                                         },
  { key: 'guest_phone',         label: 'Guest phone',     required: false, default: '__skip__'                                                         },
  { key: 'confirmation_number', label: 'Booking ID',      required: false, default: '__autogen__', hint: 'Auto-generated if not in your CSV'           },
  { key: 'total_due_cents',     label: 'Total charge',    required: false, default: '__zero__',   special: 'money'                                     },
  { key: 'amount_paid',         label: 'Amount paid',     required: false, default: '__zero__',   special: 'money', hint: 'Creates a payment record if > 0' },
  { key: 'status',              label: 'Status',          required: false, default: '__confirmed__'                                                    },
  { key: 'notes',               label: 'Notes',           required: false, default: '__skip__'                                                         },
]

// Fields that require a real CSV column (can't be skipped or defaulted)
export const REQUIRED_FIELDS = IMPORT_FIELDS.filter(f => f.required).map(f => f.key)

// ---------------------------------------------------------------------------
// Special default sentinel values
// ---------------------------------------------------------------------------
export const SPECIAL = {
  AUTOGEN:    '__autogen__',
  SKIP:       '__skip__',
  ZERO:       '__zero__',
  CONFIRMED:  '__confirmed__',
}

// ---------------------------------------------------------------------------
// Keyword aliases — used for auto-suggest
// ---------------------------------------------------------------------------
const ALIASES = {
  guest_name:          ['guest name', 'name', 'customer', 'full name', 'fullname', 'client', 'guest'],
  room_name:           ['room', 'unit', 'accommodation', 'multi-unit', 'multi unit', 'property nickname', 'room name', 'unit name', 'suite'],
  check_in:            ['check in', 'checkin', 'arrival', 'check-in', 'start date', 'from', 'arrive'],
  check_out:           ['check out', 'checkout', 'departure', 'check-out', 'end date', 'to', 'depart'],
  num_guests:          ['guests', 'adults', 'number of guests', 'people', 'pax', 'party size', 'occupants', 'number of nights'],
  guest_email:         ['email', 'e-mail', 'guest email', 'email address', 'mail'],
  guest_phone:         ['phone', 'telephone', 'mobile', 'cell', 'contact number', 'tel'],
  confirmation_number: ['confirmation', 'booking', 'reservation id', 'booking id', 'booking number', 'ref', 'reference', 'id', 'booking ref'],
  total_due_cents:     ['total', 'amount', 'charge', 'price', 'revenue', 'booking total', 'rate', 'total charge', 'amount due'],
  amount_paid:         ['paid', 'amount paid', 'payment', 'received', 'collected'],
  status:              ['status', 'booking status', 'reservation status', 'state'],
  notes:               ['notes', 'comments', 'special requests', 'memo', 'remarks', 'special'],
}

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Given a list of CSV column headers from an unknown source, return an initial
 * mapping suggestion: { fieldKey: csvColumnName | sentinel }.
 *
 * Required fields without a match are left as '' (user must fill in).
 * Optional fields without a match get their default sentinel value.
 */
export function autoSuggestMapping(csvHeaders) {
  const normalizedHeaders = csvHeaders.map(h => ({ original: h, normalized: normalize(h) }))
  const mapping = {}
  const usedHeaders = new Set()

  for (const field of IMPORT_FIELDS) {
    const aliases = ALIASES[field.key] ?? []
    let best = null

    // Try each alias against each header
    outer: for (const alias of aliases) {
      for (const h of normalizedHeaders) {
        if (usedHeaders.has(h.original)) continue
        if (h.normalized === alias || h.normalized.includes(alias) || alias.includes(h.normalized)) {
          best = h.original
          break outer
        }
      }
    }

    if (best) {
      mapping[field.key] = best
      usedHeaders.add(best)
    } else {
      mapping[field.key] = field.default ?? ''
    }
  }

  return mapping
}

/**
 * Returns true if the uploaded CSV already uses Lodge-ical's exact template headers.
 */
export function isTemplateCsv(csvHeaders) {
  const TEMPLATE_HEADERS = [
    'confirmation_number', 'check_in', 'check_out', 'num_guests',
    'guest_first_name', 'guest_last_name', 'guest_email', 'guest_phone',
    'room_name', 'total_due_cents', 'status', 'notes',
  ]
  return TEMPLATE_HEADERS.every(h => csvHeaders.includes(h))
}

/**
 * Apply a confirmed column mapping to raw CSV rows, producing rows with
 * Lodge-ical field names ready to send to the import Edge Function.
 *
 * @param {object[]} rawRows   - Rows keyed by original CSV column names
 * @param {object}   mapping   - { fieldKey: csvColumnName | sentinel }
 * @param {'dollars'|'cents'} moneyUnit - How to interpret money columns
 * @returns {object[]} Rows with Lodge-ical field names
 */
export function applyColumnMapping(rawRows, mapping, moneyUnit = 'dollars') {
  return rawRows.map(raw => {
    const row = {}

    for (const field of IMPORT_FIELDS) {
      const src = mapping[field.key]

      // Guest name: special full-name split
      if (field.special === 'fullname') {
        const full = (src && src !== SPECIAL.SKIP ? raw[src] ?? '' : '').trim()
        const lastSpace = full.lastIndexOf(' ')
        row.guest_first_name = lastSpace > 0 ? full.slice(0, lastSpace) : full
        row.guest_last_name  = lastSpace > 0 ? full.slice(lastSpace + 1) : ''
        continue
      }

      // Money fields: optionally convert dollars → cents
      if (field.special === 'money') {
        let raw_val = ''
        if (src && src !== SPECIAL.SKIP && src !== SPECIAL.ZERO && raw[src] !== undefined) {
          raw_val = raw[src]
        }
        const parsed = parseFloat(String(raw_val).replace(/[^0-9.]/g, '')) || 0
        const cents = moneyUnit === 'dollars' ? Math.round(parsed * 100) : Math.round(parsed)

        if (field.key === 'total_due_cents') row.total_due_cents = cents
        if (field.key === 'amount_paid')     row.amount_paid_cents = cents
        continue
      }

      // Sentinel values
      if (!src || src === SPECIAL.SKIP)      { row[field.key] = '';          continue }
      if (src === SPECIAL.AUTOGEN)           { row[field.key] = '';          continue }
      if (src === SPECIAL.ZERO)              { row[field.key] = '0';         continue }
      if (src === SPECIAL.CONFIRMED)         { row[field.key] = 'confirmed'; continue }

      // Normal column mapping
      row[field.key] = raw[src] ?? ''
    }

    return row
  })
}
