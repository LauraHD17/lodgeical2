// src/components/widget/RoomLinkCard.jsx

import { Users, Link as LinkIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { fmtMoney as formatCents } from '@/lib/utils'

export function RoomLinkCard({ link, nights, onSelect }) {
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
