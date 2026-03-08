// src/components/widget/widgetSelections.js
// Shared normalization functions for the widget selection model.
// Every selection type (room, room_link, multi_room) produces the same shape
// so downstream components (GuestStep, ReviewStep, handleBook) never branch on type.

/**
 * Normalize a single room to the standard selection shape.
 * @param {object} room - Room object from public-bootstrap
 * @returns {{ type: 'room', id: string, name: string, room_ids: string[], base_rate_cents: number, max_guests: number, description: string|null, amenities: string[], allows_pets: boolean }}
 */
export function normalizeRoom(room) {
  return {
    type: 'room',
    id: room.id,
    name: room.name,
    room_ids: [room.id],
    base_rate_cents: room.base_rate_cents,
    max_guests: room.max_guests,
    description: room.description,
    amenities: room.amenities ?? [],
    allows_pets: room.allows_pets ?? false,
  }
}

/**
 * Normalize a room link to the standard selection shape.
 * @param {object} link - Room link object from public-bootstrap
 * @returns {{ type: 'room_link', id: string, name: string, room_ids: string[], base_rate_cents: number, max_guests: number, description: string|null, amenities: string[], allows_pets: boolean }}
 */
export function normalizeRoomLink(link) {
  return {
    type: 'room_link',
    id: link.id,
    name: link.name,
    room_ids: link.linked_room_ids,
    base_rate_cents: link.base_rate_cents,
    max_guests: link.max_guests,
    description: link.description,
    amenities: [],
    allows_pets: false,
  }
}
