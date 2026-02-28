// src/hooks/useReservations.js
// Paginated, cursor-based reservations query.

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'

const PAGE_SIZE = 50

export function useReservations(filters = {}) {
  const { propertyId } = useProperty()

  return useInfiniteQuery({
    queryKey: queryKeys.reservations.list(filters),
    queryFn: async ({ pageParam = null }) => {
      if (!propertyId) return { data: [], nextCursor: null }

      let query = supabase
        .from('reservations')
        .select(`
          id, confirmation_number, check_in, check_out, num_guests,
          status, origin, total_due_cents, created_at, room_ids,
          guests(id, first_name, last_name, email, phone)
        `)
        .eq('property_id', propertyId)
        .order('check_in', { ascending: false })
        .limit(PAGE_SIZE)

      // Apply filters
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.dateFrom) query = query.gte('check_in', filters.dateFrom)
      if (filters.dateTo) query = query.lte('check_in', filters.dateTo)

      // Cursor-based pagination
      if (pageParam) query = query.lt('check_in', pageParam)

      const { data, error } = await query
      if (error) throw error

      const nextCursor = data?.length === PAGE_SIZE ? data[data.length - 1].check_in : null
      return { data: data ?? [], nextCursor }
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!propertyId,
  })
}

export function useCreateReservation() {
  const queryClient = useQueryClient()
  useProperty() // ensure context is available

  return useMutation({
    mutationFn: async (input) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-reservation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      )
      const json = await res.json()
      if (!res.ok) throw json
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
    },
  })
}

export function useUpdateReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-reservation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      )
      const json = await res.json()
      if (!res.ok) throw json
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
    },
  })
}
