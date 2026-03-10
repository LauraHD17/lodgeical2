// _shared/conflicts.ts
// Centralized conflict detection with buffer day support.
// Buffer days expand the blocked range around each reservation per-room.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Shift a YYYY-MM-DD string by N days */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export interface ConflictResult {
  hasConflict: boolean
  conflictingIds: string[]
}

/**
 * Check for booking conflicts, accounting for buffer days on each room.
 *
 * Buffer logic: a reservation on a room with buffer_before=2, buffer_after=3
 * that runs Jan 10–12 blocks Jan 8–15 (2 days before check_in, 3 days after check_out).
 * Both the new booking's buffers and existing bookings' buffers can cause conflicts.
 */
export async function checkConflicts(
  supabase: SupabaseClient,
  opts: {
    propertyId: string
    roomIds: string[]
    checkIn: string
    checkOut: string
    excludeReservationId?: string
    skipBuffers?: boolean
  }
): Promise<ConflictResult> {
  // 1. Fetch buffer days for the requested rooms
  const { data: requestedRooms } = await supabase
    .from('rooms')
    .select('id, buffer_days_before, buffer_days_after')
    .in('id', opts.roomIds)

  const roomBufferMap = new Map<string, { before: number; after: number }>()
  for (const r of (requestedRooms ?? [])) {
    roomBufferMap.set(r.id, {
      before: opts.skipBuffers ? 0 : (r.buffer_days_before ?? 0),
      after: opts.skipBuffers ? 0 : (r.buffer_days_after ?? 0),
    })
  }

  // 2. Compute the widest possible date range to query (max buffers on either side)
  const maxBefore = Math.max(0, ...[...roomBufferMap.values()].map(b => b.before))
  const maxAfter = Math.max(0, ...[...roomBufferMap.values()].map(b => b.after))

  // We need to find any reservation whose buffered range overlaps our buffered range.
  // Query wider than needed, then filter precisely.
  const queryStart = shiftDate(opts.checkIn, -(maxBefore + 30)) // 30 extra for existing res buffers
  const queryEnd = shiftDate(opts.checkOut, maxAfter + 30)

  let query = supabase
    .from('reservations')
    .select('id, room_ids, check_in, check_out')
    .eq('property_id', opts.propertyId)
    .neq('status', 'cancelled')
    .lt('check_in', queryEnd)
    .gt('check_out', queryStart)

  if (opts.excludeReservationId) {
    query = query.neq('id', opts.excludeReservationId)
  }

  const { data: candidates } = await query

  if (!candidates || candidates.length === 0) {
    return { hasConflict: false, conflictingIds: [] }
  }

  // 3. Fetch buffer days for all rooms involved in candidate reservations
  const allCandidateRoomIds = [...new Set(candidates.flatMap(r => r.room_ids ?? []))]
  const missingRoomIds = allCandidateRoomIds.filter(id => !roomBufferMap.has(id))

  if (missingRoomIds.length > 0) {
    const { data: extraRooms } = await supabase
      .from('rooms')
      .select('id, buffer_days_before, buffer_days_after')
      .in('id', missingRoomIds)
    for (const r of (extraRooms ?? [])) {
      roomBufferMap.set(r.id, {
        before: opts.skipBuffers ? 0 : (r.buffer_days_before ?? 0),
        after: opts.skipBuffers ? 0 : (r.buffer_days_after ?? 0),
      })
    }
  }

  // 4. Check each candidate for actual conflict (per shared room, with buffers)
  const conflictingIds: string[] = []

  for (const existing of candidates) {
    const sharedRoomIds = (existing.room_ids ?? []).filter((rid: string) =>
      opts.roomIds.includes(rid)
    )
    if (sharedRoomIds.length === 0) continue

    // For each shared room, check if the buffered ranges overlap
    for (const roomId of sharedRoomIds) {
      const buf = roomBufferMap.get(roomId) ?? { before: 0, after: 0 }

      // New booking's effective blocked range for this room
      const newStart = shiftDate(opts.checkIn, -buf.before)
      const newEnd = shiftDate(opts.checkOut, buf.after)

      // Existing booking's effective blocked range for this room
      const existStart = shiftDate(existing.check_in, -buf.before)
      const existEnd = shiftDate(existing.check_out, buf.after)

      // Overlap check: newStart < existEnd AND newEnd > existStart
      if (newStart < existEnd && newEnd > existStart) {
        conflictingIds.push(existing.id)
        break // no need to check other rooms for this reservation
      }
    }
  }

  return {
    hasConflict: conflictingIds.length > 0,
    conflictingIds,
  }
}
