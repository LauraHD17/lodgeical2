// src/components/widget/MultiSelectRoomCard.jsx

import { Users, CheckSquare, Square } from '@phosphor-icons/react'
import { fmtMoney as formatCents, cn } from '@/lib/utils'

export function MultiSelectRoomCard({ room, nights, selected, onToggle }) {
  return (
    <div
      className={cn(
        'border rounded-[8px] overflow-hidden bg-surface transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-info focus-visible:outline-none',
        selected ? 'border-info ring-2 ring-info/20' : 'border-border hover:border-info'
      )}
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
