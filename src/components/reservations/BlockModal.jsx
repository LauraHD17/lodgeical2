// src/components/reservations/BlockModal.jsx
// Modal for creating a maintenance or owner-block reservation.
// These appear on the calendar as blocked dates, distinct from guest reservations.
// Innkeeper controls whether the block prevents guest check-in / check-out on boundary dates.

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as Switch from '@radix-ui/react-switch'
import { Wrench, HouseSimple } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { useRooms } from '@/hooks/useRooms'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

const BLOCK_TYPES = [
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, description: 'HVAC, plumbing, cleaning, repairs' },
  { value: 'owner_block', label: 'Owner Block', icon: HouseSimple, description: 'Owner stay, personal use, family visit' },
]

const BLOCK_EMAIL = 'blocked@lodge-ical.internal'

export function BlockModal({ open, onClose }) {
  const { propertyId } = useProperty()
  const { data: rooms = [] } = useRooms()
  const { addToast } = useToast()
  const queryClient = useQueryClient()

  const [blockType, setBlockType] = useState('maintenance')
  const [selectedRooms, setSelectedRooms] = useState([])
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [notes, setNotes] = useState('')
  const [affectsCheckin, setAffectsCheckin] = useState(true)
  const [affectsCheckout, setAffectsCheckout] = useState(true)
  const [saving, setSaving] = useState(false)

  function toggleRoom(id) {
    setSelectedRooms(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])
  }

  async function handleSave() {
    if (!selectedRooms.length) { addToast({ message: 'Select at least one room', variant: 'error' }); return }
    if (!checkIn || !checkOut) { addToast({ message: 'Start and end dates are required', variant: 'error' }); return }
    if (checkIn >= checkOut) { addToast({ message: 'End date must be after start date', variant: 'error' }); return }

    setSaving(true)
    try {
      // Create a system guest for blocks if needed (reuses the ical-import pattern)
      const { data: guest } = await supabase
        .from('guests')
        .upsert({ property_id: propertyId, email: BLOCK_EMAIL, first_name: 'Blocked', last_name: 'Date', phone: null }, { onConflict: 'property_id,email' })
        .select('id')
        .single()

      if (!guest) throw new Error('Failed to resolve system guest')

      const label = BLOCK_TYPES.find(t => t.value === blockType)?.label ?? blockType
      const { error } = await supabase.from('reservations').insert({
        property_id: propertyId,
        guest_id: guest.id,
        room_ids: selectedRooms,
        check_in: checkIn,
        check_out: checkOut,
        num_guests: 0,
        status: 'confirmed',
        origin: 'import',
        total_due_cents: 0,
        is_tax_exempt: true,
        block_type: blockType,
        affects_checkin: affectsCheckin,
        affects_checkout: affectsCheckout,
        notes: notes || `${label} block`,
        confirmation_number: `BLK${crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`,
      })
      if (error) throw error

      addToast({ message: `${label} block created`, variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      onClose()
      // Reset form
      setSelectedRooms([]); setCheckIn(''); setCheckOut(''); setNotes('')
      setAffectsCheckin(true); setAffectsCheckout(true); setBlockType('maintenance')
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to create block', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Block Dates">
      <div className="flex flex-col gap-5 p-1">

        {/* Block type selector */}
        <div className="flex flex-col gap-2">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">Block Type</label>
          <div className="grid grid-cols-2 gap-3">
            {BLOCK_TYPES.map(({ value, label, icon: Icon, description }) => (
              <button
                key={value}
                onClick={() => setBlockType(value)}
                className={cn(
                  'flex flex-col gap-1.5 p-4 border-2 rounded-[8px] text-left transition-colors',
                  blockType === value ? 'border-text-primary bg-surface' : 'border-border hover:border-text-secondary'
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon size={18} className={blockType === value ? 'text-text-primary' : 'text-text-muted'} />
                  <span className="font-body font-semibold text-[14px] text-text-primary">{label}</span>
                </div>
                <span className="font-body text-[12px] text-text-muted">{description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Room multi-select */}
        <div className="flex flex-col gap-2">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">Rooms</label>
          <div className="flex flex-wrap gap-2">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => toggleRoom(room.id)}
                className={cn(
                  'font-body text-[13px] px-3 py-1.5 rounded-full border transition-colors',
                  selectedRooms.includes(room.id)
                    ? 'bg-text-primary text-white border-text-primary'
                    : 'border-border text-text-secondary hover:border-text-primary'
                )}
              >
                {room.name}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date" type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
          <Input label="End Date" type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
        </div>

        {/* Notes */}
        <Input label="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Boiler replacement, kitchen repair" />

        {/* Check-in / check-out boundary toggles */}
        <div className="flex flex-col gap-3 bg-surface rounded-[8px] p-4 border border-border">
          <p className="font-body text-[13px] text-text-secondary">
            Control whether this block prevents guests from checking in or out on the boundary dates.
          </p>
          <div className="flex items-center justify-between">
            <label className="font-body text-[14px] text-text-primary">Blocks guest check-in on start date</label>
            <Switch.Root
              checked={affectsCheckin}
              onCheckedChange={setAffectsCheckin}
              className={cn('w-10 h-6 rounded-full transition-colors', affectsCheckin ? 'bg-success' : 'bg-border')}
            >
              <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
            </Switch.Root>
          </div>
          <div className="flex items-center justify-between">
            <label className="font-body text-[14px] text-text-primary">Blocks guest check-out on end date</label>
            <Switch.Root
              checked={affectsCheckout}
              onCheckedChange={setAffectsCheckout}
              className={cn('w-10 h-6 rounded-full transition-colors', affectsCheckout ? 'bg-success' : 'bg-border')}
            >
              <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
            </Switch.Root>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="primary" size="md" loading={saving} onClick={handleSave} className="flex-1">Create Block</Button>
          <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}
