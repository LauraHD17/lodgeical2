// src/mocks/db.js
// Fixture data for MSW dev mocks. Dates are computed relative to today so
// the dashboard always shows meaningful arrivals/departures/occupancy.

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const MOCK_USER = {
  id: 'user-demo-001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'demo@lodgeical.dev',
  email_confirmed_at: '2024-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Demo Admin' },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const MOCK_SESSION = {
  access_token: 'mock-access-token-dev',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'mock-refresh-token-dev',
  user: MOCK_USER,
}

// ---------------------------------------------------------------------------
// Property
// ---------------------------------------------------------------------------

export const PROPERTY_ID = 'prop-demo-001'

export const MOCK_PROPERTY = {
  id: PROPERTY_ID,
  name: 'Sunrise Lodge',
  slug: 'sunrise-lodge',
  address: '123 Mountain View Rd, Asheville, NC 28801',
  timezone: 'America/New_York',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

export const MOCK_USER_ACCESS = {
  id: 'access-demo-001',
  user_id: MOCK_USER.id,
  property_id: PROPERTY_ID,
  role: 'owner',
  created_at: '2024-01-01T00:00:00Z',
  users: { email: MOCK_USER.email },
}

export const MOCK_SETTINGS = {
  id: 'settings-demo-001',
  property_id: PROPERTY_ID,
  check_in_time: '15:00',
  check_out_time: '11:00',
  tax_rate: 10,
  tax_label: 'State & Local Tax',
  is_tax_exempt: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const MOCK_ROOMS = [
  {
    id: 'room-001',
    property_id: PROPERTY_ID,
    name: 'Cabin A',
    description: 'Cozy lakeside cabin with private deck and fire pit.',
    capacity: 4,
    base_rate_cents: 18500,
    sort_order: 1,
    is_active: true,
    ical_token: 'aaaaaaaa-0000-0000-0000-000000000001',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'room-002',
    property_id: PROPERTY_ID,
    name: 'Cabin B',
    description: 'Secluded forest retreat with hot tub.',
    capacity: 2,
    base_rate_cents: 14500,
    sort_order: 2,
    is_active: true,
    ical_token: 'bbbbbbbb-0000-0000-0000-000000000002',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'room-003',
    property_id: PROPERTY_ID,
    name: 'Mountain Suite',
    description: 'Premium suite with panoramic ridge views and full kitchen.',
    capacity: 6,
    base_rate_cents: 28000,
    sort_order: 3,
    is_active: true,
    ical_token: 'cccccccc-0000-0000-0000-000000000003',
    created_at: '2024-01-01T00:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Guests
// ---------------------------------------------------------------------------

export const MOCK_GUESTS = [
  { id: 'guest-001', property_id: PROPERTY_ID, first_name: 'Alice',   last_name: 'Johnson',  email: 'alice.johnson@example.com',  phone: '+1 828 555 0101', created_at: '2024-03-01T00:00:00Z' },
  { id: 'guest-002', property_id: PROPERTY_ID, first_name: 'Bob',     last_name: 'Smith',    email: 'bob.smith@example.com',      phone: '+1 828 555 0102', created_at: '2024-05-15T00:00:00Z' },
  { id: 'guest-003', property_id: PROPERTY_ID, first_name: 'Carol',   last_name: 'Williams', email: 'carol.w@example.com',        phone: '+1 828 555 0103', created_at: '2024-07-20T00:00:00Z' },
  { id: 'guest-004', property_id: PROPERTY_ID, first_name: 'David',   last_name: 'Lee',      email: 'david.lee@example.com',      phone: '+1 828 555 0104', created_at: '2024-09-10T00:00:00Z' },
  { id: 'guest-005', property_id: PROPERTY_ID, first_name: 'Emma',    last_name: 'Davis',    email: 'emma.davis@example.com',     phone: '+1 828 555 0105', created_at: '2024-11-01T00:00:00Z' },
  { id: 'guest-006', property_id: PROPERTY_ID, first_name: 'Frank',   last_name: 'Martinez', email: 'frank.m@example.com',        phone: '+1 828 555 0106', created_at: '2025-01-05T00:00:00Z' },
]

// ---------------------------------------------------------------------------
// Reservations  (dates relative to today for a realistic dashboard)
// ---------------------------------------------------------------------------

export const MOCK_RESERVATIONS = [
  // Currently checked in — arrives yesterday, leaves in 2 days
  {
    id: 'res-001', property_id: PROPERTY_ID, guest_id: 'guest-001',
    room_ids: ['room-001'],
    check_in: daysFromNow(-1), check_out: daysFromNow(2),
    num_guests: 2, status: 'confirmed', origin: 'direct',
    confirmation_number: 'RES-001', total_due_cents: 55500,
    notes: 'Celebrating anniversary — bottle of wine left in cabin.',
    created_at: daysFromNow(-30) + 'T10:00:00Z',
    guests: { id: 'guest-001', first_name: 'Alice', last_name: 'Johnson', email: 'alice.johnson@example.com', phone: '+1 828 555 0101' },
  },
  // Arriving today
  {
    id: 'res-002', property_id: PROPERTY_ID, guest_id: 'guest-002',
    room_ids: ['room-002'],
    check_in: daysFromNow(0), check_out: daysFromNow(3),
    num_guests: 2, status: 'confirmed', origin: 'direct',
    confirmation_number: 'RES-002', total_due_cents: 43500,
    notes: null,
    created_at: daysFromNow(-14) + 'T14:30:00Z',
    guests: { id: 'guest-002', first_name: 'Bob', last_name: 'Smith', email: 'bob.smith@example.com', phone: '+1 828 555 0102' },
  },
  // Departing today
  {
    id: 'res-003', property_id: PROPERTY_ID, guest_id: 'guest-003',
    room_ids: ['room-003'],
    check_in: daysFromNow(-4), check_out: daysFromNow(0),
    num_guests: 4, status: 'confirmed', origin: 'direct',
    confirmation_number: 'RES-003', total_due_cents: 112000,
    notes: 'Late check-out requested (1pm).',
    created_at: daysFromNow(-45) + 'T09:15:00Z',
    guests: { id: 'guest-003', first_name: 'Carol', last_name: 'Williams', email: 'carol.w@example.com', phone: '+1 828 555 0103' },
  },
  // Upcoming next week
  {
    id: 'res-004', property_id: PROPERTY_ID, guest_id: 'guest-004',
    room_ids: ['room-001'],
    check_in: daysFromNow(7), check_out: daysFromNow(12),
    num_guests: 3, status: 'confirmed', origin: 'direct',
    confirmation_number: 'RES-004', total_due_cents: 92500,
    notes: null,
    created_at: daysFromNow(-20) + 'T11:00:00Z',
    guests: { id: 'guest-004', first_name: 'David', last_name: 'Lee', email: 'david.lee@example.com', phone: '+1 828 555 0104' },
  },
  // Upcoming in 2 weeks
  {
    id: 'res-005', property_id: PROPERTY_ID, guest_id: 'guest-005',
    room_ids: ['room-002'],
    check_in: daysFromNow(14), check_out: daysFromNow(17),
    num_guests: 2, status: 'pending', origin: 'widget',
    confirmation_number: 'RES-005', total_due_cents: 43500,
    notes: 'Requested early check-in if possible.',
    created_at: daysFromNow(-5) + 'T16:45:00Z',
    guests: { id: 'guest-005', first_name: 'Emma', last_name: 'Davis', email: 'emma.davis@example.com', phone: '+1 828 555 0105' },
  },
  // Upcoming next month
  {
    id: 'res-006', property_id: PROPERTY_ID, guest_id: 'guest-006',
    room_ids: ['room-003'],
    check_in: daysFromNow(30), check_out: daysFromNow(37),
    num_guests: 6, status: 'confirmed', origin: 'direct',
    confirmation_number: 'RES-006', total_due_cents: 196000,
    notes: 'Family reunion — extra towels needed.',
    created_at: daysFromNow(-10) + 'T13:00:00Z',
    guests: { id: 'guest-006', first_name: 'Frank', last_name: 'Martinez', email: 'frank.m@example.com', phone: '+1 828 555 0106' },
  },
  // Past — 2 weeks ago
  {
    id: 'res-007', property_id: PROPERTY_ID, guest_id: 'guest-001',
    room_ids: ['room-003'],
    check_in: daysFromNow(-18), check_out: daysFromNow(-14),
    num_guests: 2, status: 'confirmed', origin: 'direct',
    confirmation_number: 'RES-007', total_due_cents: 112000,
    notes: null,
    created_at: daysFromNow(-60) + 'T10:00:00Z',
    guests: { id: 'guest-001', first_name: 'Alice', last_name: 'Johnson', email: 'alice.johnson@example.com', phone: '+1 828 555 0101' },
  },
  // Past — 6 weeks ago
  {
    id: 'res-008', property_id: PROPERTY_ID, guest_id: 'guest-002',
    room_ids: ['room-001'],
    check_in: daysFromNow(-45), check_out: daysFromNow(-41),
    num_guests: 2, status: 'confirmed', origin: 'import',
    confirmation_number: 'RES-008', total_due_cents: 74000,
    notes: null,
    created_at: daysFromNow(-90) + 'T08:30:00Z',
    guests: { id: 'guest-002', first_name: 'Bob', last_name: 'Smith', email: 'bob.smith@example.com', phone: '+1 828 555 0102' },
  },
  // Cancelled
  {
    id: 'res-009', property_id: PROPERTY_ID, guest_id: 'guest-003',
    room_ids: ['room-002'],
    check_in: daysFromNow(5), check_out: daysFromNow(8),
    num_guests: 2, status: 'cancelled', origin: 'direct',
    confirmation_number: 'RES-009', total_due_cents: 43500,
    notes: 'Guest cancelled due to travel changes.',
    created_at: daysFromNow(-25) + 'T15:00:00Z',
    guests: { id: 'guest-003', first_name: 'Carol', last_name: 'Williams', email: 'carol.w@example.com', phone: '+1 828 555 0103' },
  },
]
