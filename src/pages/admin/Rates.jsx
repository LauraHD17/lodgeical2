// src/pages/admin/Rates.jsx
// Base rate inline editor + seasonal date-override pricing.
// Includes a live pricing calculator showing nightly breakdown,
// tax, and optional Stripe fee pass-through.

import { useState, useCallback } from 'react'
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { PencilSimple, Check, X, Plus, Trash, Calculator, CalendarBlank, Tag, CaretDown, CaretUp, Users, Moon } from '@phosphor-icons/react'

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
          .select('cleaning_fee_cents, pet_fee_cents, pet_fee_type')
          .eq('id', propertyId)
          .single(),
      ])
      return {
        ...(settingsRes.data ?? {}),
        cleaning_fee_cents: propRes.data?.cleaning_fee_cents ?? 0,
        pet_fee_cents: propRes.data?.pet_fee_cents ?? 0,
        pet_fee_type: propRes.data?.pet_fee_type ?? 'flat',
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

function RateRow({ room, overrides, settings }) {
  const updateRoom = useUpdateRoom()
  const { addToast } = useToast()
  const [rateValue, setRateValue]   = useState(((room.base_rate_cents ?? 0) / 100).toFixed(2))
  const [guestsValue, setGuestsValue] = useState(String(room.max_guests ?? ''))
  const [calcOpen, setCalcOpen]     = useState(false)

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
    <>
      <tr className="border-b border-border hover:bg-info-bg transition-colors">
        <td className="px-4 py-4 font-body text-[15px] text-text-primary font-medium">{room.name}</td>
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
        <td className="px-4 py-4">
          <button
            onClick={() => setCalcOpen(o => !o)}
            className="flex items-center gap-1.5 font-body text-[13px] text-info hover:underline"
          >
            <Calculator size={14} />
            Calculate
            {calcOpen ? <CaretUp size={11} /> : <CaretDown size={11} />}
          </button>
        </td>
      </tr>
      {calcOpen && (
        <tr className="border-b border-border">
          <td colSpan={5} className="p-0">
            <RoomCalculator room={room} settings={settings} />
          </td>
        </tr>
      )}
    </>
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

// Per-room pricing calculator — no dates needed, just nights count
function RoomCalculator({ room, settings }) {
  const [nights, setNights]             = useState('3')
  const [numGuests, setNumGuests]       = useState(String(room.max_guests ?? 1))
  const [includePetFee, setIncludePetFee]         = useState(false)
  const [includeCleaningFee, setIncludeCleaningFee] = useState(true)
  const [discountDollars, setDiscountDollars]       = useState('')

  const nightsNum      = Math.max(1, parseInt(nights, 10) || 1)
  const taxRate        = Number(settings?.tax_rate ?? 0)
  const taxLabel       = settings?.tax_label || 'Tax'
  const passThrough    = settings?.pass_through_stripe_fee ?? false
  const cleaningFeeCents = Number(room?.cleaning_fee_cents != null ? room.cleaning_fee_cents : (settings?.cleaning_fee_cents ?? 0))
  const petFeeRate     = Number(room?.pet_fee_cents != null ? room.pet_fee_cents : (settings?.pet_fee_cents ?? 0))
  const petFeeType     = settings?.pet_fee_type ?? 'flat'
  const roomAllowsPets = room?.allows_pets ?? false

  const breakdown = (() => {
    const nightsCents    = (room.base_rate_cents ?? 0) * nightsNum
    const cleaningFee    = includeCleaningFee ? cleaningFeeCents : 0
    const petFee         = roomAllowsPets && includePetFee && petFeeRate > 0
      ? (petFeeType === 'per_night' ? petFeeRate * nightsNum : petFeeRate)
      : 0
    const discountCents  = discountDollars !== '' ? Math.round(Number(discountDollars) * 100) : 0
    const subtotal       = Math.max(0, nightsCents + cleaningFee + petFee - discountCents)
    const tax            = Math.round(subtotal * taxRate / 100)
    const preFee         = subtotal + tax
    let fee = 0, total = preFee
    if (passThrough) {
      const gross = Math.ceil((preFee + STRIPE_FIXED_FEE_CENTS) / (1 - STRIPE_PCT_FEE))
      fee = gross - preFee
      total = gross
    }
    return { nightsCents, cleaningFee, petFee, discountCents, subtotal, tax, fee, total }
  })()

  const fmt = cents => `$${(Math.abs(cents) / 100).toFixed(2)}`

  return (
    <div className="border-t border-border bg-surface px-4 py-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Calculator size={15} className="text-text-secondary" />
        <span className="font-body font-semibold text-[13px] text-text-primary">Pricing Preview</span>
        <span className="font-body text-[12px] text-text-muted">for {room.name}</span>
      </div>

      {/* Inputs row */}
      <div className="flex flex-wrap gap-3">
        {/* Nights */}
        <div className="flex flex-col gap-1">
          <label className="font-body text-[12px] uppercase tracking-[0.06em] font-semibold text-text-secondary flex items-center gap-1"><Moon size={11} /> Nights</label>
          <input type="number" min={1} value={nights} onChange={e => setNights(e.target.value)}
            className="h-10 w-20 border-[1.5px] border-border rounded-[6px] px-3 font-mono text-[14px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1" />
        </div>
        {/* Guests */}
        <div className="flex flex-col gap-1">
          <label className="font-body text-[12px] uppercase tracking-[0.06em] font-semibold text-text-secondary flex items-center gap-1"><Users size={11} /> Guests</label>
          <input type="number" min={1} max={room.max_guests ?? 99} value={numGuests} onChange={e => setNumGuests(e.target.value)}
            className="h-10 w-20 border-[1.5px] border-border rounded-[6px] px-3 font-mono text-[14px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1" />
        </div>
        {/* Discount */}
        <div className="flex flex-col gap-1">
          <label className="font-body text-[12px] uppercase tracking-[0.06em] font-semibold text-text-secondary">Discount</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[14px] text-text-muted">$</span>
            <input type="number" min={0} step={0.01} value={discountDollars} onChange={e => setDiscountDollars(e.target.value)} placeholder="0.00"
              className="h-10 w-28 border-[1.5px] border-border rounded-[6px] pl-6 pr-2 font-mono text-[14px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1 placeholder:text-text-muted" />
          </div>
        </div>
      </div>

      {/* Fee toggles */}
      <div className="flex flex-wrap gap-4">
        {cleaningFeeCents > 0 && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeCleaningFee} onChange={e => setIncludeCleaningFee(e.target.checked)} className="w-4 h-4 accent-info" />
            <span className="font-body text-[12px] text-text-secondary">Cleaning fee ({fmt(cleaningFeeCents)} one-time)</span>
          </label>
        )}
        {roomAllowsPets && petFeeRate > 0 && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includePetFee} onChange={e => setIncludePetFee(e.target.checked)} className="w-4 h-4 accent-info" />
            <span className="font-body text-[12px] text-text-secondary">Pet fee ({fmt(petFeeRate)} {petFeeType === 'per_night' ? '/night' : 'flat'})</span>
          </label>
        )}
      </div>

      {/* Breakdown */}
      <div className="border border-border rounded-[6px] overflow-hidden text-[13px]">
        <div className="bg-surface-raised divide-y divide-border">
          <div className="flex justify-between px-4 py-2">
            <span className="font-body text-text-secondary">{fmt(room.base_rate_cents ?? 0)} × {nightsNum} night{nightsNum !== 1 ? 's' : ''}</span>
            <span className="font-mono text-text-primary">{fmt(breakdown.nightsCents)}</span>
          </div>
          {breakdown.cleaningFee > 0 && (
            <div className="flex justify-between px-4 py-2">
              <span className="font-body text-text-secondary">Cleaning fee</span>
              <span className="font-mono text-text-primary">{fmt(breakdown.cleaningFee)}</span>
            </div>
          )}
          {breakdown.petFee > 0 && (
            <div className="flex justify-between px-4 py-2">
              <span className="font-body text-text-secondary">Pet fee</span>
              <span className="font-mono text-text-primary">{fmt(breakdown.petFee)}</span>
            </div>
          )}
          {breakdown.discountCents > 0 && (
            <div className="flex justify-between px-4 py-2">
              <span className="font-body text-success">Discount</span>
              <span className="font-mono text-success">−{fmt(breakdown.discountCents)}</span>
            </div>
          )}
          {taxRate > 0 && (
            <div className="flex justify-between px-4 py-2">
              <span className="font-body text-text-secondary">{taxLabel} ({taxRate}%)</span>
              <span className="font-mono text-text-primary">{fmt(breakdown.tax)}</span>
            </div>
          )}
          {breakdown.fee > 0 && (
            <div className="flex justify-between px-4 py-2">
              <span className="font-body text-text-muted">Processing fee (2.9% + $0.30)</span>
              <span className="font-mono text-text-muted">{fmt(breakdown.fee)}</span>
            </div>
          )}
        </div>
        <div className="bg-surface px-4 py-3 flex justify-between items-baseline border-t border-border">
          <span className="font-body font-semibold text-text-primary">Guest pays</span>
          <span className="font-mono text-[18px] font-semibold text-text-primary">{fmt(breakdown.total)}</span>
        </div>
        {breakdown.fee > 0 && (
          <div className="bg-surface px-4 pb-2 text-[11px] font-body text-text-muted">
            You receive {fmt(breakdown.total - breakdown.fee)} after Stripe fees.
          </div>
        )}
      </div>
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
                {['Room Name', 'Base Rate / Night', 'Max Guests', 'Type', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-body text-[13px] uppercase tracking-wider text-white font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roomsLoading ? (
                [1, 2, 3].map(i => <tr key={i} className="border-b border-border">{[1, 2, 3, 4].map(j => <td key={j} className="px-4 py-4"><div className="animate-pulse bg-border rounded h-8" /></td>)}</tr>)
              ) : rooms.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center font-body text-[15px] text-text-muted">No rooms found. Add rooms in the Rooms section.</td></tr>
              ) : rooms.map(room => <RateRow key={room.id} room={room} overrides={overrides} settings={settings} />)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Seasonal Overrides */}
      {!roomsLoading && rooms.length > 0 && (
        <OverrideList overrides={overrides} rooms={rooms} propertyId={propertyId} />
      )}

    </div>
  )
}
