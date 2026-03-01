// src/pages/admin/Rooms.jsx
// Rooms management page.

import { useState } from 'react'
import { Plus, PencilSimple, X } from '@phosphor-icons/react'
import * as Switch from '@radix-ui/react-switch'

import { useRooms, useCreateRoom, useUpdateRoom } from '@/hooks/useRooms'
import { FolderCard } from '@/components/shared/FolderCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { StatusChip } from '@/components/shared/StatusChip'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

const ROOM_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'suite', label: 'Suite' },
  { value: 'cabin', label: 'Cabin' },
  { value: 'villa', label: 'Villa' },
  { value: 'studio', label: 'Studio' },
  { value: 'other', label: 'Other' },
]

function AddRoomModal({ open, onClose, roomToEdit }) {
  const createRoom = useCreateRoom()
  const updateRoom = useUpdateRoom()
  const { addToast } = useToast()
  const isEdit = !!roomToEdit

  const [form, setForm] = useState(() =>
    roomToEdit
      ? {
          name: roomToEdit.name ?? '',
          type: roomToEdit.type ?? 'standard',
          max_guests: String(roomToEdit.max_guests ?? 2),
          base_rate_cents: String(roomToEdit.base_rate_cents ?? 0),
          description: roomToEdit.description ?? '',
        }
      : { name: '', type: 'standard', max_guests: '2', base_rate_cents: '0', description: '' }
  )
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Room name required'
    if (!form.max_guests || Number(form.max_guests) < 1) e.max_guests = 'Must be at least 1'
    if (!form.base_rate_cents || Number(form.base_rate_cents) < 0) e.base_rate_cents = 'Invalid rate'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    const payload = {
      name: form.name.trim(),
      type: form.type,
      max_guests: Number(form.max_guests),
      base_rate_cents: Math.round(Number(form.base_rate_cents) * 100),
      description: form.description.trim(),
    }
    try {
      if (isEdit) {
        await updateRoom.mutateAsync({ id: roomToEdit.id, ...payload })
        addToast({ message: 'Room updated successfully', variant: 'success' })
      } else {
        await createRoom.mutateAsync(payload)
        addToast({ message: 'Room created successfully', variant: 'success' })
      }
      onClose()
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to save room', variant: 'error' })
    }
  }

  const loading = createRoom.isPending || updateRoom.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Room' : 'Add Room'}
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Room Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          error={errors.name}
        />
        <Select
          label="Room Type"
          options={ROOM_TYPES}
          value={form.type}
          onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
        />
        <Input
          label="Max Guests"
          type="number"
          min={1}
          value={form.max_guests}
          onChange={(e) => setForm((f) => ({ ...f, max_guests: e.target.value }))}
          error={errors.max_guests}
        />
        <div className="flex flex-col">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
            Base Rate ($/night)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={(Number(form.base_rate_cents) / 100).toFixed(2)}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  base_rate_cents: String(Math.round(Number(e.target.value) * 100)),
                }))
              }
              className={cn(
                'h-11 border-[1.5px] border-border rounded-[6px] pl-7 pr-3 font-mono text-[15px] text-text-primary bg-surface-raised w-full',
                'focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2',
                errors.base_rate_cents && 'border-danger'
              )}
            />
          </div>
          {errors.base_rate_cents && (
            <span className="mt-1 text-danger text-[13px]">{errors.base_rate_cents}</span>
          )}
        </div>
        <div className="flex flex-col">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
            Description
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised resize-none focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
          />
        </div>
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="secondary" size="md" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="md" loading={loading} onClick={handleSave}>
            {isEdit ? 'Save Changes' : 'Add Room'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function Rooms() {
  const { data: rooms = [], isLoading } = useRooms()
  const updateRoom = useUpdateRoom()
  const { addToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [editRoom, setEditRoom] = useState(null)

  async function toggleActive(room) {
    try {
      await updateRoom.mutateAsync({ id: room.id, is_active: !room.is_active })
      addToast({
        message: `${room.name} is now ${!room.is_active ? 'active' : 'inactive'}`,
        variant: 'success',
      })
    } catch {
      addToast({ message: 'Failed to update room status', variant: 'error' })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">Rooms</h1>
        <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
          <Plus size={16} weight="bold" /> Add Room
        </Button>
      </div>

      {/* Room Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-border rounded-[8px] h-48" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="font-body text-[16px] text-text-muted">No rooms yet</p>
          <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
            <Plus size={16} weight="bold" /> Add first room
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <FolderCard
              key={room.id}
              tabLabel={room.name}
              color={room.is_active !== false ? 'primary' : 'warning'}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-body text-[13px] text-text-secondary capitalize">
                    {room.type ?? 'Room'}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-semibold font-body px-2 py-0.5 rounded-full',
                      room.is_active !== false
                        ? 'bg-success-bg text-success'
                        : 'bg-warning-bg text-warning'
                    )}
                  >
                    {room.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p className="font-mono text-[14px] text-text-primary">
                  ${((room.base_rate_cents ?? 0) / 100).toFixed(2)}/night
                </p>

                <p className="font-body text-[13px] text-text-muted">
                  Max {room.max_guests ?? 2} guests
                </p>

                {room.description && (
                  <p className="font-body text-[13px] text-text-secondary line-clamp-2">
                    {room.description}
                  </p>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Switch.Root
                      checked={room.is_active !== false}
                      onCheckedChange={() => toggleActive(room)}
                      className={cn(
                        'w-10 h-6 rounded-full transition-colors',
                        room.is_active !== false ? 'bg-success' : 'bg-border'
                      )}
                    >
                      <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
                    </Switch.Root>
                    <span className="font-body text-[13px] text-text-secondary">
                      {room.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditRoom(room)}
                  >
                    <PencilSimple size={14} /> Edit
                  </Button>
                </div>
              </div>
            </FolderCard>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AddRoomModal
        open={addOpen || !!editRoom}
        onClose={() => { setAddOpen(false); setEditRoom(null) }}
        roomToEdit={editRoom}
      />
    </div>
  )
}
