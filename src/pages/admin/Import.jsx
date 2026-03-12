// src/pages/admin/Import.jsx
// Import page — CSV drag-and-drop with live column-mapping preview,
// room-name mapping for mismatches, and import history for transition workflows.

import { useState, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UploadSimple, DownloadSimple, Info, FileText, X, CheckCircle, Warning, ClockCounterClockwise, ArrowRight } from '@phosphor-icons/react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/useToast'
import { useProperty } from '@/lib/property/useProperty'
import { useRooms } from '@/hooks/useRooms'
import { queryKeys } from '@/config/queryKeys'
import { cn } from '@/lib/utils'
import { parseCsvToRows } from '@/lib/csv/parseRfc4180'
import { TransferChecklist } from '@/components/import/TransferChecklist'
import { autoSuggestMapping, isTemplateCsv, applyColumnMapping, IMPORT_FIELDS, SPECIAL } from '@/lib/csv/columnMapper'

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

function buildColumnOptions(field, headers) {
  const cols = headers.map(h => ({ value: h, label: h }))
  const specials = []
  if (!field.required) {
    if (field.default === SPECIAL.AUTOGEN)         specials.push({ value: SPECIAL.AUTOGEN,    label: '(Auto-generate)' })
    else if (field.default === SPECIAL.ZERO)       specials.push({ value: SPECIAL.ZERO,       label: '(Default to $0)' })
    else if (field.default === SPECIAL.CONFIRMED)  specials.push({ value: SPECIAL.CONFIRMED,  label: '(Default: confirmed)' })
    else                                           specials.push({ value: SPECIAL.SKIP,       label: '(None — skip)' })
  }
  return [...cols, ...specials]
}

export default function Import() {
  const { addToast } = useToast()
  const { propertyId } = useProperty()
  const queryClient = useQueryClient()
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)   // { headers, previewRows, allRows, rawRows? }
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)     // { imported, skipped, errors }
  const [checklistRows, setChecklistRows] = useState(null)
  const [roomMappings, setRoomMappings] = useState({}) // { csvName: lodgeicalRoomName }
  const [columnMapping, setColumnMapping] = useState(null)   // null = template CSV; object = foreign CSV
  const [moneyUnit, setMoneyUnit] = useState('dollars')       // 'dollars' | 'cents'
  const [mappingConfirmed, setMappingConfirmed] = useState(false)
  const fileInputRef = useRef(null)

  const { data: rooms = [] } = useRooms()

  // Fetch import history
  const { data: importBatches = [] } = useQuery({
    queryKey: queryKeys.importBatches.list(propertyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_batches')
        .select()
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })

  // Room name matching — runs on allRows (post-mapping for foreign CSVs)
  const { autoMatched, unmatched } = useMemo(() => {
    if (!preview?.allRows?.length || !rooms.length) return { autoMatched: [], unmatched: [] }

    const roomNameMap = new Map(rooms.map(r => [r.name.toLowerCase().trim(), r.name]))
    const uniqueCsvNames = [...new Set(preview.allRows.map(r => r.room_name?.trim()).filter(Boolean))]

    const auto = []
    const un = []
    for (const csvName of uniqueCsvNames) {
      if (roomNameMap.has(csvName.toLowerCase().trim())) {
        auto.push({ csvName, matchedTo: roomNameMap.get(csvName.toLowerCase().trim()) })
      } else {
        un.push(csvName)
      }
    }
    return { autoMatched: auto, unmatched: un }
  }, [preview, rooms])

  const allMapped = unmatched.length === 0 || unmatched.every(name => roomMappings[name])
  const unmatchedSet = useMemo(() => new Set(unmatched), [unmatched])

  const roomOptions = useMemo(
    () => rooms.map(r => ({ value: r.name, label: r.name })),
    [rooms],
  )

  // Required fields must be mapped to a real CSV column (not a sentinel)
  const requiredMapped = !!columnMapping && ['guest_name', 'room_name', 'check_in', 'check_out']
    .every(k => columnMapping[k] && !Object.values(SPECIAL).includes(columnMapping[k]))

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
    setRoomMappings({})
    setColumnMapping(null)
    setMappingConfirmed(false)
    setMoneyUnit('dollars')
    const reader = new FileReader()
    reader.onload = (evt) => {
      const { headers, rows } = parseCsvToRows(evt.target.result)
      if (isTemplateCsv(headers)) {
        setColumnMapping(null)
        setMappingConfirmed(true)
        setPreview({ headers, previewRows: rows.slice(0, 5), allRows: rows })
      } else {
        setColumnMapping(autoSuggestMapping(headers))
        setMappingConfirmed(false)
        setPreview({ headers, previewRows: rows.slice(0, 5), allRows: [], rawRows: rows })
      }
    }
    reader.readAsText(f)
  }

  function clearFile() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setRoomMappings({})
    setColumnMapping(null)
    setMappingConfirmed(false)
    setMoneyUnit('dollars')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function applyAndConfirmMapping() {
    const mapped = applyColumnMapping(preview.rawRows, columnMapping, moneyUnit)
    setPreview(p => ({ ...p, allRows: mapped }))
    setMappingConfirmed(true)
  }

  async function handleImport() {
    if (!preview?.allRows?.length || !allMapped) return
    setImporting(true)
    setResult(null)
    try {
      // Apply room name mappings before sending
      const roomNameMap = new Map(rooms.map(r => [r.name.toLowerCase().trim(), r.name]))
      const mappedRows = preview.allRows.map(row => {
        const csvName = row.room_name?.trim()
        if (!csvName) return row
        if (roomMappings[csvName]) return { ...row, room_name: roomMappings[csvName] }
        const matched = roomNameMap.get(csvName.toLowerCase().trim())
        if (matched) return { ...row, room_name: matched }
        return row
      })

      // Refresh session to ensure access_token is valid before calling edge function
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        addToast({ message: 'Session expired — please log in again.', variant: 'error' })
        setImporting(false)
        return
      }

      const { data: json, error: fnError } = await supabase.functions.invoke('import-csv', {
        body: { rows: mappedRows },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (fnError) {
        const body = await fnError.context?.text?.().catch(() => null)
        let parsed = null
        try { parsed = JSON.parse(body) } catch { /* not json */ }
        throw new Error(parsed?.error ?? body ?? fnError.message ?? 'Import failed')
      }
      setResult(json)

      // Build checklist rows from the import preview data
      if (json.imported > 0 && preview?.allRows) {
        setChecklistRows(mappedRows.map((row, i) => ({
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

      // Save import batch for history (non-blocking)
      supabase.from('import_batches').insert({
        property_id: propertyId,
        imported_count: json.imported,
        skipped_count: json.skipped,
        error_count: json.errors?.length ?? 0,
        file_name: file?.name ?? 'csv-import',
        reservation_ids: [],
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.importBatches.all })
      }).catch(() => {})
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })

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
        <h1 className="font-heading text-[24px] sm:text-[32px] text-text-primary uppercase">Import</h1>
        <Button variant="secondary" size="md" onClick={downloadTemplate}>
          <DownloadSimple size={16} /> Download Template
        </Button>
      </div>

      {/* Transition guide */}
      <div className="bg-info-bg border border-info rounded-[8px] p-4 flex items-start gap-3">
        <Info size={18} className="text-info shrink-0 mt-0.5" weight="fill" />
        <div className="flex flex-col gap-1.5">
          <p className="font-body font-semibold text-[15px] text-info">
            Transitioning from another system?
          </p>
          <p className="font-body text-[14px] text-info">
            Upload your existing CSV — any column format works. Lodge-ical will help you
            map your columns to the right fields. Re-imports are safe: duplicate reservations
            (same room, same dates) are automatically skipped.
          </p>
          <p className="font-body text-[14px] text-info">
            Dates must be <strong className="font-semibold">YYYY-MM-DD</strong>. Room names are
            matched to your Rooms page — we&rsquo;ll help you map any that don&rsquo;t match.
          </p>
        </div>
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
              {preview && ` · ${preview.rawRows?.length ?? preview.allRows.length} row${(preview.rawRows?.length ?? preview.allRows.length) !== 1 ? 's' : ''}`}
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

      {/* Column Mapper — shown for non-template CSVs before confirming */}
      {columnMapping && !mappingConfirmed && preview && (
        <div className="bg-surface border border-border rounded-[8px] p-5 flex flex-col gap-4">
          <div>
            <h4 className="font-body text-[13px] font-semibold uppercase tracking-[0.08em] text-text-secondary mb-1">
              Column Mapping
            </h4>
            <p className="font-body text-[13px] text-text-secondary">
              Your CSV uses custom column names. Match each field to the right column — we&rsquo;ve pre-filled our best guesses.
            </p>
          </div>

          <div className="flex flex-col">
            <div className="grid grid-cols-2 gap-3 pb-2 border-b border-border mb-1">
              <span className="font-body text-[12px] uppercase tracking-wider text-text-muted font-semibold">Lodge-ical Field</span>
              <span className="font-body text-[12px] uppercase tracking-wider text-text-muted font-semibold">Your CSV Column</span>
            </div>
            {IMPORT_FIELDS.map(field => (
              <div key={field.key} className="grid grid-cols-2 gap-3 items-start py-2 border-b border-border last:border-0">
                <div>
                  <span className="font-body text-[14px] text-text-primary">
                    {field.label}{field.required && <span className="text-danger ml-0.5">*</span>}
                  </span>
                  {field.hint && (
                    <span className="font-body text-[12px] text-text-muted block">{field.hint}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Select
                      options={buildColumnOptions(field, preview.headers)}
                      value={columnMapping[field.key] ?? ''}
                      onValueChange={val => setColumnMapping(prev => ({ ...prev, [field.key]: val }))}
                    />
                  </div>
                  {field.special === 'money'
                    && columnMapping[field.key]
                    && !Object.values(SPECIAL).includes(columnMapping[field.key])
                    && (
                    <div className="flex items-center gap-2 shrink-0 font-body text-[13px] text-text-secondary">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="moneyUnit"
                          value="dollars"
                          checked={moneyUnit === 'dollars'}
                          onChange={() => setMoneyUnit('dollars')}
                        />
                        $
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="moneyUnit"
                          value="cents"
                          checked={moneyUnit === 'cents'}
                          onChange={() => setMoneyUnit('cents')}
                        />
                        ¢
                      </label>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button
            variant="primary"
            size="md"
            disabled={!requiredMapped}
            onClick={applyAndConfirmMapping}
            className="self-start"
          >
            Confirm Mapping
          </Button>
        </div>
      )}

      {/* Preview + room matching — shown after mapping confirmed (or template CSV) */}
      {preview && (columnMapping === null || mappingConfirmed) && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-[20px] text-text-primary">Preview</h2>
            {columnMapping && mappingConfirmed && (
              <button
                onClick={() => setMappingConfirmed(false)}
                className="font-body text-[13px] text-info hover:underline"
              >
                Edit column mapping
              </button>
            )}
          </div>

          {/* Revenue warning — shown when a foreign CSV has both money columns left at $0 default */}
          {columnMapping && mappingConfirmed
            && columnMapping.total_due_cents === SPECIAL.ZERO
            && (
            <div className="bg-warning-bg border border-warning rounded-[8px] p-4 flex items-start gap-3">
              <Warning size={18} className="text-warning shrink-0 mt-0.5" weight="fill" />
              <p className="font-body text-[14px] text-text-primary">
                <span className="font-semibold">No charge column mapped.</span>{' '}
                Financial reports for these reservations will show $0 revenue. Occupancy and calendar
                will be correct, but ADR and revenue metrics will be understated.{' '}
                <button
                  onClick={() => setMappingConfirmed(false)}
                  className="text-info underline underline-offset-2"
                >
                  Edit mapping
                </button>{' '}
                to fix this.
              </p>
            </div>
          )}

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
                    {preview.headers.map((h, j) => {
                      const isUnmatchedRoom = h === 'room_name' && row[h] && unmatchedSet.has(row[h]?.trim()) && !roomMappings[row[h]?.trim()]
                      return (
                        <td
                          key={j}
                          className={cn(
                            'px-3 py-2 font-body text-[13px] whitespace-nowrap',
                            isUnmatchedRoom ? 'text-danger font-semibold' : 'text-text-secondary',
                          )}
                        >
                          {row[h] || <span className="text-text-muted italic">empty</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-body text-[13px] text-text-muted">
            Showing first {preview.previewRows.length} of {preview.allRows.length} row(s)
          </p>

          {/* Room name matching status */}
          {rooms.length > 0 && (autoMatched.length > 0 || unmatched.length > 0) && (
            <>
              {unmatched.length > 0 ? (
                <div className="bg-warning-bg border border-warning rounded-[8px] p-5 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <Warning size={18} className="text-warning shrink-0 mt-0.5" weight="fill" />
                    <div>
                      <p className="font-body font-semibold text-[15px] text-text-primary">
                        {unmatched.length} room name{unmatched.length !== 1 ? 's' : ''} not recognized
                      </p>
                      <p className="font-body text-[13px] text-text-secondary mt-0.5">
                        Select the correct Lodge-ical room for each name from your CSV.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {unmatched.map((csvName) => (
                      <div key={csvName} className="flex items-center gap-3">
                        <span className="font-mono text-[14px] text-text-primary min-w-[140px] shrink-0">
                          &ldquo;{csvName}&rdquo;
                        </span>
                        <ArrowRight size={16} weight="bold" className="text-text-muted shrink-0" />
                        <div className="w-[240px]">
                          <Select
                            placeholder="Select a room"
                            options={roomOptions}
                            value={roomMappings[csvName] ?? ''}
                            onValueChange={(val) => setRoomMappings(prev => ({ ...prev, [csvName]: val }))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {autoMatched.length > 0 && (
                    <p className="font-body text-[13px] text-success">
                      {autoMatched.length} name{autoMatched.length !== 1 ? 's' : ''} auto-matched
                      {autoMatched.length <= 3 && ': '}
                      {autoMatched.length <= 3 && autoMatched.map(m =>
                        `"${m.csvName}" → "${m.matchedTo}"`
                      ).join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-success-bg border border-success rounded-[8px] p-4 flex items-center gap-3">
                  <CheckCircle size={18} className="text-success shrink-0" weight="fill" />
                  <p className="font-body text-[14px] text-success font-semibold">
                    All room names matched your Lodge-ical rooms
                  </p>
                </div>
              )}
            </>
          )}

          <Button
            variant="primary"
            size="md"
            loading={importing}
            disabled={!allMapped}
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
              ? <Warning size={18} className="text-warning mt-0.5 shrink-0" weight="fill" />
              : <CheckCircle size={18} className="text-success mt-0.5 shrink-0" weight="fill" />
            }
            <div className="flex flex-col gap-1">
              <p className="font-body font-semibold text-[14px] text-text-primary">
                Import complete
              </p>
              <p className="font-body text-[13px] text-text-secondary">
                {result.imported} reservation{result.imported !== 1 ? 's' : ''} created
                {result.skipped > 0 && ` · ${result.skipped} skipped (already exist)`}
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

      {/* Import History — shown when no active import result */}
      {!result && importBatches.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-[20px] text-text-primary flex items-center gap-2">
            <ClockCounterClockwise size={20} weight="fill" className="text-text-secondary" />
            Import History
          </h2>
          <div className="border border-border rounded-[8px] overflow-hidden">
            {importBatches.map((batch, i) => (
              <div
                key={batch.id}
                className={cn(
                  'px-4 py-3',
                  i > 0 && 'border-t border-border',
                  i % 2 === 0 ? 'bg-surface-raised' : 'bg-surface',
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[13px] text-text-secondary">
                    {format(parseISO(batch.created_at), 'MMM d, yyyy')}
                  </span>
                  {batch.file_name && (
                    <>
                      <span className="text-text-muted">·</span>
                      <span className="font-body text-[14px] font-semibold text-text-primary">
                        {batch.file_name}
                      </span>
                    </>
                  )}
                </div>
                <div className="font-mono text-[13px] mt-1 flex items-center gap-3">
                  <span className="text-success">{batch.imported_count} imported</span>
                  {batch.skipped_count > 0 && (
                    <span className="text-warning">{batch.skipped_count} skipped</span>
                  )}
                  {batch.error_count > 0 && (
                    <span className="text-danger">{batch.error_count} error{batch.error_count !== 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
