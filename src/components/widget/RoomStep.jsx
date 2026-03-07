// src/components/widget/RoomStep.jsx

import { useState, useMemo } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { Users, Tag, Link as LinkIcon, CheckSquare, Square } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { fmtMoney as formatCents } from '@/lib/utils'

/**
 * Normalize a single room to the standard selection shape.
 * All selection types (room, room_link, multi_room) produce this shape
 * so downstream components never branch on selection type.
 */
function normalizeRoom(room) {
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

function normalizeRoomLink(link) {
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

function RoomCard({ room, nights, onSelect }) {
  return (
    <div className="border border-border rounded-[8px] overflow-hidden bg-surface hover:border-info transition-colors">
      <div className="h-36 bg-background flex items-center justify-center">
        <span className="font-body text-[13px] text-text-muted">{room.type}</span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-body font-semibold text-[18px] text-text-primary">{room.name}</h3>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1 font-body text-[13px] text-text-secondary">
                <Users size={13} /> Up to {room.max_guests} guest{room.max_guests !== 1 ? 's' : ''}
              </span>
              {room.allows_pets && (
                <span className="inline-flex items-center font-body text-[11px] font-semibold text-success bg-success-bg border border-success rounded-full px-2 py-0.5">
                  Pet-friendly
                </span>
              )}
            </div>
            {room.description && (
              <p className="font-body text-[13px] text-text-secondary mt-2 line-clamp-2">{room.description}</p>
            )}
            {room.amenities?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {room.amenities.slice(0, 4).map(a => (
                  <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface border border-border rounded-full text-[11px] font-body text-text-secondary">
                    <Tag size={10} /> {a}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-[20px] text-text-primary">{formatCents(room.base_rate_cents)}</p>
            <p className="font-body text-[12px] text-text-muted">per night</p>
            <p className="font-mono text-[13px] text-text-secondary mt-1">
              {formatCents(room.base_rate_cents * nights)} total
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" size="md" onClick={() => onSelect(room)}>
            Select
          </Button>
        </div>
      </div>
    </div>
  )
}

function MultiSelectRoomCard({ room, nights, selected, onToggle }) {
  return (
    <div
      className={`border rounded-[8px] overflow-hidden bg-surface transition-colors cursor-pointer ${
        selected ? 'border-info ring-2 ring-info/20' : 'border-border hover:border-info'
      }`}
      onClick={onToggle}
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle() } }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="mt-1 shrink-0 text-info">
              {selected ? <CheckSquare size={20} weight="fill" /> : <Square size={20} />}
            </div>
            <div>
              <h3 className="font-body font-semibold text-[18px] text-text-primary">{room.name}</h3>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 font-body text-[13px] text-text-secondary">
                  <Users size={13} /> Up to {room.max_guests} guest{room.max_guests !== 1 ? 's' : ''}
                </span>
                {room.allows_pets && (
                  <span className="inline-flex items-center font-body text-[11px] font-semibold text-success bg-success-bg border border-success rounded-full px-2 py-0.5">
                    Pet-friendly
                  </span>
                )}
              </div>
              {room.description && (
                <p className="font-body text-[13px] text-text-secondary mt-2 line-clamp-2">{room.description}</p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-[20px] text-text-primary">{formatCents(room.base_rate_cents)}</p>
            <p className="font-body text-[12px] text-text-muted">per night</p>
            <p className="font-mono text-[13px] text-text-secondary mt-1">
              {formatCents(room.base_rate_cents * nights)} total
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function RoomLinkCard({ link, nights, onSelect }) {
  return (
    <div className="border border-border rounded-[8px] overflow-hidden bg-surface hover:border-info transition-colors">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <LinkIcon size={16} className="text-info" />
              <h3 className="font-body font-semibold text-[18px] text-text-primary">{link.name}</h3>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1 font-body text-[13px] text-text-secondary">
                <Users size={13} /> Up to {link.max_guests} guest{link.max_guests !== 1 ? 's' : ''}
              </span>
              <span className="inline-flex items-center font-body text-[11px] font-semibold text-info bg-info-bg border border-info rounded-full px-2 py-0.5">
                {link.linked_room_ids.length} rooms combined
              </span>
            </div>
            {link.description && (
              <p className="font-body text-[13px] text-text-secondary mt-2 line-clamp-2">{link.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-[20px] text-text-primary">{formatCents(link.base_rate_cents)}</p>
            <p className="font-body text-[12px] text-text-muted">per night</p>
            <p className="font-mono text-[13px] text-text-secondary mt-1">
              {formatCents(link.base_rate_cents * nights)} total
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" size="md" onClick={() => onSelect(link)}>
            Select
          </Button>
        </div>
      </div>
    </div>
  )
}

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

  function handleSingleSelect(room) {
    onNext(normalizeRoom(room))
  }

  function handleRoomLinkSelect(link) {
    onNext(normalizeRoomLink(link))
  }

  function handleMultiContinue() {
    if (multiSelection) onNext(multiSelection)
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

      {/* Multi-select toggle */}
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

      {/* Room links (packages) — only in single-select mode */}
      {roomLinks.length > 0 && !multiMode && (
        <div className="mb-6">
          <h4 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-3">
            Room Packages
          </h4>
          <div className="flex flex-col gap-4">
            {roomLinks.map(link => (
              <RoomLinkCard key={link.id} link={link} nights={nights} onSelect={handleRoomLinkSelect} />
            ))}
          </div>
        </div>
      )}

      {/* Individual rooms heading when room links are present */}
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
            <RoomCard key={room.id} room={room} nights={nights} onSelect={handleSingleSelect} />
          )
        ))}
      </div>

      {/* Multi-select floating summary */}
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
            <Button variant="primary" size="md" onClick={handleMultiContinue}>
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
