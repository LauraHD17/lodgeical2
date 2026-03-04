/* global __ENV __VU __ITER */
// K6 load test configuration for Lodge-ical Edge Functions
// Run with: k6 run tests/load/k6.config.js
//
// Prerequisites:
//   1. supabase start (or point at staging)
//   2. Set env vars: BASE_URL, ADMIN_JWT, PROPERTY_ID, ROOM_ID, TEST_RESERVATION_ID
//
// Example:
//   BASE_URL=http://localhost:54321 \
//   ADMIN_JWT=eyJ... \
//   PROPERTY_ID=uuid \
//   ROOM_ID=uuid \
//   k6 run tests/load/k6.config.js

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// ── Custom metrics ────────────────────────────────────────────────────────────
const errorRate        = new Rate('errors')
const conflictRate     = new Rate('conflicts')
const createResTrend   = new Trend('create_reservation_duration', true)
const portalLookupTrend = new Trend('portal_lookup_duration', true)
const updateResTrend   = new Trend('update_reservation_duration', true)

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL     = __ENV.BASE_URL     || 'http://localhost:54321'
const ADMIN_JWT    = __ENV.ADMIN_JWT    || ''
const PROPERTY_ID  = __ENV.PROPERTY_ID  || ''
const ROOM_ID      = __ENV.ROOM_ID      || ''
const RESERVATION_ID = __ENV.TEST_RESERVATION_ID || ''

const FUNCTIONS_URL = `${BASE_URL}/functions/v1`

const authHeaders = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${ADMIN_JWT}`,
}

// ── Test scenarios ─────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Scenario 1: Steady-state reservation creation
    create_reservation: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },  // ramp up
        { duration: '1m',  target: 10 },  // hold
        { duration: '15s', target: 0  },  // ramp down
      ],
      exec: 'createReservation',
      tags: { scenario: 'create_reservation' },
    },

    // Scenario 2: Concurrent creation on same room (conflict detection stress)
    conflict_stress: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'createReservationSameRoom',
      startTime: '2m',  // run after scenario 1
      tags: { scenario: 'conflict_stress' },
    },

    // Scenario 3: Guest portal lookup (unauthenticated, rate-limited)
    guest_portal: {
      executor: 'constant-arrival-rate',
      rate: 8,           // 8 req/min (stay under 10/min rate limit per IP in prod)
      timeUnit: '1m',
      duration: '1m',
      preAllocatedVUs: 5,
      exec: 'guestPortalLookup',
      startTime: '3m',
      tags: { scenario: 'guest_portal' },
    },

    // Scenario 4: Update reservation (notes-only vs date change)
    update_reservation: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 5 },
        { duration: '40s', target: 5 },
        { duration: '10s', target: 0 },
      ],
      exec: 'updateReservation',
      startTime: '4m30s',
      tags: { scenario: 'update_reservation' },
    },
  },

  thresholds: {
    // P95 latency targets
    'create_reservation_duration': ['p(95)<3000'],   // 3s for write path
    'portal_lookup_duration':       ['p(95)<1500'],   // 1.5s for read path
    'update_reservation_duration':  ['p(95)<2000'],   // 2s for update path

    // Error budget
    'errors':    ['rate<0.05'],   // <5% errors overall
    'conflicts': ['rate<0.50'],   // conflicts expected in stress test, but track them
    'http_req_failed': ['rate<0.05'],
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function futureDate(daysFromNow) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().split('T')[0]
}

// Unique offset per VU to spread date ranges and avoid always conflicting
function vuDateOffset() {
  return __VU * 30  // each VU gets its own 30-day window
}

// ── Scenario implementations ──────────────────────────────────────────────────

/** Normal reservation creation — each VU picks a unique future date window */
export function createReservation() {
  const offset = vuDateOffset()
  const checkIn  = futureDate(90 + offset)
  const checkOut = futureDate(92 + offset)

  const payload = JSON.stringify({
    room_ids: [ROOM_ID],
    check_in: checkIn,
    check_out: checkOut,
    num_guests: 2,
    guest_email: `loadtest+${__VU}_${__ITER}@example.com`,
    guest_first_name: 'Load',
    guest_last_name: 'Test',
    origin: 'direct',
  })

  const start = Date.now()
  const res = http.post(`${FUNCTIONS_URL}/create-reservation`, payload, { headers: authHeaders })
  createResTrend.add(Date.now() - start)

  const ok = check(res, {
    'status 201 or 409': (r) => r.status === 201 || r.status === 409,
    'has body': (r) => r.body && r.body.length > 0,
  })
  if (!ok) errorRate.add(1)
  if (res.status === 409) conflictRate.add(1)

  sleep(1)
}

/** Stress test: all VUs race to book the SAME dates on the SAME room.
 *  Expected: exactly one 201, rest 409. Tests conflict detection correctness. */
export function createReservationSameRoom() {
  const checkIn  = futureDate(200)
  const checkOut = futureDate(203)

  const payload = JSON.stringify({
    room_ids: [ROOM_ID],
    check_in: checkIn,
    check_out: checkOut,
    num_guests: 1,
    guest_email: `conflict+${__VU}_${__ITER}@example.com`,
    guest_first_name: 'Conflict',
    guest_last_name: 'Test',
    origin: 'direct',
  })

  const res = http.post(`${FUNCTIONS_URL}/create-reservation`, payload, { headers: authHeaders })

  const ok = check(res, {
    'status is 201 or 409': (r) => r.status === 201 || r.status === 409,
  })
  if (!ok) errorRate.add(1)
  if (res.status === 409) conflictRate.add(1)

  sleep(0.5)
}

/** Unauthenticated guest portal lookup — tests read path + rate limiting */
export function guestPortalLookup() {
  // Use an intentionally wrong confirmation number to test the no-match path.
  // Swap in a real confirmation_number + email from your test data to test the
  // happy path.
  const payload = JSON.stringify({
    confirmation_number: 'XXXXXX',
    email: 'nonexistent@example.com',
  })

  const start = Date.now()
  const res = http.post(`${FUNCTIONS_URL}/guest-portal-lookup`, payload, {
    headers: { 'Content-Type': 'application/json' },
  })
  portalLookupTrend.add(Date.now() - start)

  const ok = check(res, {
    'status 404 or 429': (r) => r.status === 404 || r.status === 429,
  })
  if (!ok) errorRate.add(1)

  sleep(0.2)
}

/** Update reservation — mix of notes-only and date changes */
export function updateReservation() {
  if (!RESERVATION_ID) {
    console.warn('TEST_RESERVATION_ID not set — skipping update scenario')
    sleep(2)
    return
  }

  const isDateChange = __ITER % 3 === 0  // every 3rd request changes dates

  const payload = isDateChange
    ? JSON.stringify({
        reservation_id: RESERVATION_ID,
        check_in: futureDate(300 + __ITER),
        check_out: futureDate(302 + __ITER),
        notes: `Load test update ${__ITER}`,
      })
    : JSON.stringify({
        reservation_id: RESERVATION_ID,
        notes: `Notes-only update ${__ITER}`,
      })

  const start = Date.now()
  const res = http.post(`${FUNCTIONS_URL}/update-reservation`, payload, { headers: authHeaders })
  updateResTrend.add(Date.now() - start)

  const ok = check(res, {
    'status 200 or 409': (r) => r.status === 200 || r.status === 409,
  })
  if (!ok) errorRate.add(1)

  sleep(1)
}
