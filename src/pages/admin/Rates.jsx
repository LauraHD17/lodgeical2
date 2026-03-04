// src/pages/admin/Rates.jsx
// Per-room rate editor with inline editing for base rate and max guests.
// Fee calculator shows nightly breakdown including Stripe fees and cleaning fee.

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PencilSimple, Check, X, Calculator } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useRooms, useUpdateRoom } from '@/hooks/useRooms'
import { useProperty } from '@/lib/property/useProperty'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

// Stripe processing fee: 2.9% + $0.30
const STRIPE_RATE = 0.029
const STRIPE_FIXED = 30 // cents

function usePropertySettings() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['property-settings-rates', propertyId],
    queryFn: async () => {
      if (!propertyId) return null
      const { data, error } = await supabase
        .from('properties')
        .select('tax_rate, cleaning_fee_cents')
        .eq('id', propertyId)
        .single()
      if (error) return null
      return data
    },
    enabled: !!propertyId,
  })
}

function InlineEdit({ value, onSave, prefix, type = 'number', min = 0, step }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') {
      setDraft(String(value))
      setEditing(false)
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(String(value)); setEditing(true) }}
        className="flex items-center gap-2 group"
        title="Click to edit"
      >
        <span className="font-mono text-[15px] text-text-primary">
          {prefix}{value}
        </span>
        <PencilSimple
          size={14}
          className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {prefix && <span className="font-mono text-[15px] text-text-muted">{prefix}</span>}
      <input
        type={type}
        min={min}
        step={step}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        className={cn(
          'w-24 h-9 border-[1.5px] border-info rounded-[6px] px-2 font-mono text-[15px] text-text-primary bg-surface-raised',
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
        onClick={() => { setDraft(String(value)); setEditing(false) }}
        className="text-text-muted hover:text-danger transition-colors"
        title="Cancel"
      >
        <X size={18} weight="bold" />
      </button>
    </div>
  )
}

function RateRow({ room }) {
  const updateRoom = useUpdateRoom()
  const { addToast } = useToast()

  async function saveRate(val) {
    try {
      await updateRoom.mutateAsync({
        id: room.id,
        base_rate_cents: Math.round(Number(val) * 100),
      })
      addToast({ message: `Rate updated for ${room.name}`, variant: 'success' })
    } catch {
      addToast({ message: 'Failed to update rate', variant: 'error' })
    }
  }

  async function saveMaxGuests(val) {
    const n = Number(val)
    if (!n || n < 1) {
      addToast({ message: 'Max guests must be at least 1', variant: 'error' })
      return
    }
    try {
      await updateRoom.mutateAsync({ id: room.id, max_guests: n })
      addToast({ message: `Max guests updated for ${room.name}`, variant: 'success' })
    } catch {
      addToast({ message: 'Failed to update max guests', variant: 'error' })
    }
  }

  return (
    <tr className="border-b border-border hover:bg-info-bg transition-colors">
      <td className="px-4 py-4 font-body text-[15px] text-text-primary">{room.name}</td>
      <td className="px-4 py-4">
        <InlineEdit
          value={((room.base_rate_cents ?? 0) / 100).toFixed(2)}
          onSave={saveRate}
          prefix="$"
          step={0.01}
        />
      </td>
      <td className="px-4 py-4">
        <InlineEdit
          value={room.max_guests ?? 2}
          onSave={saveMaxGuests}
          min={1}
          step={1}
        />
      </td>
      <td className="px-4 py-4 font-body text-[14px] text-text-secondary capitalize">
        {room.type ?? '—'}
      </td>
    </tr>
  )
}

function FeeCalculator({ settings }) {
  const [nights, setNights] = useState('3')
  const [ratePerNight, setRatePerNight] = useState('150')
  const [includeStripe, setIncludeStripe] = useState(true)
  const [includeCleaning, setIncludeCleaning] = useState(true)

  const nightsNum = Math.max(0, Number(nights) || 0)
  const rateNum = Math.max(0, Number(ratePerNight) || 0)
  const taxRate = (settings?.tax_rate ?? 0) / 100
  const cleaningFee = settings?.cleaning_fee_cents ?? 0

  const subtotal = nightsNum * rateNum * 100  // cents
  const cleaning = includeCleaning ? cleaningFee : 0
  const subtotalWithCleaning = subtotal + cleaning
  const tax = Math.round(subtotalWithCleaning * taxRate)
  const preStripe = subtotalWithCleaning + tax
  const stripeFeeCents = includeStripe
    ? Math.round(preStripe * STRIPE_RATE) + STRIPE_FIXED
    : 0
  const total = preStripe + stripeFeeCents

  function fmt(cents) {
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  }

  return (
    <div className="bg-surface border border-border rounded-[8px] p-6">
      <div className="flex items-center gap-2 mb-5">
        <Calculator size={18} className="text-text-muted" />
        <h2 className="font-heading text-[18px] text-text-primary">Fee Calculator</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
            Nights
          </label>
          <input
            type="number"
            min={1}
            value={nights}
            onChange={e => setNights(e.target.value)}
            className="h-11 border-[1.5px] border-border rounded-[6px] px-3 font-mono text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
          />
        </div>
        <div className="flex flex-col">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
            Rate / Night ($)
          </label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={ratePerNight}
            onChange={e => setRatePerNight(e.target.value)}
            className="h-11 border-[1.5px] border-border rounded-[6px] px-3 font-mono text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <label className="flex items-center gap-2 cursor-pointer font-body text-[14px] text-text-secondary">
          <input
            type="checkbox"
            checked={includeCleaning}
            onChange={e => setIncludeCleaning(e.target.checked)}
            className="w-4 h-4 accent-text-primary"
          />
          Include cleaning fee ({fmt(cleaningFee)})
        </label>
        <label className="flex items-center gap-2 cursor-pointer font-body text-[14px] text-text-secondary">
          <input
            type="checkbox"
            checked={includeStripe}
            onChange={e => setIncludeStripe(e.target.checked)}
            className="w-4 h-4 accent-text-primary"
          />
          Include Stripe fees (2.9% + $0.30)
        </label>
      </div>

      {/* Breakdown */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between font-body text-[14px] text-text-secondary">
          <span>{nightsNum} night{nightsNum !== 1 ? 's' : ''} × {fmt(rateNum * 100)}</span>
          <span className="font-mono">{fmt(subtotal)}</span>
        </div>
        {includeCleaning && cleaningFee > 0 && (
          <div className="flex justify-between font-body text-[14px] text-text-secondary">
            <span>Cleaning fee</span>
            <span className="font-mono">{fmt(cleaning)}</span>
          </div>
        )}
        {taxRate > 0 && (
          <div className="flex justify-between font-body text-[14px] text-text-secondary">
            <span>Tax ({settings?.tax_rate ?? 0}%)</span>
            <span className="font-mono">{fmt(tax)}</span>
          </div>
        )}
        {includeStripe && (
          <div className="flex justify-between font-body text-[14px] text-text-secondary">
            <span>Stripe processing (2.9% + $0.30)</span>
            <span className="font-mono">{fmt(stripeFeeCents)}</span>
          </div>
        )}
        <hr className="border-border" />
        <div className="flex justify-between font-body text-[15px] font-semibold text-text-primary">
          <span>Total charged to guest</span>
          <span className="font-mono text-[16px]">{fmt(total)}</span>
        </div>
        {includeStripe && (
          <div className="flex justify-between font-body text-[13px] text-text-muted">
            <span>Your net after Stripe</span>
            <span className="font-mono">{fmt(total - stripeFeeCents)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Rates() {
  const { data: rooms = [], isLoading } = useRooms()
  const { data: settings } = usePropertySettings()

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">Rates</h1>
      </div>

      <p className="font-body text-[14px] text-text-secondary">
        Click any value to edit it inline. Press Enter to save or Escape to cancel.
        Set cleaning fees in <a href="/settings" className="text-info hover:underline">Settings → Tax &amp; Policy</a>.
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

      {/* Fee Calculator */}
      <FeeCalculator settings={settings} />
    </div>
  )
}
