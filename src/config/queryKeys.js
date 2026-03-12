// src/config/queryKeys.js
// Centralized TanStack Query key factories.
// All hooks import from here — never define query keys inline.

export const queryKeys = {
  reservations: {
    all: ['reservations'],
    list: (filters) => ['reservations', 'list', filters],
    detail: (id) => ['reservations', 'detail', id],
    calendar: (year, month) => ['reservations', 'calendar', year, month],
  },

  rooms: {
    all: ['rooms'],
    list: () => ['rooms', 'list'],
    detail: (id) => ['rooms', 'detail', id],
    availability: (checkIn, checkOut) => ['rooms', 'availability', checkIn, checkOut],
  },

  guests: {
    all: ['guests'],
    list: (search) => ['guests', 'list', search],
    detail: (id) => ['guests', 'detail', id],
    byEmail: (email) => ['guests', 'byEmail', email],
    reservations: (guestId) => ['guests', 'reservations', guestId],
  },

  settings: {
    all: ['settings'],
    property: (propertyId) => ['settings', 'property', propertyId],
  },

  payments: {
    all: ['payments'],
    list: (filters) => ['payments', 'list', filters],
    detail: (id) => ['payments', 'detail', id],
  },

  paymentSummary: {
    all: ['paymentSummary'],
    byReservation: (reservationId) => ['paymentSummary', 'byReservation', reservationId],
  },

  property: {
    all: ['property'],
    current: () => ['property', 'current'],
  },

  financials: {
    all: ['financials'],
    monthly: (propertyId, year) => ['financials', 'monthly', propertyId, year],
  },

  maintenance: {
    all: ['maintenance'],
    list: (propertyId, filters) => ['maintenance', 'list', propertyId, filters],
    open: (propertyId) => ['maintenance', 'open', propertyId],
  },

  contacts: {
    all: ['contacts'],
    list: (propertyId, type) => ['contacts', 'list', propertyId, type],
    staff: (propertyId) => ['contacts', 'staff', propertyId],
  },

  inquiries: {
    all: ['inquiries'],
    list: (propertyId, filters) => ['inquiries', 'list', propertyId, filters],
  },

  weather: {
    current: (lat, lon) => ['weather', 'current', lat, lon],
  },

  emailLogs: {
    all: ['emailLogs'],
    list: (propertyId) => ['emailLogs', 'list', propertyId],
  },

  guestPortal: {
    all: ['guestPortal'],
    byEmail: (email) => ['guestPortal', 'byEmail', email],
  },

  guestActivity: {
    all: ['guestActivity'],
    list: (propertyId) => ['guestActivity', 'list', propertyId],
  },

  onboarding: {
    all: ['onboarding'],
    byProperty: (propertyId) => ['onboarding', 'byProperty', propertyId],
  },

  roomLinks: {
    all: ['roomLinks'],
    list: (propertyId) => ['roomLinks', 'list', propertyId],
  },

  importBatches: {
    all: ['importBatches'],
    latest: (propertyId) => ['importBatches', 'latest', propertyId],
    list: (propertyId) => ['importBatches', 'list', propertyId],
  },

  tags: {
    all: ['tags'],
    suggestions: (propertyId) => ['tags', 'suggestions', propertyId],
  },

  documents: {
    all: ['documents'],
    list: (propertyId) => ['documents', 'list', propertyId],
    byGuest: (guestId) => ['documents', 'byGuest', guestId],
    byReservation: (reservationId) => ['documents', 'byReservation', reservationId],
    unattached: (propertyId) => ['documents', 'unattached', propertyId],
  },

  reconciliation: {
    all: ['reconciliation'],
    list: (propertyId) => ['reconciliation', 'list', propertyId],
  },

  reports: {
    all: ['reports'],
    ranged: (propertyId, dateFrom, dateTo, fetchFrom) => ['reports', 'ranged', propertyId, fetchFrom ?? dateFrom, dateTo],
  },

  scheduledMessages: {
    all: ['scheduledMessages'],
    byReservation: (reservationId) => ['scheduledMessages', 'byReservation', reservationId],
  },

  emailTemplates: {
    all: ['emailTemplates'],
    byType: (propertyId, templateType) => ['emailTemplates', 'byType', propertyId, templateType],
  },
}
