// src/mocks/handlers.js
// MSW request handlers for local dev preview — intercepts all Supabase
// API calls (auth, PostgREST, edge functions) and returns fixture data.

import { http, HttpResponse } from 'msw'
import {
  MOCK_USER, MOCK_SESSION,
  MOCK_PROPERTY, MOCK_USER_ACCESS, MOCK_SETTINGS,
  MOCK_ROOMS, MOCK_GUESTS, MOCK_RESERVATIONS,
  MOCK_CONTACTS, MOCK_MAINTENANCE_TICKETS, MOCK_PAYMENTS,
} from './db.js'

// rate_overrides — empty by default in mock
const MOCK_RATE_OVERRIDES = []

const BASE = import.meta.env.VITE_SUPABASE_URL // e.g. http://127.0.0.1:54321

// ---------------------------------------------------------------------------
// Helper: PostgREST returns a plain object for .single() calls (Accept header
// contains 'pgrst.object'), otherwise returns an array.
// ---------------------------------------------------------------------------
function pgRespond(request, data) {
  const wantsSingle = request.headers.get('accept')?.includes('pgrst.object')
  if (wantsSingle) {
    const item = Array.isArray(data) ? (data[0] ?? null) : data
    if (item === null) {
      return HttpResponse.json(
        { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
        { status: 406 },
      )
    }
    return HttpResponse.json(item)
  }
  return HttpResponse.json(Array.isArray(data) ? data : [data])
}

export const handlers = [

  // -------------------------------------------------------------------------
  // Auth — GoTrue endpoints
  // -------------------------------------------------------------------------

  // Validate current session / getUser()
  http.get(`${BASE}/auth/v1/user`, () =>
    HttpResponse.json(MOCK_USER),
  ),

  // signInWithPassword → always succeeds in mock mode
  http.post(`${BASE}/auth/v1/token`, () =>
    HttpResponse.json(MOCK_SESSION),
  ),

  // Token refresh
  http.put(`${BASE}/auth/v1/user`, () =>
    HttpResponse.json(MOCK_USER),
  ),

  // signOut
  http.post(`${BASE}/auth/v1/logout`, () =>
    new HttpResponse(null, { status: 204 }),
  ),
  http.delete(`${BASE}/auth/v1/sessions`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // -------------------------------------------------------------------------
  // PostgREST — database tables
  // -------------------------------------------------------------------------

  // user_property_access (always .single())
  http.get(`${BASE}/rest/v1/user_property_access`, ({ request }) =>
    pgRespond(request, MOCK_USER_ACCESS),
  ),

  // properties (always .single())
  http.get(`${BASE}/rest/v1/properties`, ({ request }) =>
    pgRespond(request, MOCK_PROPERTY),
  ),

  // settings (always .single())
  http.get(`${BASE}/rest/v1/settings`, ({ request }) =>
    pgRespond(request, MOCK_SETTINGS),
  ),

  // rooms — array or single
  http.get(`${BASE}/rest/v1/rooms`, ({ request }) =>
    pgRespond(request, MOCK_ROOMS),
  ),

  http.patch(`${BASE}/rest/v1/rooms`, async ({ request }) => {
    const body = await request.json()
    const url = new URL(request.url)
    const idFilter = url.searchParams.get('id') // eq.room-001
    const id = idFilter?.replace('eq.', '')
    const room = MOCK_ROOMS.find(r => r.id === id) ?? MOCK_ROOMS[0]
    return pgRespond(request, { ...room, ...body })
  }),

  http.post(`${BASE}/rest/v1/rooms`, async ({ request }) => {
    const body = await request.json()
    const newRoom = { id: `room-new-${Date.now()}`, ...body, created_at: new Date().toISOString() }
    return pgRespond(request, newRoom)
  }),

  // reservations — array (paginated)
  http.get(`${BASE}/rest/v1/reservations`, ({ request }) =>
    pgRespond(request, MOCK_RESERVATIONS),
  ),

  http.post(`${BASE}/rest/v1/reservations`, async ({ request }) => {
    const body = await request.json()
    const newRes = { id: `res-new-${Date.now()}`, ...body, created_at: new Date().toISOString() }
    return pgRespond(request, newRes)
  }),

  // guests — array or single-by-email
  http.get(`${BASE}/rest/v1/guests`, ({ request }) =>
    pgRespond(request, MOCK_GUESTS),
  ),

  http.patch(`${BASE}/rest/v1/guests`, async ({ request }) => {
    const body = await request.json()
    const url = new URL(request.url)
    const idFilter = url.searchParams.get('id')
    const id = idFilter?.replace('eq.', '')
    const guest = MOCK_GUESTS.find(g => g.id === id) ?? MOCK_GUESTS[0]
    return pgRespond(request, { ...guest, ...body })
  }),

  // documents — empty list
  http.get(`${BASE}/rest/v1/documents`, ({ request }) =>
    pgRespond(request, []),
  ),
  http.delete(`${BASE}/rest/v1/documents`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // room_external_feeds — empty list
  http.get(`${BASE}/rest/v1/room_external_feeds`, ({ request }) =>
    pgRespond(request, []),
  ),
  http.post(`${BASE}/rest/v1/room_external_feeds`, async ({ request }) => {
    const body = await request.json()
    return pgRespond(request, { id: `feed-${Date.now()}`, ...body, last_synced_at: null, created_at: new Date().toISOString() })
  }),
  http.patch(`${BASE}/rest/v1/room_external_feeds`, async ({ request }) => {
    const body = await request.json()
    return pgRespond(request, body)
  }),
  http.delete(`${BASE}/rest/v1/room_external_feeds`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // PATCH properties (settings save)
  http.patch(`${BASE}/rest/v1/properties`, async ({ request }) => {
    const body = await request.json()
    return pgRespond(request, { ...MOCK_PROPERTY, ...body })
  }),

  // PATCH settings
  http.patch(`${BASE}/rest/v1/settings`, async ({ request }) => {
    const body = await request.json()
    return pgRespond(request, { ...MOCK_SETTINGS, ...body })
  }),

  // -------------------------------------------------------------------------
  // Edge Functions
  // -------------------------------------------------------------------------

  http.post(`${BASE}/functions/v1/create-reservation`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: `res-new-${Date.now()}`,
      confirmation_number: `RES-${String(Date.now()).slice(-4)}`,
      ...body,
    })
  }),

  http.post(`${BASE}/functions/v1/update-reservation`, async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ success: true, ...body })
  }),

  http.post(`${BASE}/functions/v1/get-payment-summary`, () =>
    HttpResponse.json({
      reservation_id: 'res-001',
      total_due_cents: 55500,
      total_paid_cents: 27750,
      balance_cents: 27750,
      payments: [
        { id: 'pay-001', amount_cents: 27750, status: 'succeeded', created_at: new Date().toISOString() },
      ],
    }),
  ),

  http.post(`${BASE}/functions/v1/create-payment-intent`, () =>
    HttpResponse.json({
      client_secret: 'pi_mock_secret_dev',
      amount: 27750,
      currency: 'usd',
    }),
  ),

  http.post(`${BASE}/functions/v1/ical-import`, () =>
    HttpResponse.json({ success: true, synced: 0, skipped: 0 }),
  ),

  http.post(`${BASE}/functions/v1/import-csv`, () =>
    HttpResponse.json({ success: true, imported: 0, skipped: 0, errors: [] }),
  ),

  // Public booking widget bootstrap
  http.get(`${BASE}/functions/v1/public-bootstrap`, ({ request }) => {
    const url  = new URL(request.url)
    const slug = url.searchParams.get('slug')
    if (!slug || slug !== MOCK_PROPERTY.slug) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json({
      property: MOCK_PROPERTY,
      rooms:    MOCK_ROOMS.filter(r => r.is_active),
      settings: { ...MOCK_SETTINGS, currency: 'USD', min_stay_nights: 1, require_payment_at_booking: false, allow_partial_payment: true },
    })
  }),

  // Guest portal lookup
  http.post(`${BASE}/functions/v1/guest-portal-lookup`, async ({ request }) => {
    const body = await request.json().catch(() => ({}))
    const { confirmation_number, email } = body
    const res = MOCK_RESERVATIONS.find(
      r => r.confirmation_number === confirmation_number && r.guests?.email === email
    )
    if (!res) {
      return HttpResponse.json({ error: 'Reservation not found. Please check your confirmation number and email.' }, { status: 404 })
    }
    return HttpResponse.json({
      reservation: res,
      payment_summary: {
        total_due_cents:  res.total_due_cents ?? 0,
        total_paid_cents: 0,
        balance_cents:    res.total_due_cents ?? 0,
        status:           'unpaid',
      },
    })
  }),

  // Cancel reservation (guest-facing)
  http.post(`${BASE}/functions/v1/cancel-reservation`, async ({ request }) => {
    const body = await request.json().catch(() => ({}))
    if (body.preview_only) {
      return HttpResponse.json({ refund_cents: 0, policy: 'strict', message: 'No refund per cancellation policy.' })
    }
    return HttpResponse.json({ success: true, message: 'Reservation cancelled.' })
  }),

  http.get(`${BASE}/functions/v1/ical-export`, () =>
    new HttpResponse(
      'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR',
      { headers: { 'Content-Type': 'text/calendar' } },
    ),
  ),

  // -------------------------------------------------------------------------
  // contacts
  // -------------------------------------------------------------------------

  http.get(`${BASE}/rest/v1/contacts`, ({ request }) =>
    pgRespond(request, MOCK_CONTACTS),
  ),

  http.post(`${BASE}/rest/v1/contacts`, async ({ request }) => {
    const body = await request.json()
    const newContact = { id: `contact-new-${Date.now()}`, ...body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    return pgRespond(request, newContact)
  }),

  http.patch(`${BASE}/rest/v1/contacts`, async ({ request }) => {
    const body = await request.json()
    const url = new URL(request.url)
    const idFilter = url.searchParams.get('id')
    const id = idFilter?.replace('eq.', '')
    const contact = MOCK_CONTACTS.find(c => c.id === id) ?? MOCK_CONTACTS[0]
    return pgRespond(request, { ...contact, ...body })
  }),

  http.delete(`${BASE}/rest/v1/contacts`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // -------------------------------------------------------------------------
  // maintenance_tickets
  // -------------------------------------------------------------------------

  http.get(`${BASE}/rest/v1/maintenance_tickets`, ({ request }) =>
    pgRespond(request, MOCK_MAINTENANCE_TICKETS),
  ),

  http.post(`${BASE}/rest/v1/maintenance_tickets`, async ({ request }) => {
    const body = await request.json()
    const newTicket = { id: `ticket-new-${Date.now()}`, ...body, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), rooms: null, contacts: null }
    return pgRespond(request, newTicket)
  }),

  http.patch(`${BASE}/rest/v1/maintenance_tickets`, async ({ request }) => {
    const body = await request.json()
    const url = new URL(request.url)
    const idFilter = url.searchParams.get('id')
    const id = idFilter?.replace('eq.', '')
    const ticket = MOCK_MAINTENANCE_TICKETS.find(t => t.id === id) ?? MOCK_MAINTENANCE_TICKETS[0]
    return pgRespond(request, { ...ticket, ...body })
  }),

  http.delete(`${BASE}/rest/v1/maintenance_tickets`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // -------------------------------------------------------------------------
  // rate_overrides
  http.get(`${BASE}/rest/v1/rate_overrides`, ({ request }) =>
    pgRespond(request, MOCK_RATE_OVERRIDES),
  ),

  http.post(`${BASE}/rest/v1/rate_overrides`, async ({ request }) => {
    const body = await request.json()
    return pgRespond(request, { id: `ro-new-${Date.now()}`, ...body })
  }),

  http.patch(`${BASE}/rest/v1/rate_overrides`, async ({ request }) => {
    const body = await request.json()
    return pgRespond(request, body)
  }),

  http.delete(`${BASE}/rest/v1/rate_overrides`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // payments (direct table read for Financial Insights)
  // -------------------------------------------------------------------------

  http.get(`${BASE}/rest/v1/payments`, ({ request }) =>
    pgRespond(request, MOCK_PAYMENTS),
  ),

  http.post(`${BASE}/rest/v1/payments`, async ({ request }) => {
    const body = await request.json()
    return pgRespond(request, { id: `pay-new-${Date.now()}`, ...body, created_at: new Date().toISOString() })
  }),

]
