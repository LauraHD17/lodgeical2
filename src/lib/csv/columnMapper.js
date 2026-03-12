// src/lib/csv/columnMapper.js
// Helpers for mapping arbitrary CSV column names to Lodge-ical's import schema.
// Used when an innkeeper uploads a CSV export from their old system.

// ---------------------------------------------------------------------------
// Field definitions — the Lodge-ical fields we need from an import CSV.
// Each field has a plain-language `description` shown in the column mapper UI
// so innkeepers know exactly which column to pick, regardless of what their
// old system called it.
// ---------------------------------------------------------------------------
export const IMPORT_FIELDS = [
  {
    key: 'guest_name',
    label: 'Guest name',
    required: true,
    special: 'fullname',
    description: "The guest's full name. Look for 'Guest name', 'Name', 'Customer', or 'Client'. We'll split it into first and last name automatically — everything before the last space becomes the first name.",
  },
  {
    key: 'room_name',
    label: 'Room',
    required: true,
    description: "Which room or unit the guest booked. In Uplisting this is 'Property nickname'; other systems call it 'Unit', 'Listing', or 'Accommodation'. If the column includes your property name (e.g., 'North Haven Inn - Room 3'), that's fine — you'll match it to your Lodge-ical rooms in the next step.",
  },
  {
    key: 'check_in',
    label: 'Check-in date',
    required: true,
    description: "Arrival date. Must be YYYY-MM-DD (e.g., 2026-06-15). Look for 'Check in', 'Arrival', or 'Start date'. If your dates are in a different format, reformat them in Excel or Google Sheets first.",
  },
  {
    key: 'check_out',
    label: 'Check-out date',
    required: true,
    description: "Departure date in YYYY-MM-DD format — the day the guest leaves, not their last night. Look for 'Check out', 'Departure', or 'End date'.",
  },
  {
    key: 'num_guests',
    label: '# Guests',
    required: false,
    default: '1',
    description: "Number of people in the party. Often 'Number of guests', 'Adults', or 'Party size'. Defaults to 1 if not mapped.",
  },
  {
    key: 'guest_email',
    label: 'Guest email',
    required: false,
    default: '__skip__',
    description: "Used to create or find the guest's profile — if the same guest books again, we'll match them by email. A placeholder address is generated if not provided; you can update it from the guest's profile later.",
  },
  {
    key: 'guest_phone',
    label: 'Guest phone',
    required: false,
    default: '__skip__',
    description: "Contact number. Skip if not in your CSV.",
  },
  {
    key: 'confirmation_number',
    label: 'Booking ID',
    required: false,
    default: '__autogen__',
    description: "Your existing booking or reservation number — often 'Booking ID', 'Reservation #', or 'Conf #'. Carried into Lodge-ical so you can cross-reference with your old system during transition. Auto-generated if not in your CSV.",
  },
  {
    key: 'total_due_cents',
    label: 'Total charge',
    required: false,
    default: '__zero__',
    special: 'money',
    description: "The full amount the guest was charged — what appears on their receipt, including cleaning fees and taxes. In Uplisting, use 'Gross revenue'. Avoid 'Total payout', 'Net revenue', or 'Payout' — those are what you received after platform fees, which is less than what the guest paid.",
  },
  {
    key: 'amount_paid',
    label: 'Amount paid',
    required: false,
    default: '__zero__',
    special: 'money',
    description: "How much the guest has already paid. For fully paid bookings this equals the total charge; for unpaid ones it's 0. If your CSV only shows an outstanding balance, subtract that from the total charge. Leave as $0 to record payments manually after import.",
  },
  {
    key: 'status',
    label: 'Status',
    required: false,
    default: '__confirmed__',
    description: "Booking status. We recognize 'confirmed', 'pending', 'cancelled', and 'no_show'. Defaults to 'confirmed' if not mapped or if values don't match — you can correct individual bookings after import.",
  },
  {
    key: 'notes',
    label: 'Notes',
    required: false,
    default: '__skip__',
    description: "Free-text notes or special requests attached to the booking. Optional.",
  },
]

// Fields that require a real CSV column (can't be skipped or defaulted)
export const REQUIRED_FIELDS = IMPORT_FIELDS.filter(f => f.required).map(f => f.key)

// ---------------------------------------------------------------------------
// Special default sentinel values
// ---------------------------------------------------------------------------
export const SPECIAL = {
  AUTOGEN:   '__autogen__',
  SKIP:      '__skip__',
  ZERO:      '__zero__',
  CONFIRMED: '__confirmed__',
}

// ---------------------------------------------------------------------------
// Keyword aliases — used for auto-suggest mapping.
//
// ORDERING MATTERS: the first alias that matches a CSV header wins.
// More-specific phrases must come before shorter ones to avoid false matches
// (e.g., 'property nickname' before 'unit' so Uplisting's 'Multi-unit name'
// doesn't steal the room_name slot).
// ---------------------------------------------------------------------------
const ALIASES = {
  guest_name:          ['guest name', 'full name', 'fullname', 'name', 'customer', 'client', 'guest'],
  // 'property nickname' first — Uplisting; then specific phrases before 'unit' (which would match 'Multi-unit name')
  room_name:           ['property nickname', 'property', 'listing', 'room name', 'unit name', 'room', 'suite', 'accommodation', 'unit'],
  check_in:            ['check in', 'checkin', 'check-in', 'arrival', 'start date', 'arrive', 'from'],
  check_out:           ['check out', 'checkout', 'check-out', 'departure', 'end date', 'depart', 'to'],
  // 'number of nights' removed — it would match Uplisting's 'Number of nights' column (wrong field)
  num_guests:          ['number of guests', 'num guests', 'guests', 'adults', 'people', 'pax', 'party size', 'occupants'],
  guest_email:         ['guest email', 'email address', 'email', 'e-mail', 'mail'],
  guest_phone:         ['guest phone', 'phone number', 'phone', 'telephone', 'mobile', 'cell', 'contact number', 'tel'],
  confirmation_number: ['booking id', 'booking number', 'booking ref', 'reservation id', 'confirmation number', 'confirmation', 'booking', 'ref', 'reference', 'id'],
  // 'gross revenue' / 'gross' first — that's the right Uplisting column (guest-facing total).
  // 'total' and 'revenue' removed: too broad — match 'Total payout' and 'Net revenue' by accident.
  total_due_cents:     ['gross revenue', 'gross', 'total charged', 'total charge', 'booking total', 'accommodation total', 'amount due', 'charge', 'price'],
  amount_paid:         ['amount paid', 'paid', 'payment received', 'received', 'collected', 'payment'],
  status:              ['booking status', 'reservation status', 'status', 'state'],
  notes:               ['special requests', 'notes', 'comments', 'memo', 'remarks', 'special'],
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
        let rawVal = ''
        if (src && src !== SPECIAL.SKIP && src !== SPECIAL.ZERO && raw[src] !== undefined) {
          rawVal = raw[src]
        }
        const parsed = parseFloat(String(rawVal).replace(/[^0-9.]/g, '')) || 0
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
