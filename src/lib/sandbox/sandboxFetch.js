// src/lib/sandbox/sandboxFetch.js
// Lightweight fetch interceptor for sandbox mode. Intercepts edge function
// calls (`/functions/v1/*`) and returns mock responses so the sandbox works
// without a real Supabase backend or MSW service worker.

let _originalFetch = null

// Mock response data for edge functions — mirrors shapes in mocks/handlers.js
const EDGE_RESPONSES = {
  'create-reservation': (body) => ({
    id: `res-new-${Date.now()}`,
    confirmation_number: `RES-${String(Date.now()).slice(-4)}`,
    ...body,
  }),

  'update-reservation': (body) => ({ success: true, ...body }),

  'get-payment-summary': () => ({
    reservation_id: 'res-001',
    total_due_cents: 55500,
    total_paid_cents: 27750,
    balance_cents: 27750,
    payments: [
      { id: 'pay-001', amount_cents: 27750, status: 'succeeded', created_at: new Date().toISOString() },
    ],
  }),

  'create-payment-intent': () => ({
    client_secret: 'pi_mock_secret_sandbox',
    amount: 27750,
    currency: 'usd',
  }),

  'ical-import': () => ({ success: true, synced: 0, skipped: 0 }),

  'import-csv': () => ({ success: true, imported: 0, skipped: 0, errors: [] }),

  'cancel-reservation': (body) => {
    if (body?.preview_only) {
      return { refund_cents: 0, policy: 'strict', policy_note: 'Strict policy: no refund in sandbox.' }
    }
    return { success: true, refund_cents: 0, message: 'Reservation cancelled.' }
  },

  'modify-reservation': (body) => {
    if (body?.preview_only) {
      return {
        original: { check_in: '2026-03-10', check_out: '2026-03-13', total_cents: 55500 },
        modified: { check_in: body.new_check_in ?? '2026-03-10', check_out: body.new_check_out ?? '2026-03-13', total_cents: 55500 },
        balance_due_cents: 0,
        requires_payment: false,
      }
    }
    return { success: true, requires_payment: false }
  },

  'confirm-modification': () => ({ success: true }),

  'send-invoice': () => ({ success: true }),

  'merge-guests': () => ({ success: true, merged_id: 'guest-001' }),

  'guest-portal-update': () => ({ success: true }),

  'provision-property': (body) => ({
    property: {
      id: `prop-${Date.now()}`,
      name: body?.property_name ?? 'My Inn',
      slug: (body?.property_name ?? 'my-inn').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    },
  }),
}

function extractFunctionName(url) {
  const match = url.match(/\/functions\/v1\/([a-z-]+)/)
  return match ? match[1] : null
}

async function sandboxFetchHandler(input, init) {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
  const fnName = extractFunctionName(url)

  if (fnName && EDGE_RESPONSES[fnName]) {
    let body = null
    if (init?.body) {
      try { body = JSON.parse(init.body) } catch { /* ignore */ }
    }

    const data = EDGE_RESPONSES[fnName](body)
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Special cases: public-bootstrap and ical-export are GET requests
  if (fnName === 'public-bootstrap') {
    // Dynamically import mock data only when needed
    const { MOCK_PROPERTY, MOCK_ROOMS, MOCK_ROOM_LINKS, MOCK_SETTINGS } = await import('@/mocks/db.js')
    return new Response(JSON.stringify({
      property: MOCK_PROPERTY,
      rooms: MOCK_ROOMS.filter(r => r.is_active),
      roomLinks: MOCK_ROOM_LINKS.filter(l => l.is_active),
      settings: { ...MOCK_SETTINGS, currency: 'USD', min_stay_nights: 1, require_payment_at_booking: false, allow_partial_payment: true },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  if (fnName === 'ical-export') {
    return new Response('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR', {
      status: 200,
      headers: { 'Content-Type': 'text/calendar' },
    })
  }

  if (fnName === 'guest-portal-lookup') {
    const { MOCK_RESERVATIONS, MOCK_ROOMS, MOCK_GUESTS, MOCK_PAYMENTS } = await import('@/mocks/db.js')
    let body = null
    if (init?.body) {
      try { body = JSON.parse(init.body) } catch { /* ignore */ }
    }
    const { confirmation_number, email } = body ?? {}
    if (!confirmation_number || !email) {
      return new Response(JSON.stringify({ error: 'Reservation not found.' }), { status: 404 })
    }
    const res = MOCK_RESERVATIONS.find(
      r => r.confirmation_number === confirmation_number && r.guests?.email === email
    )
    if (!res) {
      return new Response(JSON.stringify({ error: 'Reservation not found.' }), { status: 404 })
    }
    const lowerEmail = email.toLowerCase()
    const allReservations = MOCK_RESERVATIONS.filter(
      r => r.guests?.email?.toLowerCase() === lowerEmail || r.booker_email?.toLowerCase() === lowerEmail
    )
    const guest = MOCK_GUESTS.find(g => g.email.toLowerCase() === lowerEmail)
    const allRoomIds = [...new Set(allReservations.flatMap(r => r.room_ids ?? []))]
    const matchingPayments = MOCK_PAYMENTS.filter(p =>
      allReservations.some(r => r.id === p.reservation_id)
    )
    return new Response(JSON.stringify({
      reservation: res,
      rooms: MOCK_ROOMS.filter(r => res.room_ids?.includes(r.id)),
      paymentSummary: { total_due_cents: res.total_due_cents ?? 0, total_paid_cents: 0, balance_cents: res.total_due_cents ?? 0, status: 'unpaid' },
      availableRooms: MOCK_ROOMS.filter(r => r.is_active),
      reservations: allReservations,
      guest: guest ? { id: guest.id, first_name: guest.first_name, last_name: guest.last_name, email: guest.email, phone: guest.phone } : null,
      allRooms: MOCK_ROOMS.filter(r => allRoomIds.includes(r.id)),
      payments: matchingPayments,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  // Not an edge function — pass through to original fetch
  return _originalFetch(input, init)
}

export function installSandboxFetch() {
  if (_originalFetch) return // already installed
  _originalFetch = window.fetch.bind(window)
  window.fetch = sandboxFetchHandler
}

export function removeSandboxFetch() {
  if (_originalFetch) {
    window.fetch = _originalFetch
    _originalFetch = null
  }
}
