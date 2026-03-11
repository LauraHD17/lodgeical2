// _shared/pricing.ts
// Authoritative server-side pricing calculation.
// Used by create-reservation, update-reservation, and preview-pricing.
//
// Priority: rate_overrides > base_rate_cents (per room, per night)
// If multiple overrides cover the same date, the highest rate wins.
//
// Fee handling (admin-created reservations):
//   - Cleaning fee: sum across rooms (room override or property default), waivable
//   - Pet fee: first allows_pets room (room override or property default), per_night or flat
//   - Misc fee: arbitrary admin add-on
//   - Tax-exempt: skip tax entirely
//
// Stripe fee pass-through (when enabled in settings):
//   gross = (subtotal + fees + tax + $0.30) / (1 - 0.029)

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

/** Optional fee overrides — only used by admin-created reservations. */
export interface FeeOptions {
  cleaningFeeWaived?: boolean   // Admin: skip cleaning fee
  petFeeApplied?: boolean       // Admin: charge pet fee
  miscFeeCents?: number         // Admin: arbitrary add-on (already in cents)
  taxExempt?: boolean           // Admin: waive all tax
}

export interface PricingResult {
  roomRates: RoomRate[]
  subtotalCents: number             // nightly total only
  cleaningFeeCents: number          // cleaning fee charged (0 if waived)
  petFeeCents: number               // pet fee charged (0 if not applied)
  miscFeeCents: number              // misc fee
  feesSubtotalCents: number         // cleaning + pet + misc
  taxableSubtotalCents: number      // nightly + fees (tax base)
  taxCents: number
  stripeFeePassthroughCents: number
  totalCents: number
  passThroughFees: boolean
}

/**
 * Calculate the total for a set of rooms over a date range.
 * Applies seasonal rate overrides, optional fees, tax, and Stripe pass-through.
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
  },
  feeOptions: FeeOptions = {}
): Promise<PricingResult> {
  const {
    cleaningFeeWaived = false,
    petFeeApplied = false,
    miscFeeCents: miscFeeInput = 0,
    taxExempt = false,
  } = feeOptions

  const checkInDate  = new Date(checkIn)
  const checkOutDate = new Date(checkOut)
  const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))

  // Build list of stay dates (each night billed)
  const stayDates: string[] = []
  for (let d = new Date(checkInDate); d < checkOutDate; d.setDate(d.getDate() + 1)) {
    stayDates.push(d.toISOString().split('T')[0])
  }

  // Fetch rooms, settings, overrides, and property fees in parallel
  const [{ data: rooms }, { data: settings }, { data: overrides }, { data: property }] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, base_rate_cents, cleaning_fee_cents, pet_fee_cents, allows_pets')
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
    supabase
      .from('properties')
      .select('cleaning_fee_cents, pet_fee_cents, pet_fee_type')
      .eq('id', propertyId)
      .single(),
  ])

  const taxRate           = Number(settings?.tax_rate ?? 0)
  const passThroughFees   = settings?.pass_through_stripe_fee ?? false
  const propCleaningFee   = property?.cleaning_fee_cents ?? 0
  const propPetFee        = property?.pet_fee_cents ?? 0
  const petFeeType        = property?.pet_fee_type ?? 'flat'

  // ── Nightly rate calculation ──────────────────────────────────────────────
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

  // ── Fee calculation ───────────────────────────────────────────────────────

  // Cleaning fee: sum across all rooms (room-level override, fall back to property default)
  const rawCleaningFee = (rooms ?? []).reduce((sum, r) => {
    const roomFee = r.cleaning_fee_cents != null ? r.cleaning_fee_cents : propCleaningFee
    return sum + roomFee
  }, 0)
  const cleaningFeeCents = cleaningFeeWaived ? 0 : rawCleaningFee

  // Pet fee: apply to first room that allows_pets (room-level override, fall back to property default)
  let petFeeCents = 0
  if (petFeeApplied) {
    const petRoom = (rooms ?? []).find(r => r.allows_pets)
    if (petRoom) {
      const petRate = petRoom.pet_fee_cents != null ? petRoom.pet_fee_cents : propPetFee
      petFeeCents = petFeeType === 'per_night' ? petRate * nights : petRate
    }
  }

  const miscFeeCents = Math.max(0, miscFeeInput)
  const feesSubtotalCents = cleaningFeeCents + petFeeCents + miscFeeCents

  // ── Tax + Stripe fee ──────────────────────────────────────────────────────

  const taxableSubtotalCents = subtotalCents + feesSubtotalCents
  const taxCents = taxExempt ? 0 : Math.round(taxableSubtotalCents * (taxRate / 100))
  const preFeeCents = taxableSubtotalCents + taxCents

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
    cleaningFeeCents,
    petFeeCents,
    miscFeeCents,
    feesSubtotalCents,
    taxableSubtotalCents,
    taxCents,
    stripeFeePassthroughCents,
    totalCents,
    passThroughFees,
  }
}
