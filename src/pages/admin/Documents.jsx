// src/pages/admin/Documents.jsx
// Documents management page with upload, list, and delete.

import { useState, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { UploadSimple, ArrowSquareOut, Copy, Check, Trash, File, X, CloudArrowUp } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { useDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/useDocuments'
import { queryKeys } from '@/config/queryKeys'
import { formatFileSize } from '@/lib/utils'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/useToast'

function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary font-body text-[13px]"
    >
      {copied ? <Check size={14} weight="bold" className="text-success" /> : <Copy size={14} />}
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}

const ACCEPTED_TYPES = '.pdf,.jpg,.jpeg,.png,.doc,.docx'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB


export default function Documents() {
  const { propertyId } = useProperty()
  const { data: documents = [], isLoading } = useDocuments()
  const uploadDocument = useUploadDocument()
  const deleteDocument = useDeleteDocument()
  const { addToast } = useToast()

  const [confirmState, setConfirmState] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedGuestId, setSelectedGuestId] = useState('')
  const [selectedReservationId, setSelectedReservationId] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // Fetch guests for the dropdown
  const { data: guests = [] } = useQuery({
    queryKey: queryKeys.guests.list(''),
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('guests')
        .select('id, first_name, last_name, email')
        .eq('property_id', propertyId)
        .order('last_name')
        .limit(200)
      if (error) return []
      return data ?? []
    },
    enabled: !!propertyId && uploadOpen,
  })

  // Fetch reservations for the dropdown
  const { data: reservations = [] } = useQuery({
    queryKey: queryKeys.reservations.list({ forDocuments: true }),
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('reservations')
        .select('id, confirmation_number, check_in, guests(first_name, last_name)')
        .eq('property_id', propertyId)
        .order('check_in', { ascending: false })
        .limit(100)
      if (error) return []
      return data ?? []
    },
    enabled: !!propertyId && uploadOpen,
  })

  function handleDelete(doc) {
    setConfirmState({
      title: `Delete "${doc.filename}"?`,
      description: 'This document will be permanently deleted.',
      onConfirm: async () => {
        try {
          await deleteDocument.mutateAsync({ id: doc.id, storagePath: doc.storage_path })
          addToast({ message: 'Document deleted', variant: 'success' })
        } catch {
          addToast({ message: 'Failed to delete document', variant: 'error' })
        }
      },
    })
  }

  function openUploadDialog() {
    setSelectedFile(null)
    setSelectedGuestId('')
    setSelectedReservationId('')
    setUploadOpen(true)
  }

  function handleFileSelect(file) {
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      addToast({ message: 'File exceeds 10 MB limit', variant: 'error' })
      return
    }
    setSelectedFile(file)
  }

  function handleFileInputChange(e) {
    handleFileSelect(e.target.files?.[0])
  }

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    handleFileSelect(file)
  }

  async function handleUploadSubmit() {
    if (!selectedFile) return
    try {
      await uploadDocument.mutateAsync({
        file: selectedFile,
        guestId: selectedGuestId || null,
        reservationId: selectedReservationId || null,
      })
      addToast({ message: 'Document uploaded successfully', variant: 'success' })
      setUploadOpen(false)
    } catch {
      addToast({ message: 'Failed to upload document', variant: 'error' })
    }
  }

  const COLUMNS = [
    {
      key: 'filename',
      label: 'Filename',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <File size={16} className="text-text-muted shrink-0" />
          <div className="flex flex-col">
            <span className="font-body text-[14px]">{val ?? '—'}</span>
            {row.file_size && (
              <span className="font-mono text-[12px] text-text-muted">
                {formatFileSize(row.file_size)}
              </span>
            )}
          </div>
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
        <div className="flex items-center gap-3">
          {row.file_url && (
            <>
              <a
                href={row.file_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-info hover:opacity-80 font-body text-[13px]"
              >
                <ArrowSquareOut size={14} /> Open
              </a>
              <CopyLinkButton url={row.file_url} />
            </>
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
        <h1 className="font-heading text-[32px] text-text-primary uppercase">Documents</h1>
        <Button variant="primary" size="md" onClick={openUploadDialog}>
          <UploadSimple size={16} weight="bold" /> Upload Document
        </Button>
      </div>

      {/* Documents Table */}
      <div className="border border-border rounded-[8px] overflow-hidden">
        <DataTable
          columns={COLUMNS}
          data={documents}
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center gap-3 py-12">
              <File size={18} weight="fill" className="text-text-muted" />
              <p className="font-body text-[15px] text-text-muted">No documents yet</p>
              <Button variant="secondary" size="sm" onClick={openUploadDialog}>
                <UploadSimple size={14} /> Upload first document
              </Button>
            </div>
          }
        />
      </div>

      {/* Upload Dialog */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Document"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleUploadSubmit}
              disabled={!selectedFile || uploadDocument.isPending}
            >
              {uploadDocument.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
            className={`
              flex flex-col items-center justify-center gap-3 py-10 px-6
              border-2 border-dashed rounded-[8px] cursor-pointer transition-colors
              ${isDragOver
                ? 'border-info bg-info-bg'
                : selectedFile
                  ? 'border-success bg-success-bg'
                  : 'border-border hover:border-text-muted'
              }
            `}
          >
            {selectedFile ? (
              <>
                <File size={28} weight="fill" className="text-success" />
                <div className="text-center">
                  <p className="font-body text-[15px] text-text-primary">{selectedFile.name}</p>
                  <p className="font-mono text-[13px] text-text-secondary">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null) }}
                  className="inline-flex items-center gap-1 text-danger hover:underline font-body text-[13px]"
                >
                  <X size={14} weight="bold" /> Remove
                </button>
              </>
            ) : (
              <>
                <CloudArrowUp size={28} weight="fill" className="text-text-muted" />
                <p className="font-body text-[15px] text-text-secondary text-center">
                  Drag and drop a file here, or click to browse
                </p>
                <p className="font-body text-[13px] text-text-muted">
                  PDF, JPG, PNG, DOC, DOCX — max 10 MB
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>

          {/* Guest selector */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc-guest" className="font-body text-[13px] font-semibold text-text-secondary tracking-[0.08em] uppercase">
              Guest (optional)
            </label>
            <select
              id="doc-guest"
              value={selectedGuestId}
              onChange={(e) => setSelectedGuestId(e.target.value)}
              className="h-[44px] border-[1.5px] border-border rounded-[6px] px-3 font-body text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
            >
              <option value="">None</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.first_name} {g.last_name}{g.email ? ` (${g.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Reservation selector */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="doc-reservation" className="font-body text-[13px] font-semibold text-text-secondary tracking-[0.08em] uppercase">
              Reservation (optional)
            </label>
            <select
              id="doc-reservation"
              value={selectedReservationId}
              onChange={(e) => setSelectedReservationId(e.target.value)}
              className="h-[44px] border-[1.5px] border-border rounded-[6px] px-3 font-body text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
            >
              <option value="">None</option>
              {reservations.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.confirmation_number}
                  {r.guests ? ` — ${r.guests.first_name} ${r.guests.last_name}` : ''}
                  {r.check_in ? ` (${r.check_in})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        description={confirmState?.description}
        onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null) }}
        onCancel={() => setConfirmState(null)}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  )
}
