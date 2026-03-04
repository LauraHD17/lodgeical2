// _shared/pricing.ts
// Authoritative server-side pricing calculation.
// Used by create-reservation, update-reservation, and get-payment-summary.
//
// Priority: rate_overrides > base_rate_cents
// If multiple overrides cover the same date, the highest rate wins.
//
// Stripe fee pass-through (when enabled in settings):
//   guest_pays = (base_amount + tax) / (1 - 0.029) + 0.30
//   (Stripe standard: 2.9% + $0.30 per transaction)

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface RoomRate {
  roomId: string
  baseCents: number
  nights: number
  nightlyBreakdown: DayRate[]
  subtotalCents: number
}

export interface DayRate {
  date: string          // YYYY-MM-DD
  rateCents: number
  overrideLabel?: string
}

export interface PricingResult {
  roomRates: RoomRate[]
  subtotalCents: number
  taxCents: number
  stripeFeePassthroughCents: number
  totalCents: number
  passThroughFees: boolean
}

/**
 * Calculate the total for a set of rooms over a date range,
 * applying any seasonal rate overrides and optional Stripe fee pass-through.
 */
export async function calculatePricing(
  supabase: SupabaseClient,
  {
    propertyId,
    roomIds,
    checkIn,
    checkOut,
  }: {
    propertyId: string
    roomIds: string[]
    checkIn: string  // YYYY-MM-DD
    checkOut: string // YYYY-MM-DD (exclusive — last night is checkOut - 1)
  }
): Promise<PricingResult> {
  const checkInDate  = new Date(checkIn)
  const checkOutDate = new Date(checkOut)
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))

  // Build list of stay dates (each night billed)
  const stayDates: string[] = []
  for (let d = new Date(checkInDate); d < checkOutDate; d.setDate(d.getDate() + 1)) {
    stayDates.push(d.toISOString().split('T')[0])
  }

  // Fetch rooms + settings in parallel
  const [{ data: rooms }, { data: settings }, { data: overrides }] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, base_rate_cents')
      .in('id', roomIds)
      .eq('property_id', propertyId),
    supabase
      .from('settings')
      .select('tax_rate, pass_through_stripe_fee')
      .eq('property_id', propertyId)
      .single(),
    supabase
      .from('rate_overrides')
      .select('room_id, start_date, end_date, rate_cents, label')
      .eq('property_id', propertyId)
      .in('room_id', roomIds)
      // overlapping the stay: override starts before checkout AND ends after checkin
      .lte('start_date', checkOut)
      .gte('end_date', checkIn),
  ])

  const taxRate         = Number(settings?.tax_rate ?? 0)
  const passThroughFees = settings?.pass_through_stripe_fee ?? false

  const roomRates: RoomRate[] = []
  let subtotalCents = 0

  for (const room of (rooms ?? [])) {
    const roomOverrides = (overrides ?? []).filter(o => o.room_id === room.id)

    const nightlyBreakdown: DayRate[] = stayDates.map(date => {
      // Find overrides active on this date; pick highest rate
      const applicable = roomOverrides.filter(
        o => o.start_date <= date && o.end_date >= date
      )
      if (applicable.length === 0) {
        return { date, rateCents: room.base_rate_cents }
      }
      const best = applicable.reduce((a, b) => a.rate_cents >= b.rate_cents ? a : b)
      return { date, rateCents: best.rate_cents, overrideLabel: best.label }
    })

    const subtotal = nightlyBreakdown.reduce((s, d) => s + d.rateCents, 0)
    roomRates.push({
      roomId: room.id,
      baseCents: room.base_rate_cents,
      nights,
      nightlyBreakdown,
      subtotalCents: subtotal,
    })
    subtotalCents += subtotal
  }

  const taxCents = Math.round(subtotalCents * (taxRate / 100))
  const preFeeCents = subtotalCents + taxCents

  // Stripe fee pass-through: solve for gross so net = preFeeCents
  // gross = (preFeeCents + STRIPE_FIXED_FEE_CENTS) / (1 - STRIPE_PCT_FEE)
  const STRIPE_FIXED_FEE_CENTS = 30   // $0.30 fixed per transaction
  const STRIPE_PCT_FEE = 0.029        // 2.9% of transaction
  let stripeFeePassthroughCents = 0
  let totalCents = preFeeCents
  if (passThroughFees) {
    const grossCents = Math.ceil((preFeeCents + STRIPE_FIXED_FEE_CENTS) / (1 - STRIPE_PCT_FEE))
    stripeFeePassthroughCents = grossCents - preFeeCents
    totalCents = grossCents
  }

  return {
    roomRates,
    subtotalCents,
    taxCents,
    stripeFeePassthroughCents,
    totalCents,
    passThroughFees,
  }
}
