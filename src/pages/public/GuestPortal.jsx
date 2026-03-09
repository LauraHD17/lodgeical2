// src/pages/public/GuestPortal.jsx
// Self-service guest lookup portal. No auth required.
// Tabbed interface: Upcoming Reservation, History, Payments, Contact Info.

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import { ArrowLeft, SpinnerGap, WarningCircle, PencilSimple, CheckCircle, Printer, ClockCounterClockwise, CreditCard, UserCircle, EnvelopeSimple } from '@phosphor-icons/react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { StatusChip } from '@/components/shared/StatusChip'
import { fmtMoney as formatCents, cn } from '@/lib/utils'

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

const today = new Date().toISOString().slice(0, 10)

// ─── Stripe Payment Form ───────────────────────────────────────────────────────

function GuestPaymentForm({ balanceCents, onSuccess, onError }) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)

  async function handlePay() {
    if (!stripe || !elements) return
    setPaying(true)
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })
    if (error) {
      onError(error.message)
      setPaying(false)
    } else {
      onSuccess()
    }
  }

  return (
    <div className="mt-4">
      <PaymentElement />
      <Button
        variant="primary"
        size="lg"
        loading={paying}
        onClick={handlePay}
        className="w-full mt-4"
      >
        Pay {formatCents(balanceCents)}
      </Button>
    </div>
  )
}

// ─── Payment Section ───────────────────────────────────────────────────────────

function PaymentSection({ reservation, paymentSummary, onPaymentSuccess }) {
  const [showPayment, setShowPayment] = useState(false)
  const [stripePromise, setStripePromise] = useState(null)
  const [clientSecret, setClientSecret] = useState(null)
  const [payError, setPayError] = useState('')
  const [loadingIntent, setLoadingIntent] = useState(false)

  const balanceCents = paymentSummary?.balanceCents ?? paymentSummary?.balance_cents ?? 0
  const paymentStatus = paymentSummary?.status || reservation.payment_status || 'unpaid'

  async function initiatePayment() {
    setShowPayment(true)
    setLoadingIntent(true)
    setPayError('')

    try {
      const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
      if (!stripeKey) {
        setPayError('Online payment is not available. Please contact the property.')
        setLoadingIntent(false)
        return
      }

      setStripePromise(loadStripe(stripeKey))

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-guest-payment': 'true',
          },
          body: JSON.stringify({
            reservation_id: reservation.id,
            amount_cents: balanceCents,
          }),
        }
      )
      const data = await res.json()
      if (data.client_secret) {
        setClientSecret(data.client_secret)
      } else {
        setPayError(data.error || 'Could not initialize payment.')
      }
    } catch {
      setPayError('Network error. Please try again.')
    } finally {
      setLoadingIntent(false)
    }
  }

  return (
    <div className="bg-surface-raised border border-border rounded-[8px] p-5 mb-4">
      <h3 className="font-heading text-[16px] text-text-primary mb-3">Payment</h3>

      <div className="flex items-center justify-between mb-2">
        <span className="font-body text-[14px] text-text-secondary">Status</span>
        <StatusChip status={paymentStatus} type="payment" />
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="font-body text-[14px] text-text-secondary">Balance Due</span>
        <span className="font-mono text-[14px] text-text-primary font-semibold">
          {formatCents(balanceCents)}
        </span>
      </div>

      {balanceCents > 0 && !showPayment && (
        <Button variant="primary" size="md" onClick={initiatePayment} className="w-full">
          Make Payment
        </Button>
      )}

      {showPayment && (
        <div>
          {payError && (
            <div className="flex items-start gap-2 p-3 bg-danger-bg border border-danger rounded-[6px] mb-3">
              <WarningCircle size={16} weight="fill" className="text-danger shrink-0 mt-0.5" />
              <div>
                <p className="font-body text-[13px] text-danger">{payError}</p>
                <button
                  type="button"
                  onClick={() => { setPayError(''); setShowPayment(false); setClientSecret(null) }}
                  className="font-body text-[13px] text-info underline mt-1"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
          {loadingIntent && (
            <div className="flex items-center gap-2 text-text-muted font-body text-[14px]">
              <SpinnerGap size={16} className="animate-spin" />
              Preparing payment…
            </div>
          )}
          {!loadingIntent && !payError && clientSecret && stripePromise && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <GuestPaymentForm
                balanceCents={balanceCents}
                onSuccess={() => {
                  setShowPayment(false)
                  onPaymentSuccess()
                }}
                onError={(msg) => setPayError(msg)}
              />
            </Elements>
          )}
          {!loadingIntent && !clientSecret && !payError && (
            <p className="font-body text-[14px] text-text-muted">Unable to load payment form.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Cancellation Section ──────────────────────────────────────────────────────

function CancellationSection({ reservation, onCancelled }) {
  const [step, setStep] = useState('idle') // 'idle' | 'previewing' | 'confirming' | 'done'
  const [preview, setPreview] = useState(null)
  const [cancelError, setCancelError] = useState('')
  const [loading, setLoading] = useState(false)

  const guestIdentity = {
    email: reservation.guests?.email ?? '',
    first_name: reservation.guests?.first_name ?? '',
    last_name: reservation.guests?.last_name ?? '',
  }

  async function fetchPreview() {
    setLoading(true)
    setCancelError('')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-reservation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservation_id: reservation.id,
            preview_only: true,
            ...guestIdentity,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setCancelError(data.error || 'Could not load cancellation preview.')
        setStep('idle')
      } else {
        setPreview(data)
        setStep('previewing')
      }
    } catch {
      setCancelError('Network error. Please try again.')
      setStep('idle')
    } finally {
      setLoading(false)
    }
  }

  async function confirmCancel() {
    setLoading(true)
    setCancelError('')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-reservation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservation_id: reservation.id,
            preview_only: false,
            ...guestIdentity,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setCancelError(data.error || 'Cancellation failed. Please contact the property.')
      } else {
        setPreview(prev => ({ ...prev, refund_cents: data.refund_cents ?? prev?.refund_cents ?? 0 }))
        setStep('done')
        onCancelled()
      }
    } catch {
      setCancelError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (reservation.status === 'cancelled') {
    return null
  }

  return (
    <div className="bg-surface-raised border border-border rounded-[8px] p-5 mb-4">
      <h3 className="font-heading text-[16px] text-text-primary mb-3">Cancellation</h3>

      {cancelError && (
        <div className="flex items-start gap-2 p-3 bg-danger-bg border border-danger rounded-[6px] mb-3">
          <WarningCircle size={16} weight="fill" className="text-danger shrink-0 mt-0.5" />
          <p className="font-body text-[13px] text-danger">{cancelError}</p>
        </div>
      )}

      {step === 'idle' && (
        <Button
          variant="secondary"
          size="md"
          loading={loading}
          onClick={fetchPreview}
          className="text-danger border-danger hover:opacity-80"
        >
          Cancel Reservation
        </Button>
      )}

      {step === 'previewing' && preview && (
        <div>
          <div className="bg-danger-bg border border-danger rounded-[6px] p-4 mb-4">
            <p className="font-body text-[14px] text-danger font-semibold mb-1">
              Are you sure you want to cancel?
            </p>
            {preview.refund_cents != null && (
              <p className="font-body text-[14px] text-text-primary">
                Refund amount:{' '}
                <span className="font-mono">{formatCents(preview.refund_cents)}</span>
              </p>
            )}
            {preview.policy_note && (
              <p className="font-body text-[13px] text-text-secondary mt-1">{preview.policy_note}</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={() => setStep('idle')} disabled={loading}>
              Keep Reservation
            </Button>
            <Button
              variant="destructive"
              size="md"
              loading={loading}
              onClick={confirmCancel}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div>
          <div className="flex flex-col items-center text-center py-4">
            <CheckCircle size={48} weight="fill" className="text-success mb-3" />
            <h3 className="font-heading text-[18px] text-text-primary mb-1">Reservation Cancelled</h3>
            <p className="font-mono text-[14px] text-text-secondary mb-3">
              Confirmation: {reservation.confirmation_number}
            </p>
            {preview?.refund_cents > 0 && (
              <p className="font-body text-[14px] text-text-primary mb-2">
                Refund amount: <span className="font-mono font-semibold">{formatCents(preview.refund_cents)}</span>
              </p>
            )}
            <p className="font-body text-[13px] text-text-muted mb-4">
              A cancellation confirmation email has been sent to{' '}
              <span className="text-text-primary font-semibold">{reservation.guests?.email}</span>.
            </p>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 h-11 px-4 text-[15px] font-body font-medium bg-transparent border-[1.5px] border-text-primary text-text-primary rounded-none hover:opacity-80 transition-opacity print:hidden"
            >
              <Printer size={16} />
              Print Confirmation
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Modification Section ─────────────────────────────────────────────────────

function ModificationPaymentForm({ balanceCents, onSuccess, onError }) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)

  async function handlePay() {
    if (!stripe || !elements) return
    setPaying(true)
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    if (error) {
      onError(error.message)
      setPaying(false)
    } else {
      onSuccess()
    }
  }

  return (
    <div className="mt-4">
      <PaymentElement />
      <Button variant="primary" size="lg" loading={paying} onClick={handlePay} className="w-full mt-4">
        Pay {formatCents(balanceCents)} & Confirm
      </Button>
    </div>
  )
}

function ModificationSection({ reservation, availableRooms, onModified }) {
  const [step, setStep] = useState('idle') // idle | dates | review | payment | done
  const [newCheckIn, setNewCheckIn] = useState(null)
  const [newCheckOut, setNewCheckOut] = useState(null)
  const [newRoomIds, setNewRoomIds] = useState(reservation.room_ids ?? [])
  const [newNumGuests, setNewNumGuests] = useState(reservation.num_guests ?? 1)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clientSecret, setClientSecret] = useState(null)
  const [paymentIntentId, setPaymentIntentId] = useState(null)
  const [stripePromise, setStripePromise] = useState(null)
  const [payError, setPayError] = useState('')

  const guestIdentity = {
    email: reservation.guests?.email ?? '',
    first_name: reservation.guests?.first_name ?? '',
    last_name: reservation.guests?.last_name ?? '',
  }

  const selectedRooms = (availableRooms ?? []).filter(r => newRoomIds.includes(r.id))
  const maxGuests = selectedRooms.reduce((sum, r) => sum + (r.max_guests ?? 2), 0) || 10
  const nights = newCheckIn && newCheckOut ? differenceInCalendarDays(newCheckOut, newCheckIn) : 0

  // Already modified
  if ((reservation.modification_count ?? 0) >= 1) {
    return (
      <div className="bg-surface-raised border border-border rounded-[8px] p-5 mb-4">
        <h3 className="font-heading text-[16px] text-text-primary mb-2">Modify Reservation</h3>
        <p className="font-body text-[14px] text-text-muted">
          This reservation has already been modified. Only one modification is allowed per booking.
        </p>
      </div>
    )
  }

  if (reservation.status === 'cancelled') return null

  async function fetchPreview() {
    if (!newCheckIn || !newCheckOut || newRoomIds.length === 0) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/modify-reservation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservation_id: reservation.id,
            preview_only: true,
            new_check_in: format(newCheckIn, 'yyyy-MM-dd'),
            new_check_out: format(newCheckOut, 'yyyy-MM-dd'),
            new_room_ids: newRoomIds,
            new_num_guests: newNumGuests,
            ...guestIdentity,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not preview modification.')
        return
      }
      setPreview(data)
      setStep('review')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function applyModification() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/modify-reservation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservation_id: reservation.id,
            preview_only: false,
            new_check_in: format(newCheckIn, 'yyyy-MM-dd'),
            new_check_out: format(newCheckOut, 'yyyy-MM-dd'),
            new_room_ids: newRoomIds,
            new_num_guests: newNumGuests,
            ...guestIdentity,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Modification failed.')
        return
      }
      if (data.requires_payment) {
        setClientSecret(data.client_secret)
        setPaymentIntentId(data.payment_intent_id)
        const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
        if (stripeKey) {
          setStripePromise(loadStripe(stripeKey))
          setStep('payment')
        } else {
          setError('Online payment is not available. Please contact the property.')
        }
      } else {
        setStep('done')
        onModified()
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmAfterPayment() {
    setLoading(true)
    setPayError('')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/confirm-modification`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservation_id: reservation.id,
            payment_intent_id: paymentIntentId,
            ...guestIdentity,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setPayError(data.error || 'Confirmation failed.')
        return
      }
      setStep('done')
      onModified()
    } catch {
      setPayError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selected = newCheckIn && newCheckOut ? { from: newCheckIn, to: newCheckOut } : newCheckIn ? { from: newCheckIn } : undefined

  return (
    <div className="bg-surface-raised border border-border rounded-[8px] p-5 mb-4">
      <h3 className="font-heading text-[16px] text-text-primary mb-3">
        <PencilSimple size={16} weight="bold" className="inline mr-2" />
        Modify Reservation
      </h3>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-danger-bg border border-danger rounded-[6px] mb-3">
          <WarningCircle size={16} weight="fill" className="text-danger shrink-0 mt-0.5" />
          <p className="font-body text-[13px] text-danger">{error}</p>
        </div>
      )}

      {step === 'idle' && (
        <div>
          <p className="font-body text-[14px] text-text-secondary mb-3">
            You may modify this reservation once. Changes must be equal to or greater than the original booking value.
          </p>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setNewCheckIn(parseISO(reservation.check_in))
              setNewCheckOut(parseISO(reservation.check_out))
              setNewRoomIds(reservation.room_ids ?? [])
              setNewNumGuests(reservation.num_guests ?? 1)
              setStep('dates')
            }}
          >
            Start Modification
          </Button>
        </div>
      )}

      {step === 'dates' && (
        <div>
          <p className="font-body text-[14px] text-text-secondary mb-4">Select new dates:</p>
          <div className="flex justify-center mb-4">
            <DayPicker
              mode="range"
              selected={selected}
              onSelect={(range) => {
                if (!range) { setNewCheckIn(null); setNewCheckOut(null); return }
                setNewCheckIn(range.from ?? null)
                setNewCheckOut(range.to ?? null)
              }}
              numberOfMonths={2}
              disabled={[{ before: new Date() }]}
              fromDate={new Date()}
            />
          </div>

          {newCheckIn && newCheckOut && nights > 0 && (
            <div className="p-3 bg-info-bg border border-info rounded-[6px] mb-4">
              <span className="font-body text-[14px] text-info">
                {format(newCheckIn, 'MMM d, yyyy')} → {format(newCheckOut, 'MMM d, yyyy')} ({nights} nights)
              </span>
            </div>
          )}

          {/* Room selection */}
          {availableRooms && availableRooms.length > 0 && (
            <div className="mb-4">
              <p className="font-body text-[13px] text-text-secondary uppercase tracking-[0.06em] font-semibold mb-2">Rooms</p>
              <div className="flex flex-col gap-2">
                {availableRooms.map(room => {
                  const isSelected = newRoomIds.includes(room.id)
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setNewRoomIds(prev => prev.includes(room.id) ? prev.filter(id => id !== room.id) : [...prev, room.id])}
                      className={`text-left p-3 rounded-[6px] border transition-colors ${isSelected ? 'border-info bg-info-bg' : 'border-border bg-surface'}`}
                    >
                      <span className="font-body text-[14px] text-text-primary font-medium">{room.name}</span>
                      <span className="font-mono text-[13px] text-text-secondary ml-2">
                        ${((room.base_rate_cents ?? 0) / 100).toFixed(2)}/night
                      </span>
                      <span className="font-body text-[12px] text-text-muted ml-2">Max {room.max_guests ?? 2} guests</span>
                      {isSelected && <CheckCircle size={14} weight="fill" className="inline ml-2 text-info" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Guest count */}
          <div className="mb-4">
            <Input
              label={`Number of Guests (max ${maxGuests})`}
              type="number"
              min={1}
              max={maxGuests}
              value={newNumGuests}
              onChange={(e) => setNewNumGuests(Math.min(maxGuests, Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={() => { setStep('idle'); setError('') }}>Cancel</Button>
            <Button
              variant="primary"
              size="md"
              loading={loading}
              disabled={!newCheckIn || !newCheckOut || nights <= 0 || newRoomIds.length === 0}
              onClick={fetchPreview}
            >
              Preview Changes
            </Button>
          </div>
        </div>
      )}

      {step === 'review' && preview && (
        <div>
          <p className="font-body text-[14px] text-text-secondary mb-3">Review your changes:</p>
          <div className="bg-surface border border-border rounded-[6px] p-4 mb-4">
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="font-body text-[11px] text-text-muted uppercase mb-1">Original</p>
                <p className="font-mono text-[13px] text-text-primary">
                  {formatDate(preview.original.check_in)} → {formatDate(preview.original.check_out)}
                </p>
                <p className="font-mono text-[14px] text-text-primary font-semibold">{formatCents(preview.original.total_cents)}</p>
              </div>
              <div>
                <p className="font-body text-[11px] text-text-muted uppercase mb-1">Modified</p>
                <p className="font-mono text-[13px] text-text-primary">
                  {formatDate(preview.modified.check_in)} → {formatDate(preview.modified.check_out)}
                </p>
                <p className="font-mono text-[14px] text-text-primary font-semibold">{formatCents(preview.modified.total_cents)}</p>
              </div>
            </div>
            {preview.balance_due_cents > 0 && (
              <div className="pt-3 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="font-body text-[14px] text-text-secondary">Balance due</span>
                  <span className="font-mono text-[16px] text-danger font-semibold">{formatCents(preview.balance_due_cents)}</span>
                </div>
                <p className="font-body text-[12px] text-text-muted mt-1">Payment is required to confirm this change.</p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="md" onClick={() => setStep('dates')}>Back</Button>
            <Button variant="primary" size="md" loading={loading} onClick={applyModification}>
              {preview.requires_payment ? 'Continue to Payment' : 'Confirm Modification'}
            </Button>
          </div>
        </div>
      )}

      {step === 'payment' && clientSecret && stripePromise && (
        <div>
          <p className="font-body text-[14px] text-text-secondary mb-3">
            Pay the balance due to confirm your modification:
          </p>
          {payError && (
            <div className="flex items-start gap-2 p-3 bg-danger-bg border border-danger rounded-[6px] mb-3">
              <WarningCircle size={16} weight="fill" className="text-danger shrink-0 mt-0.5" />
              <p className="font-body text-[13px] text-danger">{payError}</p>
            </div>
          )}
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <ModificationPaymentForm
              balanceCents={preview?.balance_due_cents ?? 0}
              onSuccess={confirmAfterPayment}
              onError={(msg) => setPayError(msg)}
            />
          </Elements>
        </div>
      )}

      {step === 'done' && (
        <div className="flex items-start gap-2 p-3 bg-success-bg border border-success rounded-[6px]">
          <CheckCircle size={16} weight="fill" className="text-success shrink-0 mt-0.5" />
          <p className="font-body text-[14px] text-success font-semibold">
            Reservation modified successfully. You will receive an updated confirmation email.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Reservation Card (shared between Upcoming + History) ─────────────────────

function ReservationCard({ reservation, rooms, compact }) {
  const guestName = [
    reservation.guests?.first_name,
    reservation.guests?.last_name,
  ].filter(Boolean).join(' ')

  const roomNames = (rooms ?? [])
    .filter(r => (reservation.room_ids ?? []).includes(r.id))
    .map(r => r.name)
    .join(', ')

  return (
    <div className="bg-surface-raised border border-border rounded-[8px] p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em] mb-1">
            Confirmation
          </p>
          <span className="font-mono text-[16px] text-text-primary font-semibold bg-surface px-3 py-1 rounded-[4px]">
            {reservation.confirmation_number}
          </span>
        </div>
        <StatusChip status={reservation.status} type="reservation" />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-3">
        <div>
          <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em] mb-1">Check-in</p>
          <p className="font-mono text-[14px] text-text-primary">{formatDate(reservation.check_in)}</p>
          {!compact && reservation.check_in_time && (
            <p className="font-body text-[12px] text-text-muted">after {reservation.check_in_time}</p>
          )}
        </div>
        <div>
          <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em] mb-1">Check-out</p>
          <p className="font-mono text-[14px] text-text-primary">{formatDate(reservation.check_out)}</p>
          {!compact && reservation.check_out_time && (
            <p className="font-body text-[12px] text-text-muted">by {reservation.check_out_time}</p>
          )}
        </div>
      </div>

      {roomNames && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em] mb-1">Room</p>
          <p className="font-body text-[14px] text-text-primary">{roomNames}</p>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-4">
        <div>
          <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em] mb-1">Guest</p>
          <p className="font-body text-[14px] text-text-primary">{guestName || '—'}</p>
        </div>
        {reservation.num_guests && (
          <div>
            <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em] mb-1">Guests</p>
            <p className="font-body text-[14px] text-text-primary">{reservation.num_guests}</p>
          </div>
        )}
      </div>

      {!compact && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em]">Total</p>
            <p className="font-mono text-[16px] text-text-primary font-semibold">{formatCents(reservation.total_due_cents ?? 0)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Print Button ─────────────────────────────────────────────────────────────

function PrintButton({ label }) {
  return (
    <div className="flex justify-center print:hidden mt-4">
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 h-11 px-4 text-[15px] font-body font-medium bg-transparent border-[1.5px] border-text-primary text-text-primary rounded-none hover:opacity-80 transition-opacity"
      >
        <Printer size={16} />
        {label || 'Print'}
      </button>
    </div>
  )
}

// ─── Tab: Upcoming Reservation ────────────────────────────────────────────────

function UpcomingTab({ reservation, rooms, availableRooms, paymentSummary, onRefresh }) {
  if (!reservation) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <EnvelopeSimple size={48} className="text-text-muted" weight="light" />
        <p className="font-body text-[15px] text-text-muted">No upcoming reservations found.</p>
      </div>
    )
  }

  return (
    <div data-tab-content="upcoming">
      {/* Property name */}
      <h2 className="font-heading text-[24px] text-text-primary mb-4">
        {reservation.properties?.name || 'Your Upcoming Reservation'}
      </h2>

      <ReservationCard reservation={reservation} rooms={rooms} />

      {/* Modification */}
      <div data-print-hide>
        <ModificationSection
          reservation={reservation}
          availableRooms={availableRooms}
          onModified={onRefresh}
        />
      </div>

      {/* Payment */}
      <PaymentSection
        reservation={reservation}
        paymentSummary={paymentSummary}
        onPaymentSuccess={onRefresh}
      />

      {/* Cancellation */}
      <div data-print-hide>
        <CancellationSection reservation={reservation} onCancelled={onRefresh} />
      </div>

      <PrintButton label="Print Reservation" />
    </div>
  )
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

function HistoryTab({ reservations, rooms }) {
  const pastReservations = (reservations ?? []).filter(
    r => r.check_out < today || r.status === 'cancelled'
  )

  if (pastReservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <ClockCounterClockwise size={48} className="text-text-muted" weight="light" />
        <p className="font-body text-[15px] text-text-muted">No past reservations.</p>
      </div>
    )
  }

  return (
    <div data-tab-content="history">
      <h2 className="font-heading text-[24px] text-text-primary mb-4">Reservation History</h2>
      {pastReservations.map(r => (
        <ReservationCard key={r.id} reservation={r} rooms={rooms} compact />
      ))}
      <PrintButton label="Print History" />
    </div>
  )
}

// ─── Tab: Payments ────────────────────────────────────────────────────────────

function PaymentsTab({ payments, reservations }) {
  if (!payments || payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <CreditCard size={48} className="text-text-muted" weight="light" />
        <p className="font-body text-[15px] text-text-muted">No payments recorded.</p>
      </div>
    )
  }

  // Build confirmation number lookup
  const resMap = {}
  for (const r of (reservations ?? [])) {
    resMap[r.id] = r.confirmation_number
  }

  return (
    <div data-tab-content="payments">
      <h2 className="font-heading text-[24px] text-text-primary mb-4">Payments</h2>

      <div className="flex flex-col gap-0 border border-border rounded-[8px] overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-5 py-3 bg-surface border-b border-border">
          <p className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-secondary">Date</p>
          <p className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-secondary">Reservation</p>
          <p className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-secondary">Type</p>
          <p className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-secondary text-right">Amount</p>
        </div>

        {/* Rows */}
        {payments.map((p, i) => (
          <div
            key={p.id ?? i}
            className={cn(
              'grid grid-cols-[auto_1fr_auto_auto] gap-4 px-5 py-3 border-b border-border last:border-b-0',
              i % 2 === 1 && 'bg-tableAlt'
            )}
          >
            <p className="font-mono text-[13px] text-text-primary">
              {formatDate(p.created_at?.slice(0, 10))}
            </p>
            <p className="font-mono text-[13px] text-text-secondary">
              {resMap[p.reservation_id] || '—'}
            </p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-surface font-body text-[12px] text-text-secondary whitespace-nowrap capitalize">
              {p.type}
            </span>
            <p className="font-mono text-[14px] text-text-primary font-semibold text-right">
              {formatCents(p.amount_cents)}
            </p>
          </div>
        ))}
      </div>

      <PrintButton label="Print Payments" />
    </div>
  )
}

// ─── Tab: Contact Info ────────────────────────────────────────────────────────

function ContactTab({ guest, confirmationNumber, upcomingReservations, onUpdated }) {
  const [newEmail, setNewEmail] = useState(guest?.email ?? '')
  const [newPhone, setNewPhone] = useState(guest?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Booker attachment
  const [selectedResId, setSelectedResId] = useState('')
  const [attachSaving, setAttachSaving] = useState(false)
  const [attachError, setAttachError] = useState('')
  const [attachSuccess, setAttachSuccess] = useState('')

  async function handleSaveContact() {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-portal-update`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_contact',
            confirmation_number: confirmationNumber,
            email: guest?.email,
            new_email: newEmail !== guest?.email ? newEmail : undefined,
            new_phone: newPhone !== guest?.phone ? newPhone : undefined,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not update contact information.')
      } else {
        setSuccess(data.message || 'Contact information updated.')
        onUpdated()
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAttachBooker() {
    if (!selectedResId) return
    setAttachSaving(true)
    setAttachError('')
    setAttachSuccess('')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-portal-update`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'attach_booker',
            confirmation_number: confirmationNumber,
            email: guest?.email,
            target_reservation_id: selectedResId,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setAttachError(data.error || 'Could not attach as booker.')
      } else {
        setAttachSuccess(data.message || 'Attached as booker.')
        onUpdated()
      }
    } catch {
      setAttachError('Network error. Please try again.')
    } finally {
      setAttachSaving(false)
    }
  }

  const hasContactChanges = newEmail !== (guest?.email ?? '') || newPhone !== (guest?.phone ?? '')

  return (
    <div data-tab-content="contact">
      <h2 className="font-heading text-[24px] text-text-primary mb-4">Contact Information</h2>

      <div className="bg-surface-raised border border-border rounded-[8px] p-5 mb-4">
        <h3 className="font-heading text-[16px] text-text-primary mb-4">Update Your Details</h3>

        <div className="flex flex-col gap-4">
          <Input
            label="Email Address"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <Input
            label="Phone Number"
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="+1 555 123 4567"
          />

          {error && (
            <div className="flex items-start gap-2 p-3 bg-danger-bg border border-danger rounded-[6px]">
              <WarningCircle size={16} weight="fill" className="text-danger shrink-0 mt-0.5" />
              <p className="font-body text-[13px] text-danger">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 p-3 bg-success-bg border border-success rounded-[6px]">
              <CheckCircle size={16} weight="fill" className="text-success shrink-0 mt-0.5" />
              <p className="font-body text-[13px] text-success">{success}</p>
            </div>
          )}

          <Button
            variant="primary"
            size="md"
            loading={saving}
            disabled={!hasContactChanges}
            onClick={handleSaveContact}
            className="w-full"
          >
            Update Contact Info
          </Button>
        </div>
      </div>

      {/* Attach as Booker */}
      {upcomingReservations && upcomingReservations.length > 0 && (
        <div className="bg-surface-raised border border-border rounded-[8px] p-5 mb-4">
          <h3 className="font-heading text-[16px] text-text-primary mb-2">Book on Behalf</h3>
          <p className="font-body text-[13px] text-text-secondary mb-4">
            Attach yourself as the booker on one of your upcoming reservations. This means you made or paid for the booking on behalf of the guest staying.
          </p>

          <div className="flex flex-col gap-3">
            <label htmlFor="booker-select" className="font-body text-[12px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
              Select Reservation
            </label>
            <select
              id="booker-select"
              value={selectedResId}
              onChange={(e) => setSelectedResId(e.target.value)}
              className="h-11 border-[1.5px] border-border rounded-[6px] px-3 font-body text-[14px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1"
            >
              <option value="">Choose a reservation…</option>
              {upcomingReservations.map(r => (
                <option key={r.id} value={r.id}>
                  {r.confirmation_number} — {formatDate(r.check_in)} to {formatDate(r.check_out)}
                </option>
              ))}
            </select>

            {attachError && (
              <div className="flex items-start gap-2 p-3 bg-danger-bg border border-danger rounded-[6px]">
                <WarningCircle size={16} weight="fill" className="text-danger shrink-0 mt-0.5" />
                <p className="font-body text-[13px] text-danger">{attachError}</p>
              </div>
            )}

            {attachSuccess && (
              <div className="flex items-start gap-2 p-3 bg-success-bg border border-success rounded-[6px]">
                <CheckCircle size={16} weight="fill" className="text-success shrink-0 mt-0.5" />
                <p className="font-body text-[13px] text-success">{attachSuccess}</p>
              </div>
            )}

            <Button
              variant="secondary"
              size="md"
              loading={attachSaving}
              disabled={!selectedResId}
              onClick={handleAttachBooker}
              className="w-full"
            >
              Attach as Booker
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Portal Tabs (replaces ReservationDetail) ─────────────────────────────────

function PortalTabs({ data, onBack, onRefresh }) {
  const { reservation, paymentSummary, availableRooms, rooms } = data
  const allReservations = data?.reservations ?? (reservation ? [reservation] : [])
  const allPayments = data?.payments ?? []
  const allRooms = data?.allRooms ?? rooms ?? []
  const guest = data?.guest ?? reservation?.guests

  // Determine upcoming reservation (non-cancelled, check_out >= today)
  const upcomingReservation = reservation?.status !== 'cancelled' && reservation?.check_out >= today
    ? reservation
    : null

  // Upcoming reservations for booker attachment (exclude current, non-cancelled, future)
  const upcomingReservations = allReservations.filter(
    r => r.status !== 'cancelled' && r.check_in >= today
  )

  return (
    <div className="max-w-lg mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 font-body text-[14px] text-text-secondary hover:text-text-primary transition-colors mb-6 print:hidden"
      >
        <ArrowLeft size={16} />
        Back to lookup
      </button>

      <Tabs.Root defaultValue="upcoming">
        <Tabs.List className="flex gap-0 border-b border-border mb-6 print:hidden overflow-x-auto">
          {[
            { value: 'upcoming', label: 'Your Upcoming Reservation', icon: EnvelopeSimple },
            { value: 'history', label: 'History', icon: ClockCounterClockwise },
            { value: 'payments', label: 'Payments', icon: CreditCard },
            { value: 'contact', label: 'Contact Info', icon: UserCircle },
          ].map((tab) => {
            const TabIcon = tab.icon
            return (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 font-body text-[13px] font-medium text-text-secondary border-b-2 border-transparent whitespace-nowrap',
                  'transition-colors hover:text-text-primary',
                  'data-[state=active]:text-text-primary data-[state=active]:border-text-primary'
                )}
              >
                <TabIcon size={15} />
                {tab.label}
              </Tabs.Trigger>
            )
          })}
        </Tabs.List>

        <Tabs.Content value="upcoming">
          <UpcomingTab
            reservation={upcomingReservation}
            rooms={allRooms}
            availableRooms={availableRooms}
            paymentSummary={paymentSummary}
            onRefresh={onRefresh}
          />
        </Tabs.Content>

        <Tabs.Content value="history">
          <HistoryTab reservations={allReservations} rooms={allRooms} />
        </Tabs.Content>

        <Tabs.Content value="payments">
          <PaymentsTab payments={allPayments} reservations={allReservations} />
        </Tabs.Content>

        <Tabs.Content value="contact">
          <ContactTab
            guest={guest}
            confirmationNumber={reservation?.confirmation_number}
            upcomingReservations={upcomingReservations}
            onUpdated={onRefresh}
          />
        </Tabs.Content>
      </Tabs.Root>

      {/* Print styles — hide non-essential sections, compact layout for one page */}
      <style>{`
        @media print {
          [data-print-hide] { display: none !important; }
          .print\\:hidden { display: none !important; }
          body { margin: 0; padding: 0; }
          .min-h-screen { min-height: auto !important; padding: 0 !important; }
          .max-w-lg { max-width: 100% !important; margin: 0 !important; padding: 16px !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Lookup Form ───────────────────────────────────────────────────────────────

function LookupForm({ initialConfirmation, onFound }) {
  const [confirmationNumber, setConfirmationNumber] = useState(
    (initialConfirmation || '').toUpperCase()
  )
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLookup() {
    if (!confirmationNumber.trim() || !email.trim()) {
      setError('Please enter both your confirmation number and email address.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-portal-lookup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            confirmation_number: confirmationNumber.trim().toUpperCase(),
            email: email.trim().toLowerCase(),
          }),
        }
      )
      const data = await res.json()

      if (!res.ok || !data) {
        setError('Reservation not found. Please check your confirmation number and email address.')
        setLoading(false)
        return
      }

      onFound(data, email.trim().toLowerCase())
    } catch {
      setError('Reservation not found. Please check your confirmation number and email address.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto">
      <div className="text-center mb-8">
        <h1 className="font-heading text-[32px] text-text-primary mb-2">Manage Your Reservation</h1>
        <p className="font-body text-[15px] text-text-secondary">
          Enter your confirmation number and email address to access your reservation.
        </p>
      </div>

      <div className="bg-surface-raised border border-border rounded-[12px] p-6">
        <div className="flex flex-col gap-4">
          <Input
            label="Confirmation Number"
            id="confirmation"
            placeholder="e.g. ABC123"
            value={confirmationNumber}
            onChange={(e) => setConfirmationNumber(e.target.value.toUpperCase())}
            maxLength={12}
          />
          <Input
            label="Email Address"
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {error && (
            <div className="flex items-start gap-2 p-3 bg-danger-bg border border-danger rounded-[6px]">
              <WarningCircle size={16} weight="fill" className="text-danger shrink-0 mt-0.5" />
              <p className="font-body text-[13px] text-danger">{error}</p>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            loading={loading}
            onClick={handleLookup}
            className="w-full"
          >
            Find Reservation
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── GuestPortal Page ─────────────────────────────────────────────────────────

export default function GuestPortal() {
  const [searchParams] = useSearchParams()
  const initialConfirmation = searchParams.get('confirmation') || ''

  const [view, setView] = useState('lookup') // 'lookup' | 'detail'
  const [reservationData, setReservationData] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [verifiedEmail, setVerifiedEmail] = useState('')

  useEffect(() => {
    // Pre-fill is handled by passing initialConfirmation to LookupForm
  }, [])

  async function handleRefresh() {
    if (!reservationData) return
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-portal-lookup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            confirmation_number: reservationData.reservation.confirmation_number,
            email: verifiedEmail || reservationData.reservation.guests?.email || '',
          }),
        }
      )
      const data = await res.json()
      if (data && data.reservation) {
        setReservationData(data)
        setRefreshKey((k) => k + 1)
      }
    } catch {
      // Non-fatal
    }
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      {view === 'lookup' ? (
        <LookupForm
          initialConfirmation={initialConfirmation}
          onFound={(data, emailAddr) => {
            setReservationData(data)
            setVerifiedEmail(emailAddr)
            setView('detail')
          }}
        />
      ) : (
        <PortalTabs
          key={refreshKey}
          data={reservationData}
          onBack={() => { setView('lookup') }}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  )
}
