// src/pages/admin/Import.jsx
// Import page with CSV drag-and-drop (visual) and template download.

import { useState, useRef } from 'react'
import { UploadSimple, DownloadSimple, Info, FileText, X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

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
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const fileInputRef = useRef(null)

  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.name.endsWith('.csv')) {
      loadFile(dropped)
    }
  }

  function handleFileChange(e) {
    const selected = e.target.files[0]
    if (selected) loadFile(selected)
  }

  function loadFile(f) {
    setFile(f)
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target.result
      const lines = text.split('\n').filter(Boolean)
      const headers = lines[0]?.split(',').map((h) => h.trim())
      const rows = lines.slice(1, 6).map((line) =>
        line.split(',').map((cell) => cell.trim())
      )
      setPreview({ headers, rows })
    }
    reader.readAsText(f)
  }

  function clearFile() {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">Import</h1>
        <Button variant="secondary" size="md" onClick={downloadTemplate}>
          <DownloadSimple size={16} /> Download Template
        </Button>
      </div>

      {/* Coming Soon callout */}
      <div className="bg-info-bg border border-info rounded-[8px] p-4 flex items-start gap-3">
        <Info size={18} className="text-info shrink-0 mt-0.5" />
        <p className="font-body text-[14px] text-info">
          This feature is coming soon. You can preview your CSV structure below, but import processing is not yet active.
        </p>
      </div>

      {/* Upload area */}
      <div
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
            <FileText size={48} className="text-info" weight="light" />
            <p className="font-body font-semibold text-[16px] text-text-primary">{file.name}</p>
            <p className="font-mono text-[13px] text-text-muted">
              {(file.size / 1024).toFixed(1)} KB
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
            <UploadSimple size={48} className="text-text-muted" weight="light" />
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
                {preview.rows.map((row, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-tableAlt'}
                  >
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 font-body text-[13px] text-text-secondary whitespace-nowrap">
                        {cell || <span className="text-text-muted italic">empty</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-body text-[13px] text-text-muted">
            Showing first {Math.min(preview.rows.length, 5)} rows of {file?.name}
          </p>

          <Button variant="primary" size="md" disabled className="self-start">
            <UploadSimple size={16} /> Import (coming soon)
          </Button>
        </div>
      )}
    </div>
  )
}
