// src/hooks/useGuests.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'

export function useGuests(search = '') {
  const { propertyId } = useProperty()

  return useQuery({
    queryKey: queryKeys.guests.list(search),
    queryFn: async () => {
      if (!propertyId) return []
      let query = supabase
        .from('guests')
        .select('*')
        .eq('property_id', propertyId)
        .order('last_name')
        .limit(200)

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
        )
      }

      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

export function useGuestByEmail(email) {
  const { propertyId } = useProperty()

  return useQuery({
    queryKey: queryKeys.guests.byEmail(email),
    queryFn: async () => {
      if (!propertyId || !email) return null
      const { data } = await supabase
        .from('guests')
        .select('*')
        .eq('property_id', propertyId)
        .eq('email', email)
        .single()
      return data ?? null
    },
    enabled: !!propertyId && !!email,
  })
}

export function useUpdateGuest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from('guests')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guests.all })
    },
  })
}
