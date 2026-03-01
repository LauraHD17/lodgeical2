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
}
