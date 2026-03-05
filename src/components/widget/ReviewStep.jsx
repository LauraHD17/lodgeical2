// src/components/widget/ReviewStep.jsx

import { useState, useEffect, useMemo } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { WarningCircle, SpinnerGap } from '@phosphor-icons/react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/Button'
import { fmtMoney as formatCents } from '@/lib/utils'

// ─── Stripe inner form ────────────────────────────────────────────────────────

function StripeForm({ totalCents, onSuccess, onError }) {
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
        Pay {formatCents(totalCents)}
      </Button>
    </div>
  )
}

// ─── ReviewStep ────────────────────────────────────────────────────────────────

export function ReviewStep({ property: _property, room, dates, guestInfo, settings, onBook, onBack, isLoading, error }) {
  const nights = differenceInCalendarDays(
    new Date(dates.checkOut + 'T12:00:00'),
    new Date(dates.checkIn + 'T12:00:00')
  )
  const subtotal = room.base_rate_cents * nights
  const taxRate = Number(settings?.tax_rate ?? settings?.tax_rate_percent ?? 0)
  const taxAmount = Math.round(subtotal * (taxRate / 100))
  const total = subtotal + taxAmount

  const requirePayment = settings?.require_payment_at_booking
  const stripeKey = settings?.stripe_publishable_key || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

  const stripePromise = useMemo(
    () => (requirePayment && stripeKey ? loadStripe(stripeKey) : null),
    [requirePayment, stripeKey]
  )
  const [clientSecret, setClientSecret] = useState(null)
  const [stripeReady, setStripeReady] = useState(false)
  const [stripeError, setStripeError] = useState('')

  useEffect(() => {
    if (!requirePayment || !stripeKey) return

    async function createIntent() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ amount_cents: total }),
          }
        )
        const data = await res.json()
        if (data.client_secret) {
          setClientSecret(data.client_secret)
          setStripeReady(true)
        } else {
          setStripeError('Could not initialize payment. You can pay at the property.')
        }
      } catch {
        setStripeError('Could not initialize payment. You can pay at the property.')
      }
    }
    createIntent()
  }, [requirePayment, stripeKey, total])

  const showStripe = requirePayment && stripeKey

  return (
    <div>
      <h2 className="font-heading text-[24px] text-text-primary mb-6">Review your booking</h2>

      {/* Booking summary */}
      <div className="bg-surface border border-border rounded-[8px] p-5 mb-5">
        <h4 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-3">
          Stay Details
        </h4>
        <div className="flex flex-col gap-2 text-[15px] font-body">
          <div className="flex justify-between">
            <span className="text-text-secondary">{room.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Check-in</span>
            <span className="font-mono text-[14px] text-text-primary">
              {format(new Date(dates.checkIn + 'T12:00:00'), 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Check-out</span>
            <span className="font-mono text-[14px] text-text-primary">
              {format(new Date(dates.checkOut + 'T12:00:00'), 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">
              {formatCents(room.base_rate_cents)} × {nights} night{nights !== 1 ? 's' : ''}
            </span>
            <span className="font-mono text-[14px] text-text-primary">{formatCents(subtotal)}</span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Tax ({taxRate}%)</span>
              <span className="font-mono text-[14px] text-text-primary">{formatCents(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-border mt-1">
            <span className="font-body font-semibold text-text-primary">Total</span>
            <span className="font-mono text-[20px] font-semibold text-text-primary">{formatCents(total)}</span>
          </div>
        </div>
      </div>

      {/* Guest summary */}
      <div className="bg-surface border border-border rounded-[8px] p-5 mb-6">
        <h4 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-3">
          Guest
        </h4>
        <p className="font-body text-[15px] text-text-primary">
          {guestInfo.firstName} {guestInfo.lastName}
        </p>
        <p className="font-body text-[14px] text-text-secondary mt-0.5">{guestInfo.email}</p>
        {guestInfo.phone && (
          <p className="font-body text-[14px] text-text-secondary">{guestInfo.phone}</p>
        )}
        <p className="font-body text-[14px] text-text-secondary mt-0.5">
          {guestInfo.numGuests} guest{guestInfo.numGuests !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Error from booking */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-danger-bg border border-danger rounded-[6px] mb-4">
          <WarningCircle size={18} weight="fill" className="text-danger shrink-0 mt-0.5" />
          <p className="font-body text-[14px] text-danger">{error}</p>
        </div>
      )}

      {/* Stripe payment section */}
      {showStripe ? (
        <div className="mb-5">
          {stripeError && (
            <p className="font-body text-[14px] text-warning mb-3 bg-warning-bg border border-warning rounded-[6px] px-4 py-3">
              {stripeError}
            </p>
          )}
          {stripeReady && clientSecret && stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <StripeForm
                totalCents={total}
                onSuccess={() => onBook()}
                onError={(msg) => setStripeError(msg)}
              />
            </Elements>
          ) : !stripeError ? (
            <div className="flex items-center gap-2 text-text-muted font-body text-[14px]">
              <SpinnerGap size={16} className="animate-spin" />
              Preparing payment…
            </div>
          ) : (
            /* Stripe failed to init — allow pay at property */
            <div className="flex gap-3">
              <Button variant="ghost" size="md" onClick={onBack} type="button" disabled={isLoading} className="text-text-secondary">
                ← Back
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={() => onBook()}
                loading={isLoading}
                className="flex-1"
              >
                Book Now (Pay at Property)
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* No Stripe — simple Book Now */
        <div className="flex gap-3">
          <Button variant="ghost" size="md" onClick={onBack} type="button" disabled={isLoading} className="text-text-secondary">
            ← Back
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => onBook()}
            loading={isLoading}
            className="flex-1"
          >
            Book Now
          </Button>
        </div>
      )}

      {/* Back button shown alongside stripe */}
      {showStripe && !stripeError && (
        <Button variant="ghost" size="md" onClick={onBack} type="button" disabled={isLoading} className="text-text-secondary mt-3">
          ← Back
        </Button>
      )}

      <p className="font-body text-[12px] text-text-muted text-center mt-4">
        By booking you agree to the property&apos;s cancellation policy.
        {settings?.cancellation_policy && ` (${settings.cancellation_policy})`}
      </p>
    </div>
  )
}
