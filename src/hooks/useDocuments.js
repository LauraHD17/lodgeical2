// src/hooks/useDocuments.js
// Hooks for document management (upload, list, delete).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'

export function useDocuments() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: queryKeys.documents.list(propertyId),
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('documents')
        .select(`
          id, filename, file_url, storage_path, file_size, mime_type, uploaded_at,
          reservation_id, guest_id,
          reservations(confirmation_number),
          guests(first_name, last_name)
        `)
        .eq('property_id', propertyId)
        .order('uploaded_at', { ascending: false })
        .limit(200)
      if (error) return []
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

export function useDocumentsByGuest(guestId) {
  return useQuery({
    queryKey: queryKeys.documents.byGuest(guestId),
    queryFn: async () => {
      if (!guestId) return []
      const { data, error } = await supabase
        .from('documents')
        .select('id, filename, file_url, file_size, mime_type, uploaded_at')
        .eq('guest_id', guestId)
        .order('uploaded_at', { ascending: false })
        .limit(20)
      if (error) return []
      return data ?? []
    },
    enabled: !!guestId,
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  const { propertyId } = useProperty()

  return useMutation({
    mutationFn: async ({ file, guestId, reservationId }) => {
      if (!propertyId) throw new Error('No property selected')

      const timestamp = Date.now()
      const ext = file.name.split('.').pop()
      const storagePath = `${propertyId}/${timestamp}.${ext}`

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, { contentType: file.type })
      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(storagePath)

      // Insert metadata record
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('documents')
        .insert({
          property_id: propertyId,
          guest_id: guestId || null,
          reservation_id: reservationId || null,
          filename: file.name,
          storage_path: storagePath,
          file_url: urlData?.publicUrl ?? null,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user?.id ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, storagePath }) => {
      // Delete from storage if path provided
      if (storagePath) {
        await supabase.storage.from('documents').remove([storagePath])
      }
      // Delete metadata record
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all })
    },
  })
}
