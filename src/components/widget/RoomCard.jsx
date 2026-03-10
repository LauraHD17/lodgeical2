// src/components/widget/RoomCard.jsx

import { Users, Tag } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { fmtMoney as formatCents } from '@/lib/utils'

export function RoomCard({ room, nights, onSelect }) {
  return (
    <div className="border border-border rounded-[8px] overflow-hidden bg-surface hover:border-info transition-colors">
      <div className="h-36 bg-background flex items-center justify-center">
        <span className="font-body text-[13px] text-text-muted">{room.type}</span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-body font-semibold text-[18px] text-text-primary">{room.name}</h3>
            {room.base_rate_cents > 0 && (
              <p className="font-mono text-[14px] text-text-secondary">
                From ${(room.base_rate_cents / 100).toFixed(2)}/night
              </p>
            )}
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
