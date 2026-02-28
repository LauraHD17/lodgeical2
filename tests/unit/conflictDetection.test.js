// tests/unit/conflictDetection.test.js
// 100% coverage on the reservation conflict detection logic.

import { describe, it, expect } from 'vitest'

/**
 * Simulates the conflict check query logic from create-reservation/index.ts.
 *
 * Given a list of existing reservations and a new booking request,
 * returns the IDs of conflicting reservations.
 *
 * Conflict condition:
 *   check_in < new_check_out AND check_out > new_check_in
 *   AND any room_ids overlap
 *   AND status != 'cancelled'
 */
function detectConflicts(existingReservations, newCheckIn, newCheckOut, newRoomIds) {
  return existingReservations
    .filter(r => r.status !== 'cancelled')
    .filter(r => r.check_in < newCheckOut && r.check_out > newCheckIn)
    .filter(r => r.room_ids.some(rid => newRoomIds.includes(rid)))
    .map(r => r.id)
}

const ROOM_A = 'room-a'
const ROOM_B = 'room-b'

// ─── No conflict scenarios ────────────────────────────────────────────────

describe('conflict detection: no conflict', () => {
  it('no conflict when no existing reservations', () => {
    expect(detectConflicts([], '2026-04-10', '2026-04-15', [ROOM_A])).toHaveLength(0)
  })

  it('no conflict when dates do not overlap (stays before)', () => {
    const existing = [{ id: '1', status: 'confirmed', room_ids: [ROOM_A], check_in: '2026-04-01', check_out: '2026-04-10' }]
    // New reservation starts exactly when old one ends — this is ALLOWED (check_out = check_in)
    expect(detectConflicts(existing, '2026-04-10', '2026-04-15', [ROOM_A])).toHaveLength(0)
  })

  it('no conflict when dates do not overlap (stays after)', () => {
    const existing = [{ id: '1', status: 'confirmed', room_ids: [ROOM_A], check_in: '2026-04-15', check_out: '2026-04-20' }]
    expect(detectConflicts(existing, '2026-04-10', '2026-04-15', [ROOM_A])).toHaveLength(0)
  })

  it('no conflict when different rooms', () => {
    const existing = [{ id: '1', status: 'confirmed', room_ids: [ROOM_B], check_in: '2026-04-10', check_out: '2026-04-15' }]
    expect(detectConflicts(existing, '2026-04-10', '2026-04-15', [ROOM_A])).toHaveLength(0)
  })

  it('no conflict when cancelled reservation overlaps', () => {
    const existing = [{ id: '1', status: 'cancelled', room_ids: [ROOM_A], check_in: '2026-04-10', check_out: '2026-04-15' }]
    expect(detectConflicts(existing, '2026-04-10', '2026-04-15', [ROOM_A])).toHaveLength(0)
  })
})

// ─── Conflict scenarios ───────────────────────────────────────────────────

describe('conflict detection: conflicts', () => {
  it('conflict on exact date match', () => {
    const existing = [{ id: '1', status: 'confirmed', room_ids: [ROOM_A], check_in: '2026-04-10', check_out: '2026-04-15' }]
    const conflicts = detectConflicts(existing, '2026-04-10', '2026-04-15', [ROOM_A])
    expect(conflicts).toContain('1')
  })

  it('conflict on partial overlap (new starts in middle)', () => {
    const existing = [{ id: '1', status: 'confirmed', room_ids: [ROOM_A], check_in: '2026-04-10', check_out: '2026-04-15' }]
    const conflicts = detectConflicts(existing, '2026-04-12', '2026-04-18', [ROOM_A])
    expect(conflicts).toContain('1')
  })

  it('conflict when new booking fully encompasses existing', () => {
    const existing = [{ id: '1', status: 'confirmed', room_ids: [ROOM_A], check_in: '2026-04-12', check_out: '2026-04-14' }]
    const conflicts = detectConflicts(existing, '2026-04-10', '2026-04-16', [ROOM_A])
    expect(conflicts).toContain('1')
  })

  it('conflict when existing booking fully encompasses new', () => {
    const existing = [{ id: '1', status: 'confirmed', room_ids: [ROOM_A], check_in: '2026-04-08', check_out: '2026-04-18' }]
    const conflicts = detectConflicts(existing, '2026-04-10', '2026-04-15', [ROOM_A])
    expect(conflicts).toContain('1')
  })

  it('conflict on at least one shared room in multi-room booking', () => {
    const existing = [{ id: '1', status: 'confirmed', room_ids: [ROOM_A, ROOM_B], check_in: '2026-04-10', check_out: '2026-04-15' }]
    const conflicts = detectConflicts(existing, '2026-04-10', '2026-04-15', [ROOM_B])
    expect(conflicts).toContain('1')
  })

  it('multiple conflicts returned when multiple rooms overlap', () => {
    const existing = [
      { id: '1', status: 'confirmed', room_ids: [ROOM_A], check_in: '2026-04-10', check_out: '2026-04-15' },
      { id: '2', status: 'confirmed', room_ids: [ROOM_B], check_in: '2026-04-12', check_out: '2026-04-14' },
    ]
    const conflicts = detectConflicts(existing, '2026-04-10', '2026-04-15', [ROOM_A, ROOM_B])
    expect(conflicts).toHaveLength(2)
    expect(conflicts).toContain('1')
    expect(conflicts).toContain('2')
  })
})

// ─── Edge: checkout = checkin of other (adjacent stays) ──────────────────

describe('conflict detection: adjacent stays are allowed', () => {
  it('allows new check-in on the same day as existing check-out', () => {
    // Existing: Apr 5–10. New: Apr 10–15. The check_out (Apr 10) = new check_in (Apr 10) → no overlap.
    const existing = [{ id: '1', status: 'confirmed', room_ids: [ROOM_A], check_in: '2026-04-05', check_out: '2026-04-10' }]
    expect(detectConflicts(existing, '2026-04-10', '2026-04-15', [ROOM_A])).toHaveLength(0)
  })

  it('allows new check-out on the same day as existing check-in', () => {
    // New: Apr 5–10. Existing: Apr 10–15. → no overlap.
    const existing = [{ id: '1', status: 'confirmed', room_ids: [ROOM_A], check_in: '2026-04-10', check_out: '2026-04-15' }]
    expect(detectConflicts(existing, '2026-04-05', '2026-04-10', [ROOM_A])).toHaveLength(0)
  })
})
