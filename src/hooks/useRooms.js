// src/hooks/useRooms.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'

export function useRooms() {
  const { propertyId } = useProperty()

  return useQuery({
    queryKey: queryKeys.rooms.list(),
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', propertyId)
        .order('sort_order')
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

export function useUpdateRoom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from('rooms')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all })
    },
  })
}

export function useRoomLinks() {
  const { propertyId } = useProperty()

  return useQuery({
    queryKey: queryKeys.roomLinks.list(propertyId),
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('room_links')
        .select('*')
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

export function useCreateRoom() {
  const queryClient = useQueryClient()
  const { propertyId } = useProperty()

  return useMutation({
    mutationFn: async (input) => {
      const { data, error } = await supabase
        .from('rooms')
        .insert({ ...input, property_id: propertyId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rooms.all })
    },
  })
}
