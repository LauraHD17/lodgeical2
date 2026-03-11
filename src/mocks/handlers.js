// src/mocks/handlers.js
// MSW request handlers for local dev preview — intercepts all Supabase
// API calls (auth, PostgREST, edge functions) and returns fixture data.

import { http, HttpResponse } from 'msw'
import {
  MOCK_USER, MOCK_SESSION,
  MOCK_PROPERTY, MOCK_USER_ACCESS, MOCK_SETTINGS,
  MOCK_ROOMS, MOCK_GUESTS, MOCK_RESERVATIONS,
  MOCK_CONTACTS, MOCK_MAINTENANCE_TICKETS, MOCK_PAYMENTS,
  MOCK_EMAIL_LOGS, MOCK_GUEST_ACTIVITY, MOCK_ROOM_LINKS,
  MOCK_ONBOARDING_STATE, MOCK_IMPORT_BATCHES, MOCK_ADMIN_ACTIVITY,
  MOCK_INQUIRIES,
  MOCK_DOCUMENTS,
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

  // room_links — CRUD
  http.get(`${BASE}/rest/v1/room_links`, ({ request }) =>
    pgRespond(request, MOCK_ROOM_LINKS),
  ),

  http.post(`${BASE}/rest/v1/room_links`, async ({ request }) => {
    const body = await request.json()
    const newLink = { id: `rlink-new-${Date.now()}`, ...body, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    MOCK_ROOM_LINKS.push(newLink)
    return pgRespond(request, newLink)
  }),

  http.patch(`${BASE}/rest/v1/room_links`, async ({ request }) => {
    const body = await request.json()
    const url = new URL(request.url)
    const idFilter = url.searchParams.get('id')
    const id = idFilter?.replace('eq.', '')
    const idx = MOCK_ROOM_LINKS.findIndex(l => l.id === id)
    if (idx >= 0) Object.assign(MOCK_ROOM_LINKS[idx], body, { updated_at: new Date().toISOString() })
    return pgRespond(request, idx >= 0 ? MOCK_ROOM_LINKS[idx] : body)
  }),

  http.delete(`${BASE}/rest/v1/room_links`, ({ request }) => {
    const url = new URL(request.url)
    const idFilter = url.searchParams.get('id')
    const id = idFilter?.replace('eq.', '')
    const idx = MOCK_ROOM_LINKS.findIndex(l => l.id === id)
    if (idx >= 0) MOCK_ROOM_LINKS.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
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

  // documents
  http.get(`${BASE}/rest/v1/documents`, ({ request }) =>
    pgRespond(request, MOCK_DOCUMENTS),
  ),
  http.post(`${BASE}/rest/v1/documents`, async ({ request }) => {
    const body = await request.json()
    const newDoc = { id: `doc-new-${Date.now()}`, ...body, uploaded_at: new Date().toISOString() }
    return pgRespond(request, newDoc)
  }),
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

  // Send invoice
  http.post(`${BASE}/functions/v1/send-invoice`, () =>
    HttpResponse.json({ success: true }),
  ),

  // Public booking widget bootstrap
  http.get(`${BASE}/functions/v1/public-bootstrap`, ({ request }) => {
    const url  = new URL(request.url)
    const slug = url.searchParams.get('slug')
    if (!slug || slug !== MOCK_PROPERTY.slug) {
      return new HttpResponse(null, { status: 404 })
    }
    return HttpResponse.json({
      property: {
        ...MOCK_PROPERTY,
        seasonal_closure_start: null,
        seasonal_closure_end: null,
        seasonal_closure_message: 'We haven\'t opened these dates yet. Send an inquiry and we\'ll reach out when availability opens up!',
      },
      rooms:    MOCK_ROOMS.filter(r => r.is_active),
      roomLinks: MOCK_ROOM_LINKS.filter(l => l.is_active),
      settings: { ...MOCK_SETTINGS, currency: 'USD', min_stay_nights: 1, require_payment_at_booking: false, allow_partial_payment: true },
    })
  }),

  // Guest portal lookup — requires confirmation_number + email (security gate)
  // Returns single reservation detail + all reservations for that email
  http.post(`${BASE}/functions/v1/guest-portal-lookup`, async ({ request }) => {
    const body = await request.json().catch(() => ({}))
    const { confirmation_number, email } = body

    if (!confirmation_number || !email) {
      return HttpResponse.json({ error: 'Reservation not found.' }, { status: 404 })
    }

    const res = MOCK_RESERVATIONS.find(
      r => r.confirmation_number === confirmation_number && r.guests?.email === email
    )
    if (!res) {
      return HttpResponse.json({ error: 'Reservation not found. Please check your confirmation number and email.' }, { status: 404 })
    }

    // All reservations for this email (for history/payments tabs)
    const lowerEmail = email.toLowerCase()
    const allReservations = MOCK_RESERVATIONS.filter(
      r => r.guests?.email?.toLowerCase() === lowerEmail || r.booker_email?.toLowerCase() === lowerEmail
    )
    const guest = MOCK_GUESTS.find(g => g.email.toLowerCase() === lowerEmail)
    const allRoomIds = [...new Set(allReservations.flatMap(r => r.room_ids ?? []))]
    const matchingPayments = MOCK_PAYMENTS.filter(p =>
      allReservations.some(r => r.id === p.reservation_id)
    )

    return HttpResponse.json({
      reservation: res,
      rooms: MOCK_ROOMS.filter(r => res.room_ids?.includes(r.id)),
      paymentSummary: {
        total_due_cents:  res.total_due_cents ?? 0,
        total_paid_cents: 0,
        balance_cents:    res.total_due_cents ?? 0,
        status:           'unpaid',
      },
      availableRooms: MOCK_ROOMS.filter(r => r.is_active),
      // All-reservations data
      reservations: allReservations,
      guest: guest ? {
        id: guest.id, first_name: guest.first_name, last_name: guest.last_name, email: guest.email, phone: guest.phone,
        billing_address_line1: guest.billing_address_line1 ?? null, billing_address_line2: guest.billing_address_line2 ?? null,
        billing_city: guest.billing_city ?? null, billing_state: guest.billing_state ?? null,
        billing_postal_code: guest.billing_postal_code ?? null, billing_country: guest.billing_country ?? null,
      } : null,
      allRooms: MOCK_ROOMS.filter(r => allRoomIds.includes(r.id)),
      payments: matchingPayments,
    })
  }),

  // Cancel reservation (guest-facing)
  http.post(`${BASE}/functions/v1/cancel-reservation`, async ({ request }) => {
    const body = await request.json().catch(() => ({}))
    if (body.preview_only) {
      return HttpResponse.json({ refund_cents: 0, policy: 'strict', policy_note: 'Strict policy: Full refund only for cancellations made at least 14 days before check-in. Your check-in is within 14 days — no refund applies.' })
    }
    return HttpResponse.json({ success: true, refund_cents: 0, message: 'Reservation cancelled.' })
  }),

  // Modify reservation (guest-facing)
  http.post(`${BASE}/functions/v1/modify-reservation`, async ({ request }) => {
    const body = await request.json().catch(() => ({}))
    const res = MOCK_RESERVATIONS.find(r => r.id === body.reservation_id) ?? MOCK_RESERVATIONS[0]
    if (body.preview_only) {
      return HttpResponse.json({
        original: {
          check_in: res.check_in,
          check_out: res.check_out,
          total_cents: res.total_due_cents ?? 0,
        },
        modified: {
          check_in: body.new_check_in ?? res.check_in,
          check_out: body.new_check_out ?? res.check_out,
          total_cents: res.total_due_cents ?? 0,
        },
        balance_due_cents: 0,
        requires_payment: false,
      })
    }
    // Apply mode — mutate mock data so re-fetch returns updated values
    if (res) {
      if (body.new_check_in)   res.check_in = body.new_check_in
      if (body.new_check_out)  res.check_out = body.new_check_out
      if (body.new_room_ids)   res.room_ids = body.new_room_ids
      if (body.new_num_guests) res.num_guests = body.new_num_guests
      res.modification_count = (res.modification_count ?? 0) + 1
    }
    return HttpResponse.json({ success: true, requires_payment: false })
  }),

  // Confirm modification (after payment)
  http.post(`${BASE}/functions/v1/confirm-modification`, async ({ request }) => {
    const body = await request.json().catch(() => ({}))
    const target = MOCK_RESERVATIONS.find(r => r.id === body.reservation_id)
    if (target) {
      target.modification_count = (target.modification_count ?? 0) + 1
    }
    return HttpResponse.json({ success: true })
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

  // -------------------------------------------------------------------------
  // email_logs
  // -------------------------------------------------------------------------

  http.get(`${BASE}/rest/v1/email_logs`, ({ request }) => {
    const sorted = [...MOCK_EMAIL_LOGS].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    return pgRespond(request, sorted)
  }),

  // -------------------------------------------------------------------------
  // guest_portal_activity
  // -------------------------------------------------------------------------

  http.get(`${BASE}/rest/v1/guest_portal_activity`, ({ request }) => {
    const sorted = [...MOCK_GUEST_ACTIVITY].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return pgRespond(request, sorted)
  }),

  // -------------------------------------------------------------------------
  // Guest portal update (contact info + booker attachment)
  // -------------------------------------------------------------------------

  http.post(`${BASE}/functions/v1/guest-portal-update`, async ({ request }) => {
    const body = await request.json().catch(() => ({}))
    const { action, confirmation_number, email } = body

    // Verify identity
    const res = MOCK_RESERVATIONS.find(
      r => r.confirmation_number === confirmation_number && r.guests?.email === email
    )
    if (!res) {
      return HttpResponse.json({ error: 'Reservation not found.' }, { status: 404 })
    }

    if (action === 'update_contact') {
      const guest = MOCK_GUESTS.find(g => g.email === email)
      if (guest) {
        if (body.new_email) guest.email = body.new_email
        if (body.new_phone) guest.phone = body.new_phone
      }
      MOCK_GUEST_ACTIVITY.push({
        id: `gact-${Date.now()}`, property_id: res.property_id, reservation_id: null,
        guest_id: guest?.id ?? res.guest_id, action: 'contact_updated',
        details: { old_email: email, new_email: body.new_email, old_phone: guest?.phone, new_phone: body.new_phone },
        created_at: new Date().toISOString(),
        guests: { first_name: guest?.first_name ?? '', last_name: guest?.last_name ?? '' },
      })
      return HttpResponse.json({ success: true, message: 'Contact information updated.' })
    }

    if (action === 'attach_booker') {
      const target = MOCK_RESERVATIONS.find(r => r.id === body.target_reservation_id)
      if (!target) return HttpResponse.json({ error: 'Target reservation not found.' }, { status: 404 })
      if (target.guest_id !== res.guest_id) return HttpResponse.json({ error: 'You can only attach yourself as booker to your own reservations.' }, { status: 403 })
      target.booker_email = email
      const guest = MOCK_GUESTS.find(g => g.email === email)
      MOCK_GUEST_ACTIVITY.push({
        id: `gact-${Date.now()}`, property_id: target.property_id, reservation_id: target.id,
        guest_id: guest?.id ?? res.guest_id, action: 'booker_attached',
        details: { target_reservation_id: target.id, booker_email: email, confirmation_number: target.confirmation_number },
        created_at: new Date().toISOString(),
        guests: { first_name: guest?.first_name ?? '', last_name: guest?.last_name ?? '' },
      })
      return HttpResponse.json({ success: true, message: 'You have been attached as booker to this reservation.' })
    }

    return HttpResponse.json({ error: 'Unknown action' }, { status: 400 })
  }),

  // -------------------------------------------------------------------------
  // onboarding_state
  // -------------------------------------------------------------------------

  http.get(`${BASE}/rest/v1/onboarding_state`, ({ request }) =>
    pgRespond(request, [MOCK_ONBOARDING_STATE]),
  ),

  http.post(`${BASE}/rest/v1/onboarding_state`, async ({ request }) => {
    const body = await request.json()
    const row = { id: `onboard-new-${Date.now()}`, ...body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    return pgRespond(request, row)
  }),

  http.patch(`${BASE}/rest/v1/onboarding_state`, async ({ request }) => {
    const body = await request.json()
    return pgRespond(request, { ...MOCK_ONBOARDING_STATE, ...body })
  }),

  // -------------------------------------------------------------------------
  // import_batches
  // -------------------------------------------------------------------------

  http.get(`${BASE}/rest/v1/import_batches`, ({ request }) =>
    pgRespond(request, MOCK_IMPORT_BATCHES),
  ),

  http.post(`${BASE}/rest/v1/import_batches`, async ({ request }) => {
    const body = await request.json()
    const row = { id: `batch-${Date.now()}`, ...body, created_at: new Date().toISOString() }
    return pgRespond(request, row)
  }),

  // -------------------------------------------------------------------------
  // admin_activity
  // -------------------------------------------------------------------------

  http.get(`${BASE}/rest/v1/admin_activity`, ({ request }) =>
    pgRespond(request, MOCK_ADMIN_ACTIVITY),
  ),

  // -------------------------------------------------------------------------
  // inquiries
  // -------------------------------------------------------------------------

  http.get(`${BASE}/rest/v1/inquiries`, ({ request }) =>
    pgRespond(request, MOCK_INQUIRIES),
  ),

  http.post(`${BASE}/rest/v1/inquiries`, async ({ request }) => {
    const body = await request.json()
    const newInq = { id: `inq-new-${Date.now()}`, ...body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    return pgRespond(request, newInq)
  }),

  http.patch(`${BASE}/rest/v1/inquiries`, async ({ request }) => {
    const body = await request.json()
    const url = new URL(request.url)
    const idFilter = url.searchParams.get('id')
    const id = idFilter?.replace('eq.', '')
    const inq = MOCK_INQUIRIES.find(i => i.id === id) ?? MOCK_INQUIRIES[0]
    return pgRespond(request, { ...inq, ...body })
  }),

  // Submit inquiry (public edge function)
  http.post(`${BASE}/functions/v1/submit-inquiry`, () =>
    HttpResponse.json({ success: true }),
  ),

  // Stripe reconciliation (mock: all matched clean state)
  http.post(`${BASE}/functions/v1/stripe-reconcile`, () =>
    HttpResponse.json({
      summary: { matched: 10, mismatches: 0, stripeOnly: 0, localOnly: 0,
                 totalStripeCharges: 1250000, totalLocalPayments: 1250000 },
      matched: Array.from({ length: 10 }, (_, i) => ({
        localId: `pay_mock_${i + 1}`,
        stripeId: `ch_mock_${i + 1}`,
        amount: 125000,
        status: 'succeeded',
      })),
      mismatches: [],
      stripeOnly: [],
      localOnly: [],
    })
  ),

]
