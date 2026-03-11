// src/components/widget/ReviewStep.jsx

import { useState, useEffect, useMemo } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import { WarningCircle, SpinnerGap } from '@phosphor-icons/react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/Button'
import { fmtMoney as formatCents } from '@/lib/utils'
import { StripeForm } from './StripeForm'
import { PolicyModal } from './PolicyModal'

// ─── ReviewStep ────────────────────────────────────────────────────────────────

export function ReviewStep({ property, room, dates, guestInfo, settings, onBook, onBack, isLoading, error }) {
  const nights = differenceInCalendarDays(
    new Date(dates.checkOut + 'T12:00:00'),
    new Date(dates.checkIn + 'T12:00:00')
  )

  // Server-side pricing via preview-pricing edge function
  const [pricing, setPricing] = useState(null)
  const [pricingLoading, setPricingLoading] = useState(true)
  const [pricingError, setPricingError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function fetchPricing() {
      setPricingLoading(true)
      setPricingError(null)
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/preview-pricing`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              property_id: property.id,
              room_ids: room.room_ids,
              check_in: dates.checkIn,
              check_out: dates.checkOut,
            }),
          }
        )
        if (!res.ok) throw new Error('Pricing unavailable')
        const data = await res.json()
        if (!cancelled) setPricing(data)
      } catch {
        if (!cancelled) setPricingError('Could not load pricing.')
      } finally {
        if (!cancelled) setPricingLoading(false)
      }
    }
    fetchPricing()
    return () => { cancelled = true }
  }, [property.id, room.room_ids, dates.checkIn, dates.checkOut, retryCount])

  const requirePayment = settings?.require_payment_at_booking
  const stripeKey = settings?.stripe_publishable_key || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

  const stripePromise = useMemo(
    () => (requirePayment && stripeKey ? loadStripe(stripeKey) : null),
    [requirePayment, stripeKey]
  )
  const [clientSecret, setClientSecret] = useState(null)
  const [stripeReady, setStripeReady] = useState(false)
  const [stripeError, setStripeError] = useState('')

  // Policy acceptance state
  const [policiesAccepted, setPoliciesAccepted] = useState(false)
  const [marketingAccepted, setMarketingAccepted] = useState(false)
  const [selectedPolicy, setSelectedPolicy] = useState(null)

  const activePolicies = useMemo(() => {
    const policies = []
    if (settings?.terms_and_conditions) policies.push({ type: 'terms', label: 'Terms & Conditions', content: settings.terms_and_conditions })
    if (settings?.cancellation_policy_text) policies.push({ type: 'cancellation', label: 'Cancellation Policy', content: settings.cancellation_policy_text })
    if (settings?.incidental_policy) policies.push({ type: 'incidental', label: 'Incidental Policy', content: settings.incidental_policy })
    return policies
  }, [settings?.terms_and_conditions, settings?.cancellation_policy_text, settings?.incidental_policy])
  const hasRequiredPolicies = activePolicies.length > 0
  const hasMarketingPolicy = !!settings?.marketing_policy

  function buildPolicyAcceptances() {
    return activePolicies.map(p => ({ type: p.type, accepted: true }))
      .concat(hasMarketingPolicy ? [{ type: 'marketing', accepted: marketingAccepted }] : [])
  }

  useEffect(() => {
    if (!requirePayment || !stripeKey || !pricing) return

    async function createIntent() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount_cents: pricing.totalCents }),
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
  }, [requirePayment, stripeKey, pricing])

  const showStripe = requirePayment && stripeKey

  // Loading state while pricing is fetched
  if (pricingLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12" role="status" aria-live="polite">
        <SpinnerGap size={24} className="animate-spin text-info mb-3" />
        <p className="font-body text-[14px] text-text-muted">Calculating pricing…</p>
      </div>
    )
  }

  if (pricingError) {
    return (
      <div className="text-center py-8">
        <p className="font-body text-[14px] text-danger mb-4">{pricingError}</p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="md" onClick={onBack}>← Back</Button>
          <Button variant="primary" size="md" onClick={() => setRetryCount(c => c + 1)}>Try Again</Button>
        </div>
      </div>
    )
  }

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
          {/* Per-room breakdown from server pricing */}
          {(pricing.roomRates?.length ?? 0) > 1 ? (
            pricing.roomRates.map(rr => (
              <div key={rr.roomId} className="flex justify-between">
                <span className="text-text-secondary">
                  {formatCents(rr.baseCents)} × {rr.nights} night{rr.nights !== 1 ? 's' : ''}
                </span>
                <span className="font-mono text-[14px] text-text-primary">{formatCents(rr.subtotalCents)}</span>
              </div>
            ))
          ) : (
            <div className="flex justify-between">
              <span className="text-text-secondary">
                {formatCents(pricing.roomRates[0]?.baseCents ?? 0)} × {nights} night{nights !== 1 ? 's' : ''}
              </span>
              <span className="font-mono text-[14px] text-text-primary">{formatCents(pricing.subtotalCents)}</span>
            </div>
          )}
          {pricing.taxCents > 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Tax</span>
              <span className="font-mono text-[14px] text-text-primary">{formatCents(pricing.taxCents)}</span>
            </div>
          )}
          {pricing.stripeFeePassthroughCents > 0 && (
            <div className="flex justify-between">
              <span className="text-text-secondary">Processing fee</span>
              <span className="font-mono text-[14px] text-text-primary">{formatCents(pricing.stripeFeePassthroughCents)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-border mt-1">
            <span className="font-body font-semibold text-text-primary">Total</span>
            <span className="font-mono text-[20px] font-semibold text-text-primary">{formatCents(pricing.totalCents)}</span>
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
        {guestInfo.bookerEmail && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="font-body text-[13px] text-text-muted">Booked by</p>
            <p className="font-body text-[14px] text-text-secondary">{guestInfo.bookerEmail}</p>
          </div>
        )}
        {guestInfo.ccEmails?.length > 0 && (
          <div className="mt-2">
            <p className="font-body text-[13px] text-text-muted">Check-in details CC&apos;d to</p>
            <p className="font-body text-[14px] text-text-secondary">{guestInfo.ccEmails.join(', ')}</p>
          </div>
        )}
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
                totalCents={pricing.totalCents}
                onSuccess={() => onBook({ policy_acceptances: buildPolicyAcceptances() })}
                onError={(msg) => setStripeError(msg)}
                disabled={hasRequiredPolicies && !policiesAccepted}
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
                onClick={() => onBook({ policy_acceptances: buildPolicyAcceptances() })}
                loading={isLoading}
                disabled={isLoading || (hasRequiredPolicies && !policiesAccepted)}
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
            onClick={() => onBook({ policy_acceptances: buildPolicyAcceptances() })}
            loading={isLoading}
            disabled={isLoading || (hasRequiredPolicies && !policiesAccepted)}
            className="flex-1"
          >
            Book Now
          </Button>
        </div>
      )}

      {/* Back button shown alongside stripe (only when stripe form is visible — no duplicate) */}
      {showStripe && stripeReady && clientSecret && (
        <Button variant="ghost" size="md" onClick={onBack} type="button" disabled={isLoading} className="text-text-secondary mt-3">
          ← Back
        </Button>
      )}

      {/* Policy acceptance */}
      {hasRequiredPolicies && (
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={policiesAccepted}
              onChange={(e) => setPoliciesAccepted(e.target.checked)}
              className="w-4 h-4 accent-info mt-0.5 shrink-0"
            />
            <span className="font-body text-[13px] text-text-secondary leading-relaxed">
              I agree to the{' '}
              {activePolicies.map((p, i) => (
                <span key={p.type}>
                  {i > 0 && (i === activePolicies.length - 1 ? ', and ' : ', ')}
                  <button
                    type="button"
                    onClick={() => setSelectedPolicy({ title: p.label, content: p.content })}
                    className="text-info hover:underline font-medium"
                  >
                    {p.label}
                  </button>
                </span>
              ))}
            </span>
          </label>

          {hasMarketingPolicy && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingAccepted}
                onChange={(e) => setMarketingAccepted(e.target.checked)}
                className="w-4 h-4 accent-info mt-0.5 shrink-0"
              />
              <span className="font-body text-[13px] text-text-secondary leading-relaxed">
                I&apos;d like to receive marketing communications.{' '}
                <button
                  type="button"
                  onClick={() => setSelectedPolicy({ title: 'Marketing Policy', content: settings.marketing_policy })}
                  className="text-info hover:underline"
                >
                  Learn more
                </button>
              </span>
            </label>
          )}
        </div>
      )}

      {/* Fallback: no policies configured, show simple text */}
      {!hasRequiredPolicies && (
        <p className="font-body text-[12px] text-text-muted text-center mt-4">
          By booking you agree to the property&apos;s cancellation policy.
          {settings?.cancellation_policy && ` (${settings.cancellation_policy})`}
        </p>
      )}

      <PolicyModal
        open={selectedPolicy !== null}
        onOpenChange={(open) => { if (!open) setSelectedPolicy(null) }}
        title={selectedPolicy?.title ?? ''}
        content={selectedPolicy?.content ?? ''}
      />
    </div>
  )
}
