// _shared/stripe.ts
// Stripe client singleton.

import Stripe from 'https://esm.sh/stripe@14?target=deno'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2024-04-10',
      httpClient: Stripe.createFetchHttpClient(),
    })
  }
  return _stripe
}
