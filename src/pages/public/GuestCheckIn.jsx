// src/pages/public/GuestCheckIn.jsx
// Mobile-first guest self check-in flow.
// URL: /check-in?c=CONFIRMATION_NUMBER
// Steps: Lookup → Review → Policies → Done

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import {
  CheckCircle, CalendarBlank, MapPin, Clock, ArrowRight,
  House, Warning, Spinner,
} from '@phosphor-icons/react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function lookupReservation(confirmation, email) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/guest-portal-lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation_number: confirmation.toUpperCase(), email }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Reservation not found')
  return data
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepBar({ step }) {
  const steps = ['Find', 'Review', 'Agree', 'Done']
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((label, i) => {
        const active = i + 1 === step
        const done = i + 1 < step
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-semibold transition-colors ${done ? 'bg-success text-white' : active ? 'bg-text-primary text-white' : 'bg-border text-text-muted'}`}>
              {done ? '✓' : i + 1}
            </div>
            <span className={`font-body text-[13px] hidden sm:block ${active ? 'text-text-primary font-semibold' : 'text-text-muted'}`}>{label}</span>
            {i < steps.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Look up reservation
// ---------------------------------------------------------------------------

function StepLookup({ prefillConfirmation, onFound }) {
  const [confirmation, setConfirmation] = useState(prefillConfirmation ?? '')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const emailRef = useRef(null)

  useEffect(() => {
    if (prefillConfirmation) {
      emailRef.current?.focus()
    }
  }, [prefillConfirmation])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!confirmation.trim() || !email.trim()) { setError('Both fields are required'); return }
    setLoading(true)
    try {
      const data = await lookupReservation(confirmation.trim(), email.trim())
      onFound(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <House size={40} className="text-text-secondary mx-auto mb-3" />
        <h2 className="font-heading text-[24px] text-text-primary">Guest Check-in</h2>
        <p className="font-body text-[15px] text-text-secondary mt-1">Enter your confirmation number and email to begin.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="checkin-confirmation" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">Confirmation Number</label>
          <input
            id="checkin-confirmation"
            value={confirmation}
            onChange={e => setConfirmation(e.target.value.toUpperCase())}
            placeholder="e.g. ABC123"
            maxLength={6}
            autoCapitalize="characters"
            className="h-12 border-[1.5px] border-border rounded-[6px] px-4 font-mono text-[18px] text-text-primary bg-surface-raised tracking-[0.15em] text-center focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="checkin-email" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">Email Address</label>
          <input
            id="checkin-email"
            ref={emailRef}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="guest@example.com"
            className="h-12 border-[1.5px] border-border rounded-[6px] px-4 font-body text-[16px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-danger-bg border border-danger rounded-[6px] p-3">
            <Warning size={16} className="text-danger mt-0.5 shrink-0" />
            <p className="font-body text-[14px] text-danger">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="h-12 bg-text-primary text-white font-body font-semibold text-[16px] rounded-[6px] flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity active:scale-[0.98]"
        >
          {loading ? <Spinner size={20} className="animate-spin" /> : <><span>Find My Reservation</span><ArrowRight size={18} /></>}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Review reservation details
// ---------------------------------------------------------------------------

function StepReview({ data, onNext }) {
  const { reservation, rooms, paymentSummary } = data
  const nights = reservation.check_in && reservation.check_out
    ? differenceInCalendarDays(parseISO(reservation.check_out), parseISO(reservation.check_in))
    : 0

  const prop = reservation.properties

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <CheckCircle size={40} className="text-success mx-auto mb-3" weight="fill" />
        <h2 className="font-heading text-[24px] text-text-primary">Your Reservation</h2>
        <p className="font-mono text-[15px] text-text-muted">{reservation.confirmation_number}</p>
      </div>

      {/* Property + room */}
      <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
        <div className="p-4 border-b border-border">
          <p className="font-body font-semibold text-[16px] text-text-primary">{prop?.name ?? 'Your Stay'}</p>
          {prop?.location && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={13} className="text-text-muted" />
              <p className="font-body text-[13px] text-text-muted">{prop.location}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="p-4">
            <p className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-muted mb-1">Check-in</p>
            <p className="font-body font-semibold text-[15px] text-text-primary">
              {reservation.check_in ? format(parseISO(reservation.check_in), 'EEE, MMM d') : '—'}
            </p>
            {prop?.check_in_time && (
              <div className="flex items-center gap-1 mt-0.5">
                <Clock size={12} className="text-text-muted" />
                <p className="font-body text-[13px] text-text-muted">from {prop.check_in_time}</p>
              </div>
            )}
          </div>
          <div className="p-4">
            <p className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-muted mb-1">Check-out</p>
            <p className="font-body font-semibold text-[15px] text-text-primary">
              {reservation.check_out ? format(parseISO(reservation.check_out), 'EEE, MMM d') : '—'}
            </p>
            {prop?.check_out_time && (
              <div className="flex items-center gap-1 mt-0.5">
                <Clock size={12} className="text-text-muted" />
                <p className="font-body text-[13px] text-text-muted">by {prop.check_out_time}</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-border bg-surface">
          <p className="font-body text-[13px] text-text-muted">{nights} night{nights !== 1 ? 's' : ''} · {reservation.num_guests} guest{reservation.num_guests !== 1 ? 's' : ''}</p>
          {rooms.length > 0 && (
            <p className="font-body text-[14px] text-text-primary mt-1">{rooms.map(r => r.name).join(', ')}</p>
          )}
        </div>
      </div>

      {/* Payment summary */}
      <div className="bg-surface border border-border rounded-[12px] p-4 flex flex-col gap-2">
        <p className="font-body text-[13px] uppercase tracking-wider font-semibold text-text-muted mb-1">Payment</p>
        <div className="flex justify-between font-body text-[14px] text-text-secondary">
          <span>Total</span>
          <span className="font-mono">${(reservation.total_due_cents / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-body text-[14px] text-text-secondary">
          <span>Paid</span>
          <span className="font-mono text-success">${((paymentSummary?.paidCents ?? 0) / 100).toFixed(2)}</span>
        </div>
        {paymentSummary?.balanceCents > 0 && (
          <div className="flex justify-between font-body font-semibold text-[15px] text-text-primary border-t border-border pt-2 mt-1">
            <span>Balance due</span>
            <span className="font-mono text-warning">${(paymentSummary.balanceCents / 100).toFixed(2)}</span>
          </div>
        )}
        {paymentSummary?.status === 'paid' && (
          <div className="flex items-center gap-1 mt-1">
            <CheckCircle size={14} className="text-success" weight="fill" />
            <span className="font-body text-[13px] text-success font-semibold">Paid in full</span>
          </div>
        )}
      </div>

      <button
        onClick={onNext}
        className="h-12 bg-text-primary text-white font-body font-semibold text-[16px] rounded-[6px] flex items-center justify-center gap-2 active:scale-[0.98]"
      >
        Continue <ArrowRight size={18} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Policies / agree
// ---------------------------------------------------------------------------

function StepPolicies({ data, onNext }) {
  const [agreed, setAgreed] = useState(false)
  const prop = data.reservation.properties

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="font-heading text-[24px] text-text-primary">House Policies</h2>
        <p className="font-body text-[15px] text-text-secondary mt-1">Please review before completing check-in.</p>
      </div>

      <div className="bg-surface border border-border rounded-[12px] p-5 flex flex-col gap-4">
        {prop?.check_in_time && (
          <div>
            <p className="font-body text-[13px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">Check-in / Check-out</p>
            <p className="font-body text-[14px] text-text-primary">Check-in from {prop.check_in_time} · Check-out by {prop.check_out_time}</p>
          </div>
        )}
        {prop?.min_stay_nights > 1 && (
          <div>
            <p className="font-body text-[13px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">Minimum Stay</p>
            <p className="font-body text-[14px] text-text-primary">{prop.min_stay_nights} nights</p>
          </div>
        )}
        <div>
          <p className="font-body text-[13px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">Cancellation Policy</p>
          <p className="font-body text-[14px] text-text-primary capitalize">{prop?.cancellation_policy ?? 'See your reservation confirmation for details.'}</p>
        </div>
        {prop?.house_rules && (
          <div>
            <p className="font-body text-[13px] font-semibold text-text-secondary uppercase tracking-wider mb-0.5">House Rules</p>
            <ul className="font-body text-[14px] text-text-primary space-y-1 list-disc list-inside">
              {prop.house_rules.split('\n').map((rule, i) => rule.trim() && (
                <li key={i}>{rule.trim()}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
          className="mt-1 w-5 h-5 accent-text-primary rounded" />
        <span className="font-body text-[15px] text-text-primary">
          I have read and agree to the house policies and cancellation policy.
        </span>
      </label>

      <button
        onClick={onNext}
        disabled={!agreed}
        className="h-12 bg-text-primary text-white font-body font-semibold text-[16px] rounded-[6px] flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all"
      >
        Complete Check-in <ArrowRight size={18} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: Done
// ---------------------------------------------------------------------------

function StepDone({ data }) {
  const { reservation, rooms } = data
  const prop = reservation.properties

  return (
    <div className="flex flex-col gap-6 text-center">
      <div>
        <div className="w-20 h-20 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={48} className="text-success" weight="fill" />
        </div>
        <h2 className="font-heading text-[28px] text-text-primary">You're checked in!</h2>
        <p className="font-body text-[16px] text-text-secondary mt-2">Welcome to {prop?.name ?? 'your stay'}.</p>
      </div>

      <div className="bg-surface border border-border rounded-[12px] p-5 text-left flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="font-body text-[14px] text-text-muted">Confirmation</span>
          <span className="font-mono text-[16px] text-text-primary font-semibold tracking-wide">{reservation.confirmation_number}</span>
        </div>
        {rooms.length > 0 && (
          <div className="flex justify-between items-center">
            <span className="font-body text-[14px] text-text-muted">Room(s)</span>
            <span className="font-body text-[14px] text-text-primary">{rooms.map(r => r.name).join(', ')}</span>
          </div>
        )}
        {prop?.check_out_time && reservation.check_out && (
          <div className="flex justify-between items-center">
            <span className="font-body text-[14px] text-text-muted">Check-out</span>
            <span className="font-body text-[14px] text-text-primary">
              {format(parseISO(reservation.check_out), 'EEE, MMM d')} by {prop.check_out_time}
            </span>
          </div>
        )}
      </div>

      <p className="font-body text-[14px] text-text-muted">
        Enjoy your stay! If you need anything, contact the property directly.
      </p>

      <a
        href={`/guest-portal?confirmation=${reservation.confirmation_number}`}
        className="font-body text-[14px] text-info underline"
      >
        View full reservation details →
      </a>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export default function GuestCheckIn() {
  const [params] = useSearchParams()
  const prefill = params.get('c') ?? params.get('confirmation') ?? ''

  const [step, setStep] = useState(1)
  const [lookupData, setLookupData] = useState(null)

  function handleFound(data) { setLookupData(data); setStep(2) }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-start py-10 px-4">
      <div className="w-full max-w-md">
        {/* Logo / property brand */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <CalendarBlank size={24} className="text-text-primary" />
          <span className="font-heading text-[20px] text-text-primary">Lodge-ical</span>
        </div>

        <StepBar step={step} />

        <div className="bg-surface-raised rounded-[16px] border border-border shadow-sm p-6">
          {step === 1 && <StepLookup prefillConfirmation={prefill} onFound={handleFound} />}
          {step === 2 && <StepReview data={lookupData} onNext={() => setStep(3)} />}
          {step === 3 && <StepPolicies data={lookupData} onNext={() => setStep(4)} />}
          {step === 4 && <StepDone data={lookupData} />}
        </div>
      </div>
    </div>
  )
}
