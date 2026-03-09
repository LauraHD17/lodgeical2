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
  lat: 35.5951,
  lon: -82.5515,
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
    max_guests: 4,
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
    max_guests: 2,
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
    max_guests: 6,
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

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export const MOCK_CONTACTS = [
  // Vendors
  {
    id: 'contact-001', property_id: PROPERTY_ID, type: 'vendor',
    first_name: 'Jake', last_name: 'Rivers', company: 'Rivers Plumbing',
    category: 'Plumbing', role: 'Licensed Plumber',
    phone: '+1 828 555 0201', email: 'jake@riversplumbing.com',
    notes: 'Available 24/7 for emergencies.', is_active: true,
    created_at: '2024-02-01T00:00:00Z', updated_at: '2024-02-01T00:00:00Z',
  },
  {
    id: 'contact-002', property_id: PROPERTY_ID, type: 'vendor',
    first_name: 'Maria', last_name: 'Torres', company: 'Blue Ridge Cleaning',
    category: 'Cleaning', role: 'Cleaning Supervisor',
    phone: '+1 828 555 0202', email: 'maria@blueridgeclean.com',
    notes: 'Turnover cleans on checkout days.', is_active: true,
    created_at: '2024-02-01T00:00:00Z', updated_at: '2024-02-01T00:00:00Z',
  },
  {
    id: 'contact-003', property_id: PROPERTY_ID, type: 'vendor',
    first_name: 'Rex', last_name: 'Holloway', company: 'Summit Electric',
    category: 'Electrical', role: 'Master Electrician',
    phone: '+1 828 555 0203', email: null,
    notes: null, is_active: true,
    created_at: '2024-03-01T00:00:00Z', updated_at: '2024-03-01T00:00:00Z',
  },
  {
    id: 'contact-004', property_id: PROPERTY_ID, type: 'vendor',
    first_name: 'Paula', last_name: 'Green', company: 'Mountain HVAC Co.',
    category: 'HVAC', role: 'HVAC Technician',
    phone: '+1 828 555 0204', email: 'paula@mountainhvac.com',
    notes: 'Annual service contract.', is_active: false,
    created_at: '2024-01-01T00:00:00Z', updated_at: '2024-06-01T00:00:00Z',
  },
  // Staff
  {
    id: 'contact-005', property_id: PROPERTY_ID, type: 'staff',
    first_name: 'Sam', last_name: 'Hill', company: null,
    category: null, role: 'Head of Housekeeping', access_level: 'manager',
    phone: '+1 828 555 0301', email: 'sam@sunriselodge.com',
    notes: 'Responsible for turnover schedule.', is_active: true,
    created_at: '2024-01-15T00:00:00Z', updated_at: '2024-01-15T00:00:00Z',
  },
  {
    id: 'contact-006', property_id: PROPERTY_ID, type: 'staff',
    first_name: 'Diane', last_name: 'Chen', company: null,
    category: null, role: 'Guest Relations', access_level: 'staff',
    phone: '+1 828 555 0302', email: 'diane@sunriselodge.com',
    notes: null, is_active: true,
    created_at: '2024-03-01T00:00:00Z', updated_at: '2024-03-01T00:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Maintenance tickets
// ---------------------------------------------------------------------------

export const MOCK_MAINTENANCE_TICKETS = [
  {
    id: 'ticket-001', property_id: PROPERTY_ID, room_id: 'room-001',
    title: 'Shower drain is slow', description: 'Drains very slowly — probably hair buildup.',
    category: 'Plumbing', priority: 'high', status: 'open',
    assigned_to: 'contact-001', blocks_booking: false, resolved_at: null,
    created_at: daysFromNow(-3) + 'T09:00:00Z', updated_at: daysFromNow(-3) + 'T09:00:00Z',
    rooms: { id: 'room-001', name: 'Cabin A' },
    contacts: { id: 'contact-001', first_name: 'Jake', last_name: 'Rivers', role: 'Licensed Plumber' },
  },
  {
    id: 'ticket-002', property_id: PROPERTY_ID, room_id: 'room-002',
    title: 'HVAC not cooling properly', description: 'Cabin B AC is running but not reaching set temp.',
    category: 'HVAC', priority: 'urgent', status: 'open',
    assigned_to: null, blocks_booking: true, resolved_at: null,
    created_at: daysFromNow(-1) + 'T14:00:00Z', updated_at: daysFromNow(-1) + 'T14:00:00Z',
    rooms: { id: 'room-002', name: 'Cabin B' },
    contacts: null,
  },
  {
    id: 'ticket-003', property_id: PROPERTY_ID, room_id: 'room-003',
    title: 'Deck light out', description: 'Front deck light bulb needs replacing.',
    category: 'Electrical', priority: 'low', status: 'in_progress',
    assigned_to: 'contact-006', blocks_booking: false, resolved_at: null,
    created_at: daysFromNow(-7) + 'T11:00:00Z', updated_at: daysFromNow(-2) + 'T16:00:00Z',
    rooms: { id: 'room-003', name: 'Mountain Suite' },
    contacts: { id: 'contact-006', first_name: 'Diane', last_name: 'Chen', role: 'Guest Relations' },
  },
  {
    id: 'ticket-004', property_id: PROPERTY_ID, room_id: 'room-001',
    title: 'Refrigerator door seal worn', description: null,
    category: 'Appliance', priority: 'medium', status: 'resolved',
    assigned_to: null, blocks_booking: false, resolved_at: daysFromNow(-5) + 'T10:00:00Z',
    created_at: daysFromNow(-10) + 'T08:00:00Z', updated_at: daysFromNow(-5) + 'T10:00:00Z',
    rooms: { id: 'room-001', name: 'Cabin A' },
    contacts: null,
  },
]

// ---------------------------------------------------------------------------
// Payments (for Financial Insights / Dashboard earnings)
// ---------------------------------------------------------------------------

function monthsAgoDate(n) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return d.toISOString().slice(0, 10)
}

export const MOCK_PAYMENTS = [
  // This month
  { id: 'pay-001', property_id: PROPERTY_ID, amount_cents: 55500, status: 'paid', type: 'charge', created_at: daysFromNow(-2) + 'T12:00:00Z' },
  { id: 'pay-002', property_id: PROPERTY_ID, amount_cents: 43500, status: 'paid', type: 'charge', created_at: daysFromNow(-8) + 'T15:00:00Z' },
  // Last month
  { id: 'pay-003', property_id: PROPERTY_ID, amount_cents: 112000, status: 'paid', type: 'charge', created_at: monthsAgoDate(1) + 'T10:00:00Z' },
  { id: 'pay-004', property_id: PROPERTY_ID, amount_cents: 74000, status: 'paid', type: 'charge', created_at: monthsAgoDate(1) + 'T14:00:00Z' },
  // 2 months ago
  { id: 'pay-005', property_id: PROPERTY_ID, amount_cents: 92500, status: 'paid', type: 'charge', created_at: monthsAgoDate(2) + 'T11:00:00Z' },
  // 3 months ago
  { id: 'pay-006', property_id: PROPERTY_ID, amount_cents: 43500, status: 'paid', type: 'charge', created_at: monthsAgoDate(3) + 'T09:00:00Z' },
  { id: 'pay-007', property_id: PROPERTY_ID, amount_cents: 55500, status: 'paid', type: 'charge', created_at: monthsAgoDate(3) + 'T16:00:00Z' },
  // 4 months ago
  { id: 'pay-008', property_id: PROPERTY_ID, amount_cents: 112000, status: 'paid', type: 'charge', created_at: monthsAgoDate(4) + 'T13:00:00Z' },
  // 5 months ago
  { id: 'pay-009', property_id: PROPERTY_ID, amount_cents: 28000, status: 'paid', type: 'charge', created_at: monthsAgoDate(5) + 'T10:00:00Z' },
  // 6 months ago
  { id: 'pay-010', property_id: PROPERTY_ID, amount_cents: 196000, status: 'paid', type: 'charge', created_at: monthsAgoDate(6) + 'T11:00:00Z' },
]
