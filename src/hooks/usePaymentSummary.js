// src/hooks/usePaymentSummary.js
// Calls the get-payment-summary Edge Function.
// NEVER calculates payments locally — all math lives in the Edge Function.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { queryKeys } from '@/config/queryKeys'

/**
 * Fetch payment summary for a reservation.
 * @param {string} reservationId
 * @param {{ isGuest?: boolean }} options
 */
export function usePaymentSummary(reservationId, options = {}) {
  return useQuery({
    queryKey: queryKeys.paymentSummary.byReservation(reservationId),
    queryFn: async () => {
      if (!reservationId) return null

      const headers = { 'Content-Type': 'application/json' }

      if (!options.isGuest) {
        const { data: { session } } = await supabase.auth.getSession()
        headers['Authorization'] = `Bearer ${session?.access_token}`
      } else {
        headers['x-guest-token'] = 'true'
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-payment-summary`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ reservation_id: reservationId }),
        }
      )
      if (!res.ok) throw new Error('Failed to fetch payment summary')
      return res.json()
    },
    enabled: !!reservationId,
  })
}

/** Create a payment intent for a reservation */
export function useCreatePaymentIntent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ reservation_id, amount_cents, isGuest = false }) => {
      const headers = { 'Content-Type': 'application/json' }

      if (!isGuest) {
        const { data: { session } } = await supabase.auth.getSession()
        headers['Authorization'] = `Bearer ${session?.access_token}`
      } else {
        headers['x-guest-payment'] = 'true'
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ reservation_id, amount_cents }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw json
      return json
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.paymentSummary.byReservation(variables.reservation_id),
      })
    },
  })
}
