// src/components/widget/InquiryStep.jsx
// Guest inquiry form — NOT a booking. Collects interest for dates
// that aren't available (sold out or seasonal closure).

import { useState } from 'react'
import { format, differenceInCalendarDays } from 'date-fns'
import { Info, CheckCircle } from '@phosphor-icons/react'
import { DayPicker } from 'react-day-picker'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const GUEST_RANGES = ['1-2', '3-4', '5-6', '7+']

export function InquiryStep({ checkIn, checkOut, propertyId, rooms = [], closureMessage, onBack }) {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Form state
  const [localCheckIn, setLocalCheckIn] = useState(checkIn)
  const [localCheckOut, setLocalCheckOut] = useState(checkOut)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [guestsRange, setGuestsRange] = useState('1-2')
  const [selectedRoomIds, setSelectedRoomIds] = useState(new Set())
  const [notes, setNotes] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  // Date editing
  const [editingDates, setEditingDates] = useState(false)
  const [dateRange, setDateRange] = useState({
    from: localCheckIn ? new Date(localCheckIn + 'T12:00:00') : undefined,
    to: localCheckOut ? new Date(localCheckOut + 'T12:00:00') : undefined,
  })

  const nights = localCheckIn && localCheckOut
    ? differenceInCalendarDays(new Date(localCheckOut + 'T12:00:00'), new Date(localCheckIn + 'T12:00:00'))
    : 0

  const canSubmit = firstName.trim() && lastName.trim() && email.trim() && acknowledged && localCheckIn && localCheckOut

  function toggleRoom(roomId) {
    setSelectedRoomIds(prev => {
      const next = new Set(prev)
      if (next.has(roomId)) next.delete(roomId)
      else next.add(roomId)
      return next
    })
  }

  function handleDateSelect(range) {
    setDateRange(range ?? {})
    if (range?.from && range?.to) {
      setLocalCheckIn(format(range.from, 'yyyy-MM-dd'))
      setLocalCheckOut(format(range.to, 'yyyy-MM-dd'))
      setEditingDates(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-inquiry`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            check_in: localCheckIn,
            check_out: localCheckOut,
            guest_first_name: firstName.trim(),
            guest_last_name: lastName.trim(),
            guest_email: email.trim(),
            guest_phone: phone.trim() || undefined,
            num_guests_range: guestsRange,
            room_ids: selectedRoomIds.size > 0 ? [...selectedRoomIds] : undefined,
            notes: notes.trim() || undefined,
            acknowledged: true,
          }),
        }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Failed to submit inquiry')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success state ──────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="text-center py-8" role="status" aria-live="polite">
        <CheckCircle size={32} weight="fill" className="text-success mx-auto mb-3" />
        <h2 className="font-heading text-[24px] text-text-primary mb-2">Inquiry sent!</h2>
        <p className="font-body text-[15px] text-text-secondary max-w-sm mx-auto mb-6">
          We&apos;ve received your inquiry for{' '}
          <span className="font-mono text-[14px]">
            {format(new Date(localCheckIn + 'T12:00:00'), 'MMM d')} – {format(new Date(localCheckOut + 'T12:00:00'), 'MMM d, yyyy')}
          </span>.
          If availability opens up, we&apos;ll reach out to <strong>{email}</strong>.
        </p>
        <Button variant="secondary" size="md" onClick={onBack}>
          Back to search
        </Button>
      </div>
    )
  }

  // ── Inquiry form ───────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Warning banner */}
      <div className="bg-warning-bg border border-warning rounded-[8px] p-4 flex gap-3">
        <Info size={18} weight="fill" className="text-warning shrink-0 mt-0.5" />
        <div>
          <p className="font-body text-[14px] font-semibold text-text-primary">
            This is an inquiry, not a reservation.
          </p>
          <p className="font-body text-[13px] text-text-secondary mt-1">
            {closureMessage || 'Your dates are not held or guaranteed. If availability opens up, we\u2019ll contact you to complete a booking.'}
          </p>
        </div>
      </div>

      {/* Dates (editable) */}
      <div>
        <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
          Dates
        </p>
        {!editingDates ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[14px] text-text-primary">
              {localCheckIn && localCheckOut
                ? `${format(new Date(localCheckIn + 'T12:00:00'), 'MMM d')} – ${format(new Date(localCheckOut + 'T12:00:00'), 'MMM d, yyyy')} · ${nights} night${nights !== 1 ? 's' : ''}`
                : 'No dates selected'}
            </span>
            <button
              type="button"
              onClick={() => setEditingDates(true)}
              className="font-body text-[13px] text-info hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="border border-border rounded-[8px] p-3 bg-surface">
            <DayPicker
              mode="range"
              selected={dateRange}
              onSelect={handleDateSelect}
              disabled={{ before: new Date() }}
              numberOfMonths={1}
              className="font-body text-[14px]"
            />
          </div>
        )}
      </div>

      {/* Guest info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="inq-first" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1 block">
            First name *
          </label>
          <input
            id="inq-first"
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            required
            className="w-full h-11 border-[1.5px] border-border rounded-[6px] px-3 font-body text-[15px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
          />
        </div>
        <div>
          <label htmlFor="inq-last" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1 block">
            Last name *
          </label>
          <input
            id="inq-last"
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            required
            className="w-full h-11 border-[1.5px] border-border rounded-[6px] px-3 font-body text-[15px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
          />
        </div>
      </div>

      <div>
        <label htmlFor="inq-email" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1 block">
          Email *
        </label>
        <input
          id="inq-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full h-11 border-[1.5px] border-border rounded-[6px] px-3 font-body text-[15px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
        />
      </div>

      <div>
        <label htmlFor="inq-phone" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1 block">
          Phone (optional)
        </label>
        <input
          id="inq-phone"
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full h-11 border-[1.5px] border-border rounded-[6px] px-3 font-body text-[15px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
        />
      </div>

      {/* Guest count */}
      <fieldset>
        <legend className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-2">
          Number of guests
        </legend>
        <div className="flex gap-2 flex-wrap">
          {GUEST_RANGES.map(range => (
            <label
              key={range}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-[6px] border cursor-pointer font-body text-[14px] transition-colors',
                guestsRange === range
                  ? 'border-info bg-info-bg text-info'
                  : 'border-border bg-surface-raised text-text-secondary hover:border-text-muted'
              )}
            >
              <input
                type="radio"
                name="guests_range"
                value={range}
                checked={guestsRange === range}
                onChange={() => setGuestsRange(range)}
                className="sr-only"
              />
              {range === '7+' ? '7+ guests' : `${range} guests`}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Room interest */}
      {rooms.length > 0 && (
        <fieldset>
          <legend className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-2">
            Which rooms interest you? (optional)
          </legend>
          <div className="flex flex-col gap-2">
            {rooms.map(room => (
              <label
                key={room.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-[6px] border cursor-pointer font-body text-[14px] transition-colors',
                  selectedRoomIds.has(room.id)
                    ? 'border-info bg-info-bg text-text-primary'
                    : 'border-border bg-surface-raised text-text-secondary hover:border-text-muted'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedRoomIds.has(room.id)}
                  onChange={() => toggleRoom(room.id)}
                  className="accent-info w-4 h-4"
                />
                <span>{room.name}</span>
                {room.max_guests && (
                  <span className="text-text-muted text-[12px] ml-auto">up to {room.max_guests} guests</span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Notes */}
      <div>
        <label htmlFor="inq-notes" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1 block">
          Notes (optional)
        </label>
        <textarea
          id="inq-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Anything else you'd like us to know?"
          className="w-full border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-none"
        />
      </div>

      {/* Acknowledgement checkbox */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={e => setAcknowledged(e.target.checked)}
          className="accent-info w-4 h-4 mt-1 shrink-0"
        />
        <span className="font-body text-[14px] text-text-primary font-semibold leading-snug">
          I understand this is an inquiry only — not an official booking or reservation.
        </span>
      </label>

      {/* Error */}
      {error && (
        <p className="font-body text-[14px] text-danger">{error}</p>
      )}

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={!canSubmit || submitting}
        className="w-full"
      >
        {submitting ? 'Sending...' : 'Send Inquiry'}
      </Button>

      <p className="font-body text-[12px] text-text-muted text-center">
        By submitting, you&apos;re expressing interest only. No charges will be made and no rooms are reserved.
      </p>

      {/* Back */}
      <Button variant="ghost" size="sm" onClick={onBack} className="text-text-secondary">
        &larr; Back
      </Button>
    </form>
  )
}
