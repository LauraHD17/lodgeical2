// src/components/widget/RoomStep.jsx

import { useState, useMemo } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { fmtMoney as formatCents } from '@/lib/utils'
import { normalizeRoom, normalizeRoomLink } from './widgetSelections'
import { RoomCard } from './RoomCard'
import { MultiSelectRoomCard } from './MultiSelectRoomCard'
import { RoomLinkCard } from './RoomLinkCard'

export function RoomStep({ rooms, roomLinks = [], checkIn, checkOut, onNext, onBack }) {
  const [multiMode, setMultiMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0
    return differenceInCalendarDays(new Date(checkOut + 'T12:00:00'), new Date(checkIn + 'T12:00:00'))
  }, [checkIn, checkOut])

  const hasMultipleRooms = rooms && rooms.length > 1

  const multiSelection = useMemo(() => {
    if (!multiMode || selectedIds.size === 0) return null
    const selected = rooms.filter(r => selectedIds.has(r.id))
    return {
      type: 'multi_room',
      name: selected.map(r => r.name).join(', '),
      room_ids: selected.map(r => r.id),
      base_rate_cents: selected.reduce((sum, r) => sum + r.base_rate_cents, 0),
      max_guests: selected.reduce((sum, r) => sum + r.max_guests, 0),
      rooms: selected,
    }
  }, [multiMode, selectedIds, rooms])

  function toggleRoom(roomId) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(roomId)) next.delete(roomId)
      else next.add(roomId)
      return next
    })
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className="text-center py-8">
        <h2 className="font-heading text-[24px] text-text-primary mb-2">No rooms available</h2>
        <p className="font-body text-text-secondary mb-6">
          No rooms are available for {format(new Date(checkIn + 'T12:00:00'), 'MMM d')} – {format(new Date(checkOut + 'T12:00:00'), 'MMM d, yyyy')}.
        </p>
        <Button variant="secondary" size="md" onClick={onBack}>Change dates</Button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-heading text-[24px] text-text-primary mb-1">
        {multiMode ? 'Select rooms' : 'Choose your room'}
      </h2>
      <p className="font-body text-[13px] text-text-muted mb-4">
        {format(new Date(checkIn + 'T12:00:00'), 'MMM d')} – {format(new Date(checkOut + 'T12:00:00'), 'MMM d, yyyy')} · {nights} night{nights !== 1 ? 's' : ''}
      </p>

      {hasMultipleRooms && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => { setMultiMode(!multiMode); setSelectedIds(new Set()) }}
            className="font-body text-[13px] text-info hover:underline"
          >
            {multiMode ? 'Switch to single room' : 'Need multiple rooms?'}
          </button>
        </div>
      )}

      {roomLinks.length > 0 && !multiMode && (
        <div className="mb-6">
          <h4 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-3">
            Room Packages
          </h4>
          <div className="flex flex-col gap-4">
            {roomLinks.map(link => (
              <RoomLinkCard key={link.id} link={link} nights={nights} onSelect={(l) => onNext(normalizeRoomLink(l, rooms))} />
            ))}
          </div>
        </div>
      )}

      {roomLinks.length > 0 && !multiMode && (
        <h4 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-3">
          Individual Rooms
        </h4>
      )}

      <div className="flex flex-col gap-4 mb-6">
        {rooms.map(room => (
          multiMode ? (
            <MultiSelectRoomCard
              key={room.id}
              room={room}
              nights={nights}
              selected={selectedIds.has(room.id)}
              onToggle={() => toggleRoom(room.id)}
            />
          ) : (
            <RoomCard key={room.id} room={room} nights={nights} onSelect={(r) => onNext(normalizeRoom(r))} />
          )
        ))}
      </div>

      {multiMode && selectedIds.size > 0 && multiSelection && (
        <div className="sticky bottom-4 bg-surface-raised border border-info rounded-[8px] p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body font-semibold text-[15px] text-text-primary">
                {selectedIds.size} room{selectedIds.size !== 1 ? 's' : ''} selected
              </p>
              <p className="font-mono text-[14px] text-text-secondary">
                {formatCents(multiSelection.base_rate_cents)}/night · {formatCents(multiSelection.base_rate_cents * nights)} total
              </p>
            </div>
            <Button variant="primary" size="md" onClick={() => onNext(multiSelection)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={onBack} className="text-text-secondary">
        ← Back to dates
      </Button>
    </div>
  )
}
