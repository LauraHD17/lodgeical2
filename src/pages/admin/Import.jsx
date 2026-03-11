// src/pages/admin/Import.jsx
// Import page — CSV drag-and-drop with live column-mapping preview.
// On submit, the file is parsed client-side and the rows are sent to the
// import-csv edge function which handles guest upsert + reservation creation.

import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { UploadSimple, DownloadSimple, Info, FileText, X, CheckCircle, Warning, ClockCounterClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/useToast'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { cn } from '@/lib/utils'
import { parseCsvToRows } from '@/lib/csv/parseRfc4180'
import { TransferChecklist } from '@/components/import/TransferChecklist'

const CSV_TEMPLATE_HEADERS = [
  'confirmation_number',
  'check_in',
  'check_out',
  'num_guests',
  'guest_first_name',
  'guest_last_name',
  'guest_email',
  'guest_phone',
  'room_name',
  'total_due_cents',
  'status',
  'notes',
]

const CSV_TEMPLATE_SAMPLE = [
  'RES-001',
  '2026-06-01',
  '2026-06-05',
  '2',
  'John',
  'Doe',
  'john@example.com',
  '+1 555 0100',
  'Cabin A',
  '59600',
  'confirmed',
  'Anniversary trip',
]

function downloadTemplate() {
  const rows = [CSV_TEMPLATE_HEADERS.join(','), CSV_TEMPLATE_SAMPLE.join(',')]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'lodgeical-import-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}


export default function Import() {
  const { addToast } = useToast()
  const { propertyId } = useProperty()
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)   // { headers, previewRows, allRows }
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)     // { imported, skipped, errors }
  const [checklistRows, setChecklistRows] = useState(null) // rows for transfer checklist
  const [showLastImport, setShowLastImport] = useState(false)
  const fileInputRef = useRef(null)

  // Fetch last import batch for "View last import"
  const { data: lastBatch } = useQuery({
    queryKey: queryKeys.importBatches.latest(propertyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_batches')
        .select()
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data ?? null
    },
    enabled: !!propertyId,
  })

  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.name.endsWith('.csv')) loadFile(dropped)
  }

  function handleFileChange(e) {
    const selected = e.target.files[0]
    if (selected) loadFile(selected)
  }

  function loadFile(f) {
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const { headers, rows } = parseCsvToRows(evt.target.result)
      setPreview({
        headers,
        previewRows: rows.slice(0, 5),
        allRows: rows,
      })
    }
    reader.readAsText(f)
  }

  function clearFile() {
    setFile(null)
    setPreview(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleImport() {
    if (!preview?.allRows?.length) return
    setImporting(true)
    setResult(null)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        addToast({ message: 'Your session has expired. Please log in again.', variant: 'error' })
        setImporting(false)
        return
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/import-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ rows: preview.allRows }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import failed')
      setResult(json)
      // Build checklist rows from the import preview data
      if (json.imported > 0 && preview?.allRows) {
        setChecklistRows(preview.allRows.map((row, i) => ({
          id: `import-${i}`,
          confirmation_number: row.confirmation_number,
          guest_name: `${row.guest_first_name ?? ''} ${row.guest_last_name ?? ''}`.trim(),
          room_name: row.room_name,
          check_in: row.check_in,
          check_out: row.check_out,
          total_due_cents: row.total_due_cents ? Number(row.total_due_cents) : null,
          status: row.status,
          notes: row.notes,
        })))
      }
      addToast({
        message: `Import complete: ${json.imported} created, ${json.skipped} skipped`,
        variant: 'success',
      })
    } catch (err) {
      addToast({ message: err?.message ?? 'Import failed', variant: 'error' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary uppercase">Import</h1>
        <Button variant="secondary" size="md" onClick={downloadTemplate}>
          <DownloadSimple size={16} /> Download Template
        </Button>
      </div>

      {/* Instructions */}
      <div className="bg-info-bg border border-info rounded-[8px] p-4 flex items-start gap-3">
        <Info size={18} className="text-info shrink-0 mt-0.5" />
        <p className="font-body text-[14px] text-info">
          Upload a CSV file using the template format. Check-in and check-out dates must be
          <strong className="font-semibold"> YYYY-MM-DD</strong>. Room names must exactly match
          the names in your Rooms page.
        </p>
      </div>

      {/* Upload area */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !file && fileInputRef.current?.click() } }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-[8px] p-12 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer',
          dragActive
            ? 'border-info bg-info-bg'
            : 'border-border bg-surface hover:border-info hover:bg-info-bg',
          file && 'cursor-default'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />

        {file ? (
          <div className="flex flex-col items-center gap-3">
            <FileText size={28} className="text-info" weight="fill" />
            <p className="font-body font-semibold text-[16px] text-text-primary">{file.name}</p>
            <p className="font-mono text-[13px] text-text-muted">
              {(file.size / 1024).toFixed(1)} KB
              {preview && ` · ${preview.allRows.length} row${preview.allRows.length !== 1 ? 's' : ''}`}
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); clearFile() }}
              className="flex items-center gap-1 text-danger font-body text-[13px] hover:underline"
            >
              <X size={14} /> Remove file
            </button>
          </div>
        ) : (
          <>
            <UploadSimple size={28} className="text-text-muted" weight="fill" />
            <div className="text-center">
              <p className="font-body font-semibold text-[16px] text-text-primary">
                Drop your CSV file here
              </p>
              <p className="font-body text-[14px] text-text-secondary mt-1">
                or click to browse — .csv files only
              </p>
            </div>
          </>
        )}
      </div>

      {/* Column mapping preview */}
      {preview && (
        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-[20px] text-text-primary">Column Mapping Preview</h2>
          <div className="overflow-x-auto border border-border rounded-[8px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-text-primary">
                  {preview.headers.map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left font-body text-[12px] uppercase tracking-wider text-white font-semibold whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.previewRows.map((row, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? 'bg-surface-raised' : 'bg-tableAlt'}
                  >
                    {preview.headers.map((h, j) => (
                      <td key={j} className="px-3 py-2 font-body text-[13px] text-text-secondary whitespace-nowrap">
                        {row[h] || <span className="text-text-muted italic">empty</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-body text-[13px] text-text-muted">
            Showing first {preview.previewRows.length} of {preview.allRows.length} row(s)
          </p>

          <Button
            variant="primary"
            size="md"
            loading={importing}
            onClick={handleImport}
            className="self-start"
          >
            <UploadSimple size={16} />
            {importing
              ? 'Importing…'
              : `Import ${preview.allRows.length} Row${preview.allRows.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}

      {/* Import result */}
      {result && (
        <div className="flex flex-col gap-3">
          <div className={cn(
            'border rounded-[8px] p-4 flex items-start gap-3',
            result.errors?.length > 0
              ? 'bg-warning-bg border-warning'
              : 'bg-success-bg border-success'
          )}>
            {result.errors?.length > 0
              ? <Warning size={18} className="text-warning mt-0.5 shrink-0" />
              : <CheckCircle size={18} className="text-success mt-0.5 shrink-0" />
            }
            <div className="flex flex-col gap-1">
              <p className="font-body font-semibold text-[14px] text-text-primary">
                Import complete
              </p>
              <p className="font-body text-[13px] text-text-secondary">
                {result.imported} reservation{result.imported !== 1 ? 's' : ''} created
                {' · '}{result.skipped} skipped (already exist)
                {result.errors?.length > 0 && ` · ${result.errors.length} error(s)`}
              </p>
            </div>
          </div>

          {result.errors?.length > 0 && (
            <div className="border border-border rounded-[8px] overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-text-primary">
                    <th className="px-3 py-2 text-left font-body text-[12px] uppercase tracking-wider text-white font-semibold w-16">Row</th>
                    <th className="px-3 py-2 text-left font-body text-[12px] uppercase tracking-wider text-white font-semibold">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((e, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-surface-raised' : 'bg-tableAlt'}>
                      <td className="px-3 py-2 font-mono text-[13px] text-text-secondary">{e.row}</td>
                      <td className="px-3 py-2 font-body text-[13px] text-danger">{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transfer Checklist — shown after a successful import */}
      {result && result.imported > 0 && checklistRows && (
        <TransferChecklist
          reservations={checklistRows}
          importResult={result}
          importDate={new Date().toISOString()}
        />
      )}

      {/* View last import — shown when no active import result */}
      {!result && lastBatch && (
        <div className="border border-border rounded-[8px] p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <ClockCounterClockwise size={18} className="text-text-muted shrink-0" />
            <div>
              <div className="font-body text-[14px] font-semibold text-text-primary">
                Last import
              </div>
              <div className="font-body text-[12px] text-text-secondary">
                {lastBatch.imported_count} reservations imported
                {lastBatch.file_name && ` from ${lastBatch.file_name}`}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLastImport(v => !v)}
          >
            {showLastImport ? 'Hide' : 'View checklist'}
          </Button>
        </div>
      )}
    </div>
  )
}
