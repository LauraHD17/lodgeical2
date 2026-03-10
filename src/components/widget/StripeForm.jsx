// src/components/widget/StripeForm.jsx

import { useState } from 'react'
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/Button'
import { fmtMoney as formatCents } from '@/lib/utils'

export function StripeForm({ totalCents, onSuccess, onError }) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)

  async function handlePay() {
    if (!stripe || !elements) return
    setPaying(true)
    try {
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
    } catch (err) {
      onError(err?.message ?? 'Payment failed. Please try again.')
      setPaying(false)
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
