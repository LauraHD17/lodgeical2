// tests/unit/widgetSelections.test.js
// Tests for the widget selection normalization logic.

import { describe, it, expect } from 'vitest'
import { normalizeRoom, normalizeRoomLink } from '../../src/components/widget/widgetSelections.js'

// ─── normalizeRoom ──────────────────────────────────────────────────────────

describe('normalizeRoom', () => {
  const ROOM = {
    id: 'room-1',
    name: 'Garden Suite',
    base_rate_cents: 15000,
    max_guests: 4,
    description: 'A lovely garden suite',
    amenities: ['WiFi', 'AC'],
    allows_pets: true,
  }

  it('produces the standard selection shape', () => {
    const result = normalizeRoom(ROOM)
    expect(result).toEqual({
      type: 'room',
      id: 'room-1',
      name: 'Garden Suite',
      room_ids: ['room-1'],
      base_rate_cents: 15000,
      max_guests: 4,
      description: 'A lovely garden suite',
      amenities: ['WiFi', 'AC'],
      allows_pets: true,
    })
  })

  it('room_ids is always a single-element array of the room id', () => {
    const result = normalizeRoom(ROOM)
    expect(result.room_ids).toHaveLength(1)
    expect(result.room_ids[0]).toBe(ROOM.id)
  })

  it('defaults amenities to empty array when missing', () => {
    const room = { ...ROOM, amenities: undefined }
    expect(normalizeRoom(room).amenities).toEqual([])
  })

  it('defaults allows_pets to false when missing', () => {
    const room = { ...ROOM, allows_pets: undefined }
    expect(normalizeRoom(room).allows_pets).toBe(false)
  })
})

// ─── normalizeRoomLink ──────────────────────────────────────────────────────

describe('normalizeRoomLink', () => {
  const ROOMS = [
    { id: 'r1', name: 'Room A', amenities: ['WiFi', 'AC', 'TV'], allows_pets: true },
    { id: 'r2', name: 'Room B', amenities: ['WiFi', 'AC'], allows_pets: true },
    { id: 'r3', name: 'Room C', amenities: ['WiFi'], allows_pets: false },
  ]

  const LINK = {
    id: 'link-1',
    name: 'Family Package',
    linked_room_ids: ['r1', 'r2'],
    base_rate_cents: 25000,
    max_guests: 8,
    description: 'Two rooms for the whole family',
  }

  it('produces the standard selection shape with type room_link', () => {
    const result = normalizeRoomLink(LINK, ROOMS)
    expect(result.type).toBe('room_link')
    expect(result.id).toBe('link-1')
    expect(result.name).toBe('Family Package')
    expect(result.room_ids).toEqual(['r1', 'r2'])
    expect(result.base_rate_cents).toBe(25000)
    expect(result.max_guests).toBe(8)
  })

  it('amenities are the intersection of constituent rooms', () => {
    const result = normalizeRoomLink(LINK, ROOMS)
    // r1 has [WiFi, AC, TV], r2 has [WiFi, AC] → intersection is [WiFi, AC]
    expect(result.amenities).toEqual(['WiFi', 'AC'])
  })

  it('amenities intersection with 3 rooms keeps only shared', () => {
    const link = { ...LINK, linked_room_ids: ['r1', 'r2', 'r3'] }
    const result = normalizeRoomLink(link, ROOMS)
    // r1∩r2∩r3 = [WiFi]
    expect(result.amenities).toEqual(['WiFi'])
  })

  it('allows_pets is true only when ALL linked rooms allow pets', () => {
    const result = normalizeRoomLink(LINK, ROOMS)
    // r1 + r2 both allow pets
    expect(result.allows_pets).toBe(true)
  })

  it('allows_pets is false when any linked room disallows pets', () => {
    const link = { ...LINK, linked_room_ids: ['r1', 'r3'] }
    const result = normalizeRoomLink(link, ROOMS)
    // r3 does not allow pets
    expect(result.allows_pets).toBe(false)
  })

  it('defaults to empty amenities and false pets when rooms array empty', () => {
    const result = normalizeRoomLink(LINK, [])
    expect(result.amenities).toEqual([])
    expect(result.allows_pets).toBe(false)
  })

  it('defaults to empty amenities when rooms param omitted', () => {
    const result = normalizeRoomLink(LINK)
    expect(result.amenities).toEqual([])
    expect(result.allows_pets).toBe(false)
  })
})
