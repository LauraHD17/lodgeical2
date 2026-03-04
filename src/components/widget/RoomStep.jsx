// src/components/widget/RoomStep.jsx

import { useMemo } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { Users, Tag } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'

function formatCents(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function RoomStep({ rooms, checkIn, checkOut, onNext, onBack }) {
  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return 0
    return differenceInCalendarDays(new Date(checkOut + 'T12:00:00'), new Date(checkIn + 'T12:00:00'))
  }, [checkIn, checkOut])

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
      <h2 className="font-heading text-[24px] text-text-primary mb-1">Choose your room</h2>
      <p className="font-body text-[13px] text-text-muted mb-6">
        {format(new Date(checkIn + 'T12:00:00'), 'MMM d')} – {format(new Date(checkOut + 'T12:00:00'), 'MMM d, yyyy')} · {nights} night{nights !== 1 ? 's' : ''}
      </p>

      <div className="flex flex-col gap-4 mb-6">
        {rooms.map(room => (
          <div
            key={room.id}
            className="border border-border rounded-[8px] overflow-hidden bg-surface hover:border-info transition-colors"
          >
            {/* Room image placeholder */}
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
                <Button variant="primary" size="md" onClick={() => onNext(room)}>
                  Select
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button variant="ghost" size="sm" onClick={onBack} className="text-text-secondary">
        ← Back to dates
      </Button>
    </div>
  )
}
