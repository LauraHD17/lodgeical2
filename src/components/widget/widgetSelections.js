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
 * Derives amenities (intersection) and allows_pets (all must allow) from constituent rooms.
 * @param {object} link - Room link object from public-bootstrap
 * @param {object[]} [rooms] - All rooms array, used to derive amenities/allows_pets
 * @returns {{ type: 'room_link', id: string, name: string, room_ids: string[], base_rate_cents: number, max_guests: number, description: string|null, amenities: string[], allows_pets: boolean }}
 */
export function normalizeRoomLink(link, rooms = []) {
  const linkedRooms = rooms.filter(r => link.linked_room_ids.includes(r.id))
  // Amenities: intersection of all constituent rooms (only show what all rooms share)
  const amenities = linkedRooms.length > 0
    ? linkedRooms.reduce((shared, room) => {
      const roomAmenities = new Set(room.amenities ?? [])
      return shared.filter(a => roomAmenities.has(a))
    }, [...(linkedRooms[0].amenities ?? [])])
    : []
  // Pets: only true if all constituent rooms allow pets
  const allowsPets = linkedRooms.length > 0 && linkedRooms.every(r => r.allows_pets)

  return {
    type: 'room_link',
    id: link.id,
    name: link.name,
    room_ids: link.linked_room_ids,
    base_rate_cents: link.base_rate_cents,
    max_guests: link.max_guests,
    description: link.description,
    amenities,
    allows_pets: allowsPets,
  }
}
