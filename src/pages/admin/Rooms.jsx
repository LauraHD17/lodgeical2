// src/pages/admin/Rooms.jsx
// Rooms management with photo upload (up to 10 photos per room, 4-photo carousel preview).

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, PencilSimple, X, Images, Trash, ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import * as Switch from '@radix-ui/react-switch'

import { supabase } from '@/lib/supabaseClient'
import { useRooms, useCreateRoom, useUpdateRoom } from '@/hooks/useRooms'
import { useProperty } from '@/lib/property/useProperty'
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

const MAX_PHOTOS = 10
const STORAGE_BUCKET = 'room-photos'

// ─── Photo hooks ─────────────────────────────────────────────────────────────

function useRoomPhotos(roomId) {
  return useQuery({
    queryKey: ['room-photos', roomId],
    queryFn: async () => {
      if (!roomId) return []
      const { data, error } = await supabase
        .from('room_photos')
        .select('*')
        .eq('room_id', roomId)
        .order('sort_order')
      if (error) return []
      return data ?? []
    },
    enabled: !!roomId,
  })
}

function useUploadPhoto() {
  const { propertyId } = useProperty()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ roomId, file, sortOrder }) => {
      const ext = file.name.split('.').pop()
      const path = `${propertyId}/${roomId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false })
      if (uploadError) throw uploadError
      const { error: dbError } = await supabase.from('room_photos').insert({
        property_id: propertyId,
        room_id: roomId,
        storage_path: path,
        sort_order: sortOrder,
      })
      if (dbError) throw dbError
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['room-photos', vars.roomId] }),
  })
}

function useDeletePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ photo }) => {
      await supabase.storage.from(STORAGE_BUCKET).remove([photo.storage_path])
      const { error } = await supabase.from('room_photos').delete().eq('id', photo.id)
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['room-photos', vars.photo.room_id] }),
  })
}

function useReorderPhotos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ photos }) => {
      const updates = photos.map((p, i) => ({ id: p.id, sort_order: i }))
      for (const u of updates) {
        await supabase.from('room_photos').update({ sort_order: u.sort_order }).eq('id', u.id)
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['room-photos', vars.roomId] }),
  })
}

// ─── Photo carousel (preview, 4 visible) ────────────────────────────────────

function getPublicUrl(path) {
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data?.publicUrl ?? ''
}

function PhotoCarousel({ photos }) {
  const [start, setStart] = useState(0)
  const visible = photos.slice(start, start + 4)

  if (!photos.length) return null

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setStart(s => Math.max(0, s - 1))}
        disabled={start === 0}
        className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-30"
      >
        <ArrowLeft size={14} />
      </button>
      <div className="flex gap-1.5 flex-1 overflow-hidden">
        {visible.map(photo => (
          <div key={photo.id} className="w-16 h-12 rounded-[4px] overflow-hidden bg-border shrink-0">
            <img
              src={getPublicUrl(photo.storage_path)}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => setStart(s => Math.min(photos.length - 4, s + 1))}
        disabled={start + 4 >= photos.length}
        className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-30"
      >
        <ArrowRight size={14} />
      </button>
    </div>
  )
}

// ─── Photo manager section in edit modal ─────────────────────────────────────

function PhotoManager({ room }) {
  const { data: photos = [] } = useRoomPhotos(room?.id)
  const upload = useUploadPhoto()
  const deletePhoto = useDeletePhoto()
  const reorder = useReorderPhotos()
  const { addToast } = useToast()
  const fileRef = useRef()
  const [dragIdx, setDragIdx] = useState(null)

  async function handleFiles(e) {
    const files = Array.from(e.target.files ?? [])
    const remaining = MAX_PHOTOS - photos.length
    if (files.length > remaining) {
      addToast({ message: `Max ${MAX_PHOTOS} photos. You can add ${remaining} more.`, variant: 'error' })
      return
    }
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) continue
      await upload.mutateAsync({ roomId: room.id, file, sortOrder: photos.length + i })
    }
    addToast({ message: `${files.length} photo(s) uploaded`, variant: 'success' })
    e.target.value = ''
  }

  async function handleDelete(photo) {
    if (!confirm('Remove this photo?')) return
    await deletePhoto.mutateAsync({ photo })
    addToast({ message: 'Photo removed', variant: 'success' })
  }

  function handleDragStart(idx) { setDragIdx(idx) }
  function handleDragOver(e) { e.preventDefault() }
  async function handleDrop(targetIdx) {
    if (dragIdx === null || dragIdx === targetIdx) return
    const reordered = [...photos]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    setDragIdx(null)
    await reorder.mutateAsync({ photos: reordered, roomId: room.id })
  }

  if (!room?.id) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
          Photos ({photos.length}/{MAX_PHOTOS})
        </label>
        {photos.length < MAX_PHOTOS && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
              className="flex items-center gap-1.5 font-body text-[13px] text-info hover:underline disabled:opacity-50"
            >
              <Images size={14} />
              {upload.isPending ? 'Uploading…' : 'Add photos'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFiles}
            />
          </>
        )}
      </div>

      {photos.length === 0 ? (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-[6px] p-6 text-center cursor-pointer hover:border-info transition-colors"
        >
          <Images size={24} className="text-text-muted mx-auto mb-2" />
          <p className="font-body text-[13px] text-text-muted">Click to add photos</p>
          <p className="font-body text-[12px] text-text-muted mt-0.5">Up to {MAX_PHOTOS} photos per room</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(idx)}
              className={cn(
                'relative group aspect-square rounded-[4px] overflow-hidden bg-border cursor-move',
                dragIdx === idx && 'opacity-50 ring-2 ring-info'
              )}
            >
              <img
                src={getPublicUrl(photo.storage_path)}
                alt=""
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => handleDelete(photo)}
                className="absolute top-1 right-1 bg-black bg-opacity-60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
              {idx === 0 && (
                <span className="absolute bottom-1 left-1 bg-black bg-opacity-60 text-white text-[10px] font-body px-1 rounded">
                  Cover
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="font-body text-[12px] text-text-muted">Drag to reorder. First photo is the cover image.</p>
    </div>
  )
}

// ─── Add/Edit Room Modal ──────────────────────────────────────────────────────

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

        {/* Photos — only shown when editing an existing room */}
        {isEdit && <PhotoManager room={roomToEdit} />}

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

// ─── Main page ────────────────────────────────────────────────────────────────

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
            <RoomCard
              key={room.id}
              room={room}
              onEdit={() => setEditRoom(room)}
              onToggleActive={() => toggleActive(room)}
            />
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

function RoomCard({ room, onEdit, onToggleActive }) {
  const { data: photos = [] } = useRoomPhotos(room.id)

  return (
    <FolderCard
      tabLabel={room.name}
      color={room.is_active !== false ? 'primary' : 'warning'}
    >
      <div className="flex flex-col gap-2">
        {/* Photos carousel */}
        {photos.length > 0 && <PhotoCarousel photos={photos} />}

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
              onCheckedChange={onToggleActive}
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
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <PencilSimple size={14} /> Edit
          </Button>
        </div>
      </div>
    </FolderCard>
  )
}
