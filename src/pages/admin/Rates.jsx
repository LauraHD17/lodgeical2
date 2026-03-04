// src/pages/admin/Rates.jsx
// Base rate inline editor + seasonal date-override pricing.
// Includes a live pricing calculator showing nightly breakdown,
// tax, and optional Stripe fee pass-through.

import { useState, useCallback } from 'react'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { format, parseISO, eachDayOfInterval } from 'date-fns'
import { PencilSimple, Check, X, Plus, Trash, Calculator, CalendarBlank, Tag } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { useRooms, useUpdateRoom } from '@/hooks/useRooms'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/useToast'

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useRateOverrides() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['rate-overrides', propertyId],
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('rate_overrides')
        .select('id, room_id, label, start_date, end_date, rate_cents')
        .eq('property_id', propertyId)
        .order('start_date')
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function useSettingsPricing() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['settings-pricing', propertyId],
    queryFn: async () => {
      if (!propertyId) return null
      const [settingsRes, propRes] = await Promise.all([
        supabase
          .from('settings')
          .select('tax_rate, pass_through_stripe_fee')
          .eq('property_id', propertyId)
          .single(),
        supabase
          .from('properties')
          .select('cleaning_fee_cents')
          .eq('id', propertyId)
          .single(),
      ])
      return {
        ...(settingsRes.data ?? {}),
        cleaning_fee_cents: propRes.data?.cleaning_fee_cents ?? 0,
      }
    },
    enabled: !!propertyId,
  })
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Reusable inline-edit cell
// ---------------------------------------------------------------------------

/**
 * InlineEditCell — pencil-click inline editor for a single table cell value.
 * Props:
 *   displayValue  — what to show in read mode (string/node)
 *   inputValue    — controlled string value for the input
 *   onInputChange — called with new string on every keystroke
 *   onSave        — async fn; called on Enter or checkmark click
 *   onCancel      — called on Escape or X click; should reset inputValue
 *   saving        — disables the save button while pending
 *   prefix        — optional string rendered before the input (e.g. "$")
 *   inputProps    — extra props forwarded to <input> (type, min, step, className width)
 */
function InlineEditCell({ displayValue, inputValue, onInputChange, onSave, onCancel, saving, prefix, inputProps = {} }) {
  const [editing, setEditing] = useState(false)

  function handleKeyDown(e) {
    if (e.key === 'Enter') { onSave().then(() => setEditing(false)).catch(() => {}) }
    if (e.key === 'Escape') { onCancel(); setEditing(false) }
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="flex items-center gap-2 group" title="Click to edit">
        <span className="font-mono text-[15px] text-text-primary">{displayValue}</span>
        <PencilSimple size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {prefix && <span className="font-mono text-[15px] text-text-muted">{prefix}</span>}
      <input
        autoFocus
        value={inputValue}
        onChange={e => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-9 border-[1.5px] border-info rounded-[6px] px-2 font-mono text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1"
        {...inputProps}
      />
      <button
        onClick={() => onSave().then(() => setEditing(false)).catch(() => {})}
        disabled={saving}
        className="text-success hover:opacity-80"
        title="Save"
      >
        <Check size={18} weight="bold" />
      </button>
      <button
        onClick={() => { onCancel(); setEditing(false) }}
        className="text-text-muted hover:text-danger"
        title="Cancel"
      >
        <X size={18} weight="bold" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Base rate row (inline editable)
// ---------------------------------------------------------------------------

function RateRow({ room }) {
  const updateRoom = useUpdateRoom()
  const { addToast } = useToast()
  const [rateValue, setRateValue] = useState(((room.base_rate_cents ?? 0) / 100).toFixed(2))
  const [guestsValue, setGuestsValue] = useState(String(room.max_guests ?? ''))

  async function saveRate() {
    await updateRoom.mutateAsync({ id: room.id, base_rate_cents: Math.round(Number(rateValue) * 100) })
    addToast({ message: `Base rate updated for ${room.name}`, variant: 'success' })
  }

  async function saveGuests() {
    const parsed = parseInt(guestsValue, 10)
    if (isNaN(parsed) || parsed < 1) {
      addToast({ message: 'Max guests must be a positive number', variant: 'error' })
      throw new Error('invalid')
    }
    await updateRoom.mutateAsync({ id: room.id, max_guests: parsed })
    addToast({ message: `Max guests updated for ${room.name}`, variant: 'success' })
  }

  return (
    <tr className="border-b border-border hover:bg-info-bg transition-colors">
      <td className="px-4 py-4 font-body text-[15px] text-text-primary">{room.name}</td>
      <td className="px-4 py-4">
        <InlineEditCell
          displayValue={`$${((room.base_rate_cents ?? 0) / 100).toFixed(2)}`}
          inputValue={rateValue}
          onInputChange={setRateValue}
          onSave={saveRate}
          onCancel={() => setRateValue(((room.base_rate_cents ?? 0) / 100).toFixed(2))}
          saving={updateRoom.isPending}
          prefix="$"
          inputProps={{ type: 'number', min: 0, step: 0.01, className: 'w-28 h-9 border-[1.5px] border-info rounded-[6px] px-2 font-mono text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1' }}
        />
      </td>
      <td className="px-4 py-4">
        <InlineEditCell
          displayValue={room.max_guests ?? '—'}
          inputValue={guestsValue}
          onInputChange={setGuestsValue}
          onSave={saveGuests}
          onCancel={() => setGuestsValue(String(room.max_guests ?? ''))}
          saving={updateRoom.isPending}
          inputProps={{ type: 'number', min: 1, step: 1, className: 'w-20 h-9 border-[1.5px] border-info rounded-[6px] px-2 font-mono text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1' }}
        />
      </td>
      <td className="px-4 py-4 font-body text-[14px] text-text-secondary capitalize">{room.type ?? '—'}</td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Override form modal
// ---------------------------------------------------------------------------

function OverrideModal({ open, onClose, rooms, existing, propertyId }) {
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = !!existing

  const [form, setForm] = useState({
    room_id: existing?.room_id ?? rooms[0]?.id ?? '',
    label: existing?.label ?? '',
    start_date: existing?.start_date ?? '',
    end_date: existing?.end_date ?? '',
    rate: existing ? (existing.rate_cents / 100).toFixed(2) : '',
  })
  const [saving, setSaving] = useState(false)
  const set = useCallback((k, v) => setForm(f => ({ ...f, [k]: v })), [])

  async function handleSave() {
    if (!form.room_id || !form.start_date || !form.end_date || !form.rate) {
      addToast({ message: 'All fields are required', variant: 'error' }); return
    }
    if (form.start_date > form.end_date) {
      addToast({ message: 'End date must be on or after start date', variant: 'error' }); return
    }
    setSaving(true)
    try {
      const payload = {
        property_id: propertyId,
        room_id: form.room_id,
        label: form.label || 'Seasonal Rate',
        start_date: form.start_date,
        end_date: form.end_date,
        rate_cents: Math.round(Number(form.rate) * 100),
      }
      const { error } = isEdit
        ? await supabase.from('rate_overrides').update(payload).eq('id', existing.id)
        : await supabase.from('rate_overrides').insert(payload)
      if (error) throw error
      addToast({ message: `Seasonal rate ${isEdit ? 'updated' : 'added'}`, variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['rate-overrides', propertyId] })
      onClose()
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to save', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Seasonal Rate' : 'Add Seasonal Rate'}>
      <div className="flex flex-col gap-4 p-1">
        <Select label="Room" options={rooms.map(r => ({ value: r.id, label: r.name }))} value={form.room_id} onValueChange={v => set('room_id', v)} />
        <Input label="Label (optional)" placeholder="e.g. Peak Season, Holiday Weekend" value={form.label} onChange={e => set('label', e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          <Input label="End Date (inclusive)" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">Rate / Night</label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[15px] text-text-muted">$</span>
            <input type="number" min={0} step={0.01} value={form.rate} onChange={e => set('rate', e.target.value)} placeholder="0.00"
              className="flex-1 h-11 border-[1.5px] border-border rounded-[6px] px-3 font-mono text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="primary" size="md" loading={saving} onClick={handleSave} className="flex-1">{isEdit ? 'Save Changes' : 'Add Override'}</Button>
          <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Pricing Calculator
// ---------------------------------------------------------------------------

const STRIPE_FIXED_FEE_CENTS = 30
const STRIPE_PCT_FEE = 0.029

function PricingCalculator({ rooms, overrides, settings }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')

  const room = rooms.find(r => r.id === roomId)
  const taxRate      = Number(settings?.tax_rate ?? 0)
  const passThrough  = settings?.pass_through_stripe_fee ?? false
  const cleaningFee  = Number(settings?.cleaning_fee_cents ?? 0)

  const breakdown = (() => {
    if (!room || !checkIn || !checkOut || checkIn >= checkOut) return null
    let nights
    try { nights = eachDayOfInterval({ start: parseISO(checkIn), end: parseISO(checkOut) }).slice(0, -1) } catch { return null }
    if (!nights.length) return null

    const roomOverrides = overrides.filter(o => o.room_id === roomId)
    const lines = nights.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd')
      const applicable = roomOverrides.filter(o => o.start_date <= dateStr && o.end_date >= dateStr)
      if (!applicable.length) return { date: dateStr, cents: room.base_rate_cents, label: null }
      const best = applicable.reduce((a, b) => a.rate_cents >= b.rate_cents ? a : b)
      return { date: dateStr, cents: best.rate_cents, label: best.label }
    })

    const nightsSubtotal = lines.reduce((s, l) => s + l.cents, 0)
    const subtotal = nightsSubtotal + cleaningFee          // cleaning fee added before tax
    const tax = Math.round(subtotal * taxRate / 100)
    const preFee = subtotal + tax
    let fee = 0, total = preFee
    if (passThrough) { const gross = Math.ceil((preFee + STRIPE_FIXED_FEE_CENTS) / (1 - STRIPE_PCT_FEE)); fee = gross - preFee; total = gross }

    return { lines, nightsSubtotal, cleaningFee, subtotal, tax, fee, total }
  })()

  return (
    <div className="border border-border rounded-[8px] bg-surface p-5 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Calculator size={18} className="text-text-secondary" />
        <h3 className="font-body font-semibold text-[15px] text-text-primary">Pricing Calculator</h3>
        <span className="font-body text-[13px] text-text-muted">(preview what the guest pays)</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Select label="Room" options={rooms.map(r => ({ value: r.id, label: r.name }))} value={roomId} onValueChange={setRoomId} />
        <Input label="Check-in" type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
        <Input label="Check-out" type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
      </div>

      {breakdown ? (
        <div className="flex flex-col gap-0 border border-border rounded-[6px] overflow-hidden">
          <div className="bg-surface-raised">
            {breakdown.lines.map(line => (
              <div key={line.date} className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-b-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[13px] text-text-secondary">{format(parseISO(line.date), 'EEE, MMM d')}</span>
                  {line.label && (
                    <span className="flex items-center gap-1 font-body text-[11px] text-info bg-info-bg border border-info rounded-full px-2 py-0.5">
                      <Tag size={10} /> {line.label}
                    </span>
                  )}
                </div>
                <span className="font-mono text-[14px] text-text-primary">${(line.cents / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="bg-surface px-4 py-3 flex flex-col gap-2">
            <div className="flex justify-between font-body text-[14px] text-text-secondary">
              <span>Nightly subtotal ({breakdown.lines.length} night{breakdown.lines.length !== 1 ? 's' : ''})</span>
              <span className="font-mono">${(breakdown.nightsSubtotal / 100).toFixed(2)}</span>
            </div>
            {breakdown.cleaningFee > 0 && (
              <div className="flex justify-between font-body text-[14px] text-text-secondary">
                <span>Cleaning fee (one-time)</span>
                <span className="font-mono">${(breakdown.cleaningFee / 100).toFixed(2)}</span>
              </div>
            )}
            {(taxRate > 0 || breakdown.cleaningFee > 0) && (
              <div className="flex justify-between font-body text-[13px] text-text-muted">
                <span>Pre-tax subtotal</span>
                <span className="font-mono">${(breakdown.subtotal / 100).toFixed(2)}</span>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between font-body text-[14px] text-text-secondary">
                <span>Tax ({taxRate}%)</span>
                <span className="font-mono">${(breakdown.tax / 100).toFixed(2)}</span>
              </div>
            )}
            {breakdown.fee > 0 && (
              <div className="flex justify-between font-body text-[13px] text-text-muted">
                <span>Processing fee (Stripe 2.9% + $0.30, guest-facing)</span>
                <span className="font-mono">${(breakdown.fee / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-[16px] text-text-primary border-t border-border pt-2 mt-1">
              <span className="font-body">Guest pays</span>
              <span className="font-mono text-[18px]">${(breakdown.total / 100).toFixed(2)}</span>
            </div>
            {breakdown.fee > 0 && (
              <p className="font-body text-[12px] text-text-muted">You receive ${((breakdown.total - breakdown.fee) / 100).toFixed(2)} after Stripe fees.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="font-body text-[13px] text-text-muted">
          {checkIn && checkOut && checkIn >= checkOut
            ? 'Check-out must be after check-in.'
            : 'Select a room and date range to see a pricing breakdown.'}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seasonal overrides list
// ---------------------------------------------------------------------------

function OverrideList({ overrides, rooms, propertyId }) {
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [editTarget, setEditTarget] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r.name]))

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('rate_overrides').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { addToast({ message: 'Override removed', variant: 'success' }); queryClient.invalidateQueries({ queryKey: ['rate-overrides', propertyId] }) },
    onError: () => addToast({ message: 'Failed to remove override', variant: 'error' }),
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarBlank size={18} className="text-text-secondary" />
          <h2 className="font-heading text-[22px] text-text-primary">Seasonal Overrides</h2>
        </div>
        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)} disabled={rooms.length === 0}>
          <Plus size={14} weight="bold" /> Add Override
        </Button>
      </div>
      <p className="font-body text-[14px] text-text-secondary -mt-2">
        Override the nightly rate for specific date ranges. When multiple overrides overlap the same date, the highest rate applies.
      </p>

      {overrides.length === 0 ? (
        <div className="border border-border rounded-[8px] py-10 text-center">
          <p className="font-body text-[15px] text-text-muted">No seasonal overrides yet.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => setAddOpen(true)}><Plus size={14} /> Add your first override</Button>
        </div>
      ) : (
        <div className="border border-border rounded-[8px] overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-text-primary">
                {['Room', 'Label', 'Dates', 'Rate / Night', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-body text-[13px] uppercase tracking-wider text-white font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overrides.map(ov => (
                <tr key={ov.id} className="border-b border-border hover:bg-info-bg transition-colors">
                  <td className="px-4 py-3 font-body text-[14px] text-text-primary">{roomMap[ov.room_id] ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 font-body text-[12px] text-info bg-info-bg border border-info rounded-full px-2 py-0.5 w-fit">
                      <Tag size={10} /> {ov.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] text-text-secondary whitespace-nowrap">
                    {format(parseISO(ov.start_date), 'MMM d, yyyy')} – {format(parseISO(ov.end_date), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 font-mono text-[15px] text-text-primary">${(ov.rate_cents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setEditTarget(ov)} className="text-info hover:opacity-70" title="Edit"><PencilSimple size={15} /></button>
                      <button onClick={() => { if (confirm('Remove this override?')) deleteMutation.mutate(ov.id) }} className="text-danger hover:opacity-70" title="Delete"><Trash size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && <OverrideModal open onClose={() => setAddOpen(false)} rooms={rooms} existing={null} propertyId={propertyId} />}
      {editTarget && <OverrideModal open onClose={() => setEditTarget(null)} rooms={rooms} existing={editTarget} propertyId={propertyId} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Rates() {
  const { propertyId } = useProperty()
  const { data: rooms = [], isLoading: roomsLoading } = useRooms()
  const { data: overrides = [] } = useRateOverrides()
  const { data: settings } = useSettingsPricing()

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-heading text-[32px] text-text-primary">Rates</h1>

      {/* Base Rates */}
      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-[22px] text-text-primary">Base Rates</h2>
        <p className="font-body text-[14px] text-text-secondary -mt-2">Click any rate or guest count to edit inline. Press Enter to save or Escape to cancel.</p>
        <div className="border border-border rounded-[8px] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-text-primary">
                {['Room Name', 'Base Rate / Night', 'Max Guests', 'Type'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-body text-[13px] uppercase tracking-wider text-white font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roomsLoading ? (
                [1, 2, 3].map(i => <tr key={i} className="border-b border-border">{[1, 2, 3, 4].map(j => <td key={j} className="px-4 py-4"><div className="animate-pulse bg-border rounded h-8" /></td>)}</tr>)
              ) : rooms.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center font-body text-[15px] text-text-muted">No rooms found. Add rooms in the Rooms section.</td></tr>
              ) : rooms.map(room => <RateRow key={room.id} room={room} />)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seasonal Overrides */}
      {!roomsLoading && rooms.length > 0 && (
        <OverrideList overrides={overrides} rooms={rooms} propertyId={propertyId} />
      )}

      {/* Pricing Calculator */}
      {!roomsLoading && rooms.length > 0 && (
        <PricingCalculator rooms={rooms} overrides={overrides} settings={settings} />
      )}
    </div>
  )
}
