// src/pages/admin/Rates.jsx
// Per-room rate editor with inline editing.

import { useState } from 'react'
import { PencilSimple, Check, X } from '@phosphor-icons/react'

import { useRooms, useUpdateRoom } from '@/hooks/useRooms'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

function RateRow({ room }) {
  const updateRoom = useUpdateRoom()
  const { addToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [rateValue, setRateValue] = useState(
    ((room.base_rate_cents ?? 0) / 100).toFixed(2)
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateRoom.mutateAsync({
        id: room.id,
        base_rate_cents: Math.round(Number(rateValue) * 100),
      })
      addToast({ message: `Rate updated for ${room.name}`, variant: 'success' })
      setEditing(false)
    } catch {
      addToast({ message: 'Failed to update rate', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') {
      setRateValue(((room.base_rate_cents ?? 0) / 100).toFixed(2))
      setEditing(false)
    }
  }

  return (
    <tr className="border-b border-border hover:bg-info-bg transition-colors">
      {/* Room Name */}
      <td className="px-4 py-4 font-body text-[15px] text-text-primary">
        {room.name}
      </td>

      {/* Base Rate — inline editable */}
      <td className="px-4 py-4">
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[15px] text-text-muted">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className={cn(
                'w-28 h-9 border-[1.5px] border-info rounded-[6px] px-2 font-mono text-[15px] text-text-primary bg-surface-raised',
                'focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1'
              )}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-success hover:opacity-80 transition-opacity"
              title="Save"
            >
              <Check size={18} weight="bold" />
            </button>
            <button
              onClick={() => {
                setRateValue(((room.base_rate_cents ?? 0) / 100).toFixed(2))
                setEditing(false)
              }}
              className="text-text-muted hover:text-danger transition-colors"
              title="Cancel"
            >
              <X size={18} weight="bold" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 group"
            title="Click to edit rate"
          >
            <span className="font-mono text-[15px] text-text-primary">
              ${((room.base_rate_cents ?? 0) / 100).toFixed(2)}
            </span>
            <PencilSimple
              size={14}
              className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </button>
        )}
      </td>

      {/* Max Guests */}
      <td className="px-4 py-4 font-mono text-[14px] text-text-secondary">
        {room.max_guests ?? '—'}
      </td>

      {/* Room Type */}
      <td className="px-4 py-4 font-body text-[14px] text-text-secondary capitalize">
        {room.type ?? '—'}
      </td>
    </tr>
  )
}

export default function Rates() {
  const { data: rooms = [], isLoading } = useRooms()

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">Rates</h1>
      </div>

      <p className="font-body text-[14px] text-text-secondary">
        Click on a rate value to edit it inline. Press Enter to save or Escape to cancel.
      </p>

      {/* Rate Table */}
      <div className="border border-border rounded-[8px] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-text-primary">
              <th className="px-4 py-3 text-left font-body text-[13px] uppercase tracking-wider text-white font-semibold">
                Room Name
              </th>
              <th className="px-4 py-3 text-left font-body text-[13px] uppercase tracking-wider text-white font-semibold">
                Base Rate / Night
              </th>
              <th className="px-4 py-3 text-left font-body text-[13px] uppercase tracking-wider text-white font-semibold">
                Max Guests
              </th>
              <th className="px-4 py-3 text-left font-body text-[13px] uppercase tracking-wider text-white font-semibold">
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-border">
                    {[1, 2, 3, 4].map((j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="animate-pulse bg-border rounded h-8 w-full" />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ) : rooms.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <p className="font-body text-[15px] text-text-muted">
                    No rooms found. Add rooms in the Rooms section.
                  </p>
                </td>
              </tr>
            ) : (
              rooms.map((room) => <RateRow key={room.id} room={room} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
