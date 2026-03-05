// src/pages/public/GuestPortal.jsx
// Self-service guest lookup portal. No auth required.

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, SpinnerGap, WarningCircle } from '@phosphor-icons/react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { format, parseISO } from 'date-fns'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { StatusChip } from '@/components/shared/StatusChip'
import { fmtMoney as formatCents } from '@/lib/utils'

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy')
  } catch {
    return dateStr
  }
}

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

  const balanceCents = paymentSummary?.balanceCents ?? 0
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

  // Identity fields sent with every cancel request so the edge function can verify
  // the caller without requiring a logged-in session.
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
        <p className="font-body text-[14px] text-success font-semibold">
          Reservation cancelled successfully.
        </p>
      )}
    </div>
  )
}

// ─── Reservation Detail View ───────────────────────────────────────────────────

function ReservationDetail({ data, onBack, onRefresh }) {
  const { reservation, paymentSummary } = data

  const guestName = [
    reservation.guests?.first_name,
    reservation.guests?.last_name,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="max-w-lg mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 font-body text-[14px] text-text-secondary hover:text-text-primary transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to lookup
      </button>

      {/* Property */}
      <h2 className="font-heading text-[24px] text-text-primary mb-4">
        {reservation.properties?.name || 'Your Reservation'}
      </h2>

      {/* Confirmation + Status */}
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
            {reservation.check_in_time && (
              <p className="font-body text-[12px] text-text-muted">after {reservation.check_in_time}</p>
            )}
          </div>
          <div>
            <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em] mb-1">Check-out</p>
            <p className="font-mono text-[14px] text-text-primary">{formatDate(reservation.check_out)}</p>
            {reservation.check_out_time && (
              <p className="font-body text-[12px] text-text-muted">by {reservation.check_out_time}</p>
            )}
          </div>
        </div>

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
      </div>

      {/* Payment */}
      <PaymentSection
        reservation={reservation}
        paymentSummary={paymentSummary}
        onPaymentSuccess={onRefresh}
      />

      {/* Cancellation */}
      <CancellationSection reservation={reservation} onCancelled={onRefresh} />

      {/* Documents placeholder */}
      <div className="bg-surface-raised border border-border rounded-[8px] p-5 mb-4">
        <h3 className="font-heading text-[16px] text-text-primary mb-2">Documents</h3>
        <p className="font-body text-[14px] text-text-muted">
          Document upload and e-signature features available through your host.
        </p>
      </div>
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

      onFound(data)
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

  // Auto-submit if confirmation param is present and we can look up by URL only
  // (still requires email so just pre-fill)
  useEffect(() => {
    // Pre-fill is handled by passing initialConfirmation to LookupForm
  }, [])

  async function handleRefresh() {
    // Re-fetch reservation data after payment/cancel
    if (!reservationData) return
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-portal-lookup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            confirmation_number: reservationData.reservation.confirmation_number,
            email: reservationData.reservation.guests?.email || '',
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
          onFound={(data) => {
            setReservationData(data)
            setView('detail')
          }}
        />
      ) : (
        <ReservationDetail
          key={refreshKey}
          data={reservationData}
          onBack={() => setView('lookup')}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  )
}
