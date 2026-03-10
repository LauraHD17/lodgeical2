// src/pages/admin/Rooms.jsx
// Rooms management — inline expandable cards with drag-to-reorder.
// Drag handle reorders rooms (persisted via sort_order); order reflects in calendar.

import { useState, useEffect, useRef } from 'react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, X, Images, Trash, ArrowLeft, ArrowRight,
  CaretDown, CaretUp, DotsSixVertical, Check,
} from '@phosphor-icons/react'
import * as Switch from '@radix-ui/react-switch'

import { supabase } from '@/lib/supabaseClient'
import { useRooms, useCreateRoom, useUpdateRoom } from '@/hooks/useRooms'
import { useProperty } from '@/lib/property/useProperty'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

const ROOM_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'suite',    label: 'Suite' },
  { value: 'cabin',   label: 'Cabin' },
  { value: 'villa',   label: 'Villa' },
  { value: 'studio',  label: 'Studio' },
  { value: 'other',   label: 'Other' },
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

// ─── Photo manager section ────────────────────────────────────────────────────

function PhotoManager({ room }) {
  const { data: photos = [] } = useRoomPhotos(room?.id)
  const upload = useUploadPhoto()
  const deletePhoto = useDeletePhoto()
  const reorder = useReorderPhotos()
  const { addToast } = useToast()
  const fileRef = useRef()
  const [dragIdx, setDragIdx] = useState(null)
  const [confirmState, setConfirmState] = useState(null)

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

  function handleDelete(photo) {
    setConfirmState({
      title: 'Remove this photo?',
      description: 'This photo will be permanently removed from the room.',
      onConfirm: async () => {
        await deletePhoto.mutateAsync({ photo })
        addToast({ message: 'Photo removed', variant: 'success' })
      },
    })
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
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
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

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        description={confirmState?.description}
        onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null) }}
        onCancel={() => setConfirmState(null)}
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  )
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function initForm(room) {
  if (!room) {
    return {
      name: '', type: 'standard', max_guests: '2',
      base_rate_cents: '0', description: '',
      allows_pets: false, linkable: false,
      cleaning_fee_dollars: '', pet_fee_dollars: '',
      buffer_days_before: '0', buffer_days_after: '0',
    }
  }
  return {
    name: room.name ?? '',
    type: room.type ?? 'standard',
    max_guests: String(room.max_guests ?? 2),
    base_rate_cents: String(room.base_rate_cents ?? 0),
    description: room.description ?? '',
    allows_pets: room.allows_pets ?? false,
    linkable: room.linkable ?? false,
    cleaning_fee_dollars: room.cleaning_fee_cents != null ? (room.cleaning_fee_cents / 100).toFixed(2) : '',
    pet_fee_dollars: room.pet_fee_cents != null ? (room.pet_fee_cents / 100).toFixed(2) : '',
    buffer_days_before: String(room.buffer_days_before ?? 0),
    buffer_days_after: String(room.buffer_days_after ?? 0),
  }
}

// ─── RoomRow — collapsed header + expandable inline form ──────────────────────

function RoomRow({ room, isNew, onSaved, onCancel, dragHandlers }) {
  const [open, setOpen] = useState(!!isNew)
  const [form, setForm] = useState(() => initForm(room))
  const [errors, setErrors] = useState({})
  const createRoom = useCreateRoom()
  const updateRoom = useUpdateRoom()
  const { addToast } = useToast()
  const { data: photos = [] } = useRoomPhotos(room?.id)

  // Keep form in sync if room prop changes (e.g., after save)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync form state with room prop
    if (room && !open) setForm(initForm(room))
  }, [room, open])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Room name required'
    if (!form.max_guests || Number(form.max_guests) < 1) e.max_guests = 'Must be at least 1'
    if (form.base_rate_cents === '' || Number(form.base_rate_cents) < 0) e.base_rate_cents = 'Invalid rate'
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
      allows_pets: form.allows_pets,
      linkable: form.linkable,
      cleaning_fee_cents: form.cleaning_fee_dollars === '' ? null : Math.round(Number(form.cleaning_fee_dollars) * 100),
      pet_fee_cents: form.pet_fee_dollars === '' ? null : Math.round(Number(form.pet_fee_dollars) * 100),
      buffer_days_before: Number(form.buffer_days_before) || 0,
      buffer_days_after: Number(form.buffer_days_after) || 0,
    }
    try {
      if (isNew) {
        await createRoom.mutateAsync(payload)
        addToast({ message: 'Room created', variant: 'success' })
        onSaved?.()
      } else {
        await updateRoom.mutateAsync({ id: room.id, ...payload })
        addToast({ message: 'Room updated', variant: 'success' })
        setOpen(false)
      }
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to save room', variant: 'error' })
    }
  }

  async function handleToggleActive() {
    try {
      await updateRoom.mutateAsync({ id: room.id, is_active: !room.is_active })
      addToast({ message: `${room.name} is now ${!room.is_active ? 'active' : 'inactive'}`, variant: 'success' })
    } catch {
      addToast({ message: 'Failed to update room status', variant: 'error' })
    }
  }

  function handleCancel() {
    if (isNew) {
      onCancel?.()
    } else {
      setForm(initForm(room))
      setErrors({})
      setOpen(false)
    }
  }

  const saving = createRoom.isPending || updateRoom.isPending
  const isActive = isNew ? true : room.is_active !== false

  return (
    <div
      className={cn(
        'border border-border rounded-[10px] overflow-hidden bg-surface-raised',
        dragHandlers?.isDragging && 'opacity-50 ring-2 ring-info'
      )}
      onDragOver={dragHandlers?.onDragOver}
      onDrop={dragHandlers?.onDrop}
    >
      {/* Collapsed header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Drag handle — only for existing rooms */}
        {!isNew && (
          <div
            draggable
            onDragStart={dragHandlers?.onDragStart}
            className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-secondary shrink-0 touch-none"
            title="Drag to reorder"
          >
            <DotsSixVertical size={18} />
          </div>
        )}

        {/* Room name + meta */}
        <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
          <span className="font-body font-semibold text-[15px] text-text-primary truncate">
            {isNew ? 'New Room' : (room.name || 'Untitled')}
          </span>
          {!isNew && (
            <>
              <span className="font-mono text-[13px] text-text-secondary">
                ${((room.base_rate_cents ?? 0) / 100).toFixed(2)}/night
              </span>
              <span className="font-body text-[12px] text-text-secondary capitalize text-text-muted">
                {room.type ?? 'room'} · max {room.max_guests ?? 2}
              </span>
              {/* photo count */}
              {photos.length > 0 && (
                <span className="font-body text-[11px] text-text-muted">
                  {photos.length} photo{photos.length !== 1 ? 's' : ''}
                </span>
              )}
            </>
          )}
        </div>

        {/* Status badge + active toggle (existing rooms only) */}
        {!isNew && !open && (
          <span
            className={cn(
              'text-[11px] font-semibold font-body px-2 py-0.5 rounded-full shrink-0',
              isActive ? 'bg-success-bg text-success' : 'bg-warning-bg text-warning'
            )}
          >
            {isActive ? 'Active' : 'Inactive'}
          </span>
        )}

        {/* Expand / collapse toggle */}
        <button
          onClick={() => !isNew && setOpen(o => !o)}
          className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
          title={open ? 'Collapse' : 'Expand to edit'}
        >
          {open ? <CaretUp size={16} /> : <CaretDown size={16} />}
        </button>
      </div>

      {/* Expanded form */}
      {open && (
        <div className="border-t border-border px-5 py-5 flex flex-col gap-4">
          <Input
            label="Room Name"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            error={errors.name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Room Type"
              options={ROOM_TYPES}
              value={form.type}
              onValueChange={v => set('type', v)}
            />
            <Input
              label="Max Guests"
              type="number"
              min={1}
              value={form.max_guests}
              onChange={e => set('max_guests', e.target.value)}
              error={errors.max_guests}
            />
          </div>

          {/* Base rate */}
          <div className="flex flex-col">
            <label htmlFor="room-base-rate" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
              Base Rate ($/night)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">$</span>
              <input
                id="room-base-rate"
                type="number"
                min={0}
                step={0.01}
                value={(Number(form.base_rate_cents) / 100).toFixed(2)}
                onChange={e => set('base_rate_cents', String(Math.round(Number(e.target.value) * 100)))}
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

          {/* Description */}
          <div className="flex flex-col">
            <label htmlFor="room-description" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
              Description
            </label>
            <textarea
              id="room-description"
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised resize-none focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
            />
          </div>

          {/* Pet-friendly toggle */}
          <div className="flex items-center justify-between p-3 border border-border rounded-[6px] bg-surface">
            <div>
              <p className="font-body font-semibold text-[14px] text-text-primary">Pet-friendly room</p>
              <p className="font-body text-[12px] text-text-muted mt-0.5">Shown to guests on the booking widget</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch.Root
                checked={form.allows_pets}
                onCheckedChange={v => set('allows_pets', v)}
                className={cn('w-10 h-6 rounded-full transition-colors', form.allows_pets ? 'bg-success' : 'bg-border')}
              >
                <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
              </Switch.Root>
              <span className="font-body text-[13px] text-text-secondary">{form.allows_pets ? 'Yes' : 'No'}</span>
            </div>
          </div>

          {/* Linkable toggle */}
          <div className="flex items-center justify-between p-3 border border-border rounded-[6px] bg-surface">
            <div>
              <p className="font-body font-semibold text-[14px] text-text-primary">Linkable</p>
              <p className="font-body text-[12px] text-text-muted mt-0.5">Allow this room to be linked with other rooms as a combined listing</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch.Root
                checked={form.linkable}
                onCheckedChange={v => set('linkable', v)}
                className={cn('w-10 h-6 rounded-full transition-colors', form.linkable ? 'bg-info' : 'bg-border')}
              >
                <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
              </Switch.Root>
              <span className="font-body text-[13px] text-text-secondary">{form.linkable ? 'Yes' : 'No'}</span>
            </div>
          </div>

          {/* Buffer days */}
          <div className="flex flex-col gap-3 p-3 border border-border rounded-[6px] bg-surface">
            <div>
              <p className="font-body font-semibold text-[14px] text-text-primary">Buffer Days</p>
              <p className="font-body text-[12px] text-text-muted mt-0.5">Block extra days before and after each reservation for room prep and turnover</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Days Before"
                type="number"
                min={0}
                max={30}
                value={form.buffer_days_before}
                onChange={e => set('buffer_days_before', e.target.value)}
              />
              <Input
                label="Days After"
                type="number"
                min={0}
                max={30}
                value={form.buffer_days_after}
                onChange={e => set('buffer_days_after', e.target.value)}
              />
            </div>
          </div>

          {/* Fee overrides */}
          <div className="flex flex-col gap-3 p-3 border border-border rounded-[6px] bg-surface">
            <p className="font-body font-semibold text-[13px] text-text-secondary uppercase tracking-[0.06em]">
              Fee Overrides <span className="normal-case font-normal text-text-muted">(leave blank to use property default)</span>
            </p>
            <div className="flex flex-col">
              <label htmlFor="room-cleaning-fee" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Cleaning Fee ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">$</span>
                <input
                  id="room-cleaning-fee"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.cleaning_fee_dollars}
                  onChange={e => set('cleaning_fee_dollars', e.target.value)}
                  placeholder="Use property default"
                  className="h-11 border-[1.5px] border-border rounded-[6px] pl-7 pr-3 font-mono text-[15px] text-text-primary bg-surface-raised w-full focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 placeholder:text-text-muted"
                />
              </div>
            </div>
            {form.allows_pets && (
              <div className="flex flex-col">
                <label htmlFor="room-pet-fee" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                  Pet Fee ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">$</span>
                  <input
                    id="room-pet-fee"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.pet_fee_dollars}
                    onChange={e => set('pet_fee_dollars', e.target.value)}
                    placeholder="Use property default"
                    className="h-11 border-[1.5px] border-border rounded-[6px] pl-7 pr-3 font-mono text-[15px] text-text-primary bg-surface-raised w-full focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 placeholder:text-text-muted"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Active toggle (edit mode only) */}
          {!isNew && (
            <div className="flex items-center justify-between p-3 border border-border rounded-[6px] bg-surface">
              <div>
                <p className="font-body font-semibold text-[14px] text-text-primary">Room status</p>
                <p className="font-body text-[12px] text-text-muted mt-0.5">Inactive rooms won't appear in the booking widget</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch.Root
                  checked={isActive}
                  onCheckedChange={handleToggleActive}
                  className={cn('w-10 h-6 rounded-full transition-colors', isActive ? 'bg-success' : 'bg-border')}
                >
                  <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
                </Switch.Root>
                <span className="font-body text-[13px] text-text-secondary">{isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          )}

          {/* Photos — existing rooms only */}
          {!isNew && room?.id && <PhotoManager room={room} />}

          {/* Action buttons */}
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="secondary" size="md" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="md" loading={saving} onClick={handleSave}>
              <Check size={15} weight="bold" />
              {isNew ? 'Add Room' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Room Links section ──────────────────────────────────────────────────────

function useRoomLinks() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['room-links', propertyId],
    queryFn: async () => {
      if (!propertyId) return []
      const { data } = await supabase.from('room_links').select('*').eq('property_id', propertyId).order('created_at')
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function RoomLinksSection({ rooms }) {
  const { propertyId } = useProperty()
  const { data: links = [], isLoading } = useRoomLinks()
  const qc = useQueryClient()
  const { addToast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', linkedRoomIds: [], baseRateDollars: '', maxGuests: '2', description: '' })
  const [confirmState, setConfirmState] = useState(null)

  const linkableRooms = rooms.filter(r => r.linkable)
  if (linkableRooms.length < 2 && links.length === 0) return null

  function resetForm() {
    setForm({ name: '', linkedRoomIds: [], baseRateDollars: '', maxGuests: '2', description: '' })
    setShowForm(false)
    setEditingId(null)
  }

  function startEdit(link) {
    setForm({
      name: link.name,
      linkedRoomIds: link.linked_room_ids ?? [],
      baseRateDollars: ((link.base_rate_cents ?? 0) / 100).toFixed(2),
      maxGuests: String(link.max_guests ?? 2),
      description: link.description ?? '',
    })
    setEditingId(link.id)
    setShowForm(true)
  }

  function toggleRoom(roomId) {
    setForm(f => ({
      ...f,
      linkedRoomIds: f.linkedRoomIds.includes(roomId)
        ? f.linkedRoomIds.filter(id => id !== roomId)
        : [...f.linkedRoomIds, roomId],
    }))
  }

  async function handleSave() {
    if (!form.name.trim() || form.linkedRoomIds.length < 2) {
      addToast({ message: 'Name and at least 2 rooms required', variant: 'error' })
      return
    }
    const payload = {
      property_id: propertyId,
      name: form.name.trim(),
      linked_room_ids: form.linkedRoomIds,
      base_rate_cents: Math.round(Number(form.baseRateDollars || 0) * 100),
      max_guests: Number(form.maxGuests) || 2,
      description: form.description.trim() || null,
    }
    try {
      if (editingId) {
        await supabase.from('room_links').update(payload).eq('id', editingId)
        addToast({ message: 'Room link updated', variant: 'success' })
      } else {
        await supabase.from('room_links').insert(payload)
        addToast({ message: 'Room link created', variant: 'success' })
      }
      qc.invalidateQueries({ queryKey: ['room-links'] })
      resetForm()
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to save', variant: 'error' })
    }
  }

  function handleDelete(linkId) {
    setConfirmState({
      title: 'Delete this room link?',
      description: 'This room link will be permanently removed.',
      onConfirm: async () => {
        await supabase.from('room_links').delete().eq('id', linkId)
        qc.invalidateQueries({ queryKey: ['room-links'] })
        addToast({ message: 'Room link deleted', variant: 'success' })
      },
    })
  }

  function roomName(id) {
    return rooms.find(r => r.id === id)?.name ?? 'Unknown'
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-[22px] text-text-primary">Room Links</h2>
          <p className="font-body text-[13px] text-text-muted mt-0.5">Combine linkable rooms into bookable listings</p>
        </div>
        {!showForm && (
          <Button variant="secondary" size="md" onClick={() => setShowForm(true)} disabled={linkableRooms.length < 2}>
            <Plus size={16} weight="bold" /> New Link
          </Button>
        )}
      </div>

      {isLoading && <div className="animate-pulse bg-border rounded-[8px] h-16" />}

      {/* Existing links */}
      {links.map(link => (
        <div key={link.id} className="border border-border rounded-[8px] p-4 bg-surface-raised flex items-start justify-between gap-3">
          <div>
            <p className="font-body font-semibold text-[15px] text-text-primary">{link.name}</p>
            <p className="font-body text-[13px] text-text-secondary mt-0.5">
              {(link.linked_room_ids ?? []).map(roomName).join(' + ')}
            </p>
            <p className="font-mono text-[13px] text-text-secondary mt-0.5">
              ${((link.base_rate_cents ?? 0) / 100).toFixed(2)}/night · Max {link.max_guests} guests
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => startEdit(link)} className="font-body text-[13px] text-info hover:underline">Edit</button>
            <button onClick={() => handleDelete(link.id)} className="font-body text-[13px] text-danger hover:underline">Delete</button>
          </div>
        </div>
      ))}

      {/* Create/Edit form */}
      {showForm && (
        <div className="border border-info rounded-[8px] p-5 bg-surface flex flex-col gap-4">
          <h3 className="font-body font-semibold text-[15px] text-text-primary">
            {editingId ? 'Edit Room Link' : 'New Room Link'}
          </h3>
          <Input
            label="Link Name"
            placeholder="e.g. Suite 1A+1B"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <div>
            <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-2">
              Select Rooms (min 2)
            </p>
            <div className="flex flex-col gap-1.5">
              {linkableRooms.map(room => {
                const isSelected = form.linkedRoomIds.includes(room.id)
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => toggleRoom(room.id)}
                    className={cn(
                      'text-left p-2.5 rounded-[6px] border transition-colors flex items-center gap-2',
                      isSelected ? 'border-info bg-info-bg' : 'border-border bg-surface-raised'
                    )}
                  >
                    {isSelected && <Check size={14} weight="bold" className="text-info" />}
                    <span className="font-body text-[14px] text-text-primary">{room.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Combined Rate ($/night)"
              type="number"
              min="0"
              step="0.01"
              value={form.baseRateDollars}
              onChange={e => setForm(f => ({ ...f, baseRateDollars: e.target.value }))}
            />
            <Input
              label="Max Guests"
              type="number"
              min="1"
              value={form.maxGuests}
              onChange={e => setForm(f => ({ ...f, maxGuests: e.target.value }))}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="link-description" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
              Description (optional)
            </label>
            <textarea
              id="link-description"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised resize-none focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" size="md" onClick={resetForm}>Cancel</Button>
            <Button variant="primary" size="md" onClick={handleSave}>
              <Check size={15} weight="bold" />
              {editingId ? 'Save Changes' : 'Create Link'}
            </Button>
          </div>
        </div>
      )}

      {linkableRooms.length < 2 && links.length === 0 && (
        <p className="font-body text-[14px] text-text-muted text-center py-4">
          Mark at least 2 rooms as "Linkable" to create combined listings.
        </p>
      )}

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        description={confirmState?.description}
        onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null) }}
        onCancel={() => setConfirmState(null)}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Rooms() {
  const { data: rooms = [], isLoading } = useRooms()
  const updateRoom = useUpdateRoom()
  const { addToast } = useToast()

  const [localRooms, setLocalRooms] = useState([])
  const [dragIdx, setDragIdx] = useState(null)
  const [addingNew, setAddingNew] = useState(false)

  // Sync localRooms when query data changes (initial load, after mutations)
  useEffect(() => {
    setLocalRooms(rooms)
  }, [rooms])

  async function handleDrop(targetIdx) {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); return }
    const reordered = [...localRooms]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    setLocalRooms(reordered)
    setDragIdx(null)
    try {
      for (let i = 0; i < reordered.length; i++) {
        await updateRoom.mutateAsync({ id: reordered[i].id, sort_order: i })
      }
    } catch {
      addToast({ message: 'Failed to save room order', variant: 'error' })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[32px] text-text-primary uppercase">Rooms</h1>
          {localRooms.length > 1 && (
            <p className="font-body text-[13px] text-text-muted mt-0.5">
              Drag <DotsSixVertical size={12} className="inline" /> to reorder — order reflects in the calendar.
            </p>
          )}
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => setAddingNew(true)}
          disabled={addingNew}
        >
          <Plus size={16} weight="bold" /> Add Room
        </Button>
      </div>

      {/* Room list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-border rounded-[10px] h-14" />
          ))}
        </div>
      ) : localRooms.length === 0 && !addingNew ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="font-body text-[16px] text-text-muted">No rooms yet</p>
          <Button variant="primary" size="md" onClick={() => setAddingNew(true)}>
            <Plus size={16} weight="bold" /> Add first room
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {localRooms.map((room, idx) => (
            <RoomRow
              key={room.id}
              room={room}
              dragHandlers={{
                onDragStart: () => setDragIdx(idx),
                onDragOver:  e => e.preventDefault(),
                onDrop:      () => handleDrop(idx),
                isDragging:  dragIdx === idx,
              }}
            />
          ))}

          {addingNew && (
            <RoomRow
              key="new"
              room={null}
              isNew
              onSaved={() => setAddingNew(false)}
              onCancel={() => setAddingNew(false)}
            />
          )}
        </div>
      )}

      {/* Room Links */}
      {!isLoading && localRooms.length >= 2 && (
        <RoomLinksSection rooms={localRooms} />
      )}
    </div>
  )
}
