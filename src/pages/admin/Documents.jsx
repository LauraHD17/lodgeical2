// src/pages/admin/Documents.jsx
// Documents management page.

import { format, parseISO } from 'date-fns'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UploadSimple, DownloadSimple, Trash, File, Info } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/useToast'

function useDocuments() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['documents', propertyId],
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('documents')
        .select(`
          id, filename, file_url, uploaded_at, reservation_id, guest_id,
          reservations(confirmation_number),
          guests(first_name, last_name)
        `)
        .eq('property_id', propertyId)
        .order('uploaded_at', { ascending: false })
      if (error) return []
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function useDeleteDocument() {
  const queryClient = useQueryClient()
  const { propertyId } = useProperty()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', propertyId] })
    },
  })
}

const STORAGE_CONFIGURED = !!import.meta.env.VITE_SUPABASE_STORAGE_BUCKET

export default function Documents() {
  const { data: documents = [], isLoading } = useDocuments()
  const deleteDocument = useDeleteDocument()
  const { addToast } = useToast()

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.filename}"?`)) return
    try {
      await deleteDocument.mutateAsync(doc.id)
      addToast({ message: 'Document deleted', variant: 'success' })
    } catch {
      addToast({ message: 'Failed to delete document', variant: 'error' })
    }
  }

  function handleUpload() {
    if (!STORAGE_CONFIGURED) {
      addToast({ message: 'Storage not configured. Upload coming soon.', variant: 'info' })
      return
    }
    // Placeholder: in production, trigger file picker
    addToast({ message: 'Upload feature coming soon', variant: 'info' })
  }

  const COLUMNS = [
    {
      key: 'filename',
      label: 'Filename',
      render: (val) => (
        <div className="flex items-center gap-2">
          <File size={16} className="text-text-muted shrink-0" />
          <span className="font-body text-[14px]">{val ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'guest',
      label: 'Guest',
      render: (_, row) => {
        const g = row.guests
        if (!g) return <span className="text-text-muted font-body text-[14px]">—</span>
        return <span className="font-body text-[14px]">{g.first_name} {g.last_name}</span>
      },
    },
    {
      key: 'reservation',
      label: 'Reservation',
      render: (_, row) => (
        <span className="font-mono text-[14px]">
          {row.reservations?.confirmation_number ?? '—'}
        </span>
      ),
    },
    {
      key: 'uploaded_at',
      label: 'Uploaded',
      render: (val) => (
        <span className="font-mono text-[14px]">
          {val ? format(parseISO(val), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {row.file_url && (
            <a
              href={row.file_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-info hover:underline font-body text-[13px]"
            >
              <DownloadSimple size={14} /> Download
            </a>
          )}
          <button
            onClick={() => handleDelete(row)}
            className="inline-flex items-center gap-1 text-danger hover:underline font-body text-[13px]"
          >
            <Trash size={14} /> Delete
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">Documents</h1>
        <Button variant="primary" size="md" onClick={handleUpload}>
          <UploadSimple size={16} weight="bold" /> Upload Document
        </Button>
      </div>

      {/* Storage info banner */}
      {!STORAGE_CONFIGURED && (
        <div className="bg-info-bg border border-info rounded-[8px] p-4 flex items-start gap-3">
          <Info size={18} className="text-info shrink-0 mt-0.5" />
          <p className="font-body text-[14px] text-info">
            Upload and signing features coming soon. Configure Supabase Storage to enable document uploads.
          </p>
        </div>
      )}

      {/* Documents Table */}
      <div className="border border-border rounded-[8px] overflow-hidden">
        <DataTable
          columns={COLUMNS}
          data={documents}
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center gap-3 py-8">
              <File size={40} className="text-text-muted" weight="light" />
              <p className="font-body text-[15px] text-text-muted">No documents uploaded yet</p>
              <Button variant="secondary" size="sm" onClick={handleUpload}>
                <UploadSimple size={14} /> Upload first document
              </Button>
            </div>
          }
        />
      </div>
    </div>
  )
}
