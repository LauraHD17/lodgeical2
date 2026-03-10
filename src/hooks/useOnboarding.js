// src/hooks/useOnboarding.js
// Query + mutation hooks for the onboarding_state table.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'

export function useOnboarding() {
  const { propertyId } = useProperty()

  return useQuery({
    queryKey: queryKeys.onboarding.byProperty(propertyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('onboarding_state')
        .select()
        .eq('property_id', propertyId)
        .single()
      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
      return data ?? null
    },
    enabled: !!propertyId,
  })
}

export function useCreateOnboarding() {
  const { propertyId } = useProperty()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (path) => {
      const { data, error } = await supabase
        .from('onboarding_state')
        .insert({ property_id: propertyId, onboarding_path: path })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all })
    },
  })
}

export function useCompleteOnboardingStep() {
  const { propertyId } = useProperty()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ onboardingId, step, currentSteps }) => {
      const updated = currentSteps.includes(step)
        ? currentSteps.filter(s => s !== step)
        : [...currentSteps, step]
      const { data, error } = await supabase
        .from('onboarding_state')
        .update({ completed_steps: updated, updated_at: new Date().toISOString() })
        .eq('id', onboardingId)
        .eq('property_id', propertyId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all })
    },
  })
}

export function useDismissOnboarding() {
  const { propertyId } = useProperty()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (onboardingId) => {
      const { error } = await supabase
        .from('onboarding_state')
        .update({ completed_steps: ['dismissed'], updated_at: new Date().toISOString() })
        .eq('id', onboardingId)
        .eq('property_id', propertyId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding.all })
    },
  })
}
