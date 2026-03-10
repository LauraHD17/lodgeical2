// src/components/import/TransferChecklist.jsx
// Printable transfer checklist shown after a successful CSV import.
// Each imported reservation gets a row with a checkbox for manual verification.

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Printer, FilePdf, CaretDown, CaretUp } from '@phosphor-icons/react'
import { useProperty } from '@/lib/property/useProperty'
import { cn, dollars } from '@/lib/utils'

export function TransferChecklist({ reservations, importResult, importDate }) {
  const [expanded, setExpanded] = useState(false)
  const { property } = useProperty()

  if (!reservations || reservations.length === 0) return null

  // Sort by check_in ascending, exclude cancelled
  const sorted = [...reservations]
    .filter(r => r.status !== 'cancelled')
    .sort((a, b) => (a.check_in ?? '').localeCompare(b.check_in ?? ''))

  const previewRows = sorted.slice(0, 5)
  const displayDate = importDate ? format(parseISO(importDate), 'MMMM d, yyyy') : format(new Date(), 'MMMM d, yyyy')

  return (
    <div className="mt-6">
      {/* Import success bar */}
      <div className="bg-success-bg border border-success/30 rounded-[6px] p-4 flex items-center gap-3 mb-5">
        <span className="text-success font-semibold text-[18px]">✓</span>
        <div>
          <div className="font-body text-[15px] font-semibold text-text-primary">
            Import complete
          </div>
          <div className="font-body text-[13px] text-text-secondary">
            {importResult.imported} reservations created
            {importResult.skipped > 0 && ` · ${importResult.skipped} skipped`}
            {importResult.errors?.length > 0 && ` · ${importResult.errors.length} errors`}
          </div>
        </div>
      </div>

      {/* Checklist panel */}
      <div className="border-2 border-dashed border-border rounded-[8px] overflow-hidden">
        {/* Header */}
        <div className="bg-surface border-b border-border px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Printer size={20} className="text-text-secondary shrink-0" />
            <div>
              <div className="font-body text-[14px] font-semibold text-text-primary">
                Reservation Transfer Checklist
              </div>
              <div className="font-body text-[12px] text-text-secondary">
                Print this · verify each row against your old system · check the box
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 no-print">
            <button
              onClick={() => window.print()}
              className="font-body text-[13px] font-semibold px-3.5 py-2 bg-text-primary text-white border-none cursor-pointer rounded-none flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Printer size={14} />
              Print
            </button>
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full font-body text-[13px] text-info bg-info-bg border-none border-b border-border px-5 py-2.5 cursor-pointer text-left flex items-center gap-1.5 hover:opacity-80 transition-opacity no-print"
        >
          {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
          {expanded ? 'Hide preview' : `Preview (first ${Math.min(5, sorted.length)} of ${sorted.length} rows)`}
        </button>

        {/* Table (shown expanded, always in print) */}
        <div className={cn('print-checklist', expanded ? 'block' : 'hidden print:block')}>
          <div className="bg-surface-raised p-6">
            {/* Print header */}
            <div className="hidden print:flex justify-between mb-4">
              <div>
                <div className="font-heading text-[18px] text-text-primary">
                  Reservation Transfer Checklist
                </div>
                <div className="font-body text-[12px] text-text-muted mt-0.5">
                  Imported {displayDate} · Verify each row against your old system
                </div>
              </div>
              <div className="font-body text-[11px] text-text-muted text-right">
                <div>{property?.name ?? 'Lodge-ical'}</div>
                <div>Page 1 of 1</div>
              </div>
            </div>

            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-text-primary">
                  {['✓', 'Conf #', 'Guest Name', 'Room', 'Check-in', 'Check-out', 'Total', 'Notes'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-white font-body text-[11px] font-bold uppercase tracking-[0.06em]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(expanded ? sorted : previewRows).map((row, i) => (
                  <tr key={row.id ?? i} className={cn(
                    'border-b border-border',
                    i % 2 === 0 ? 'bg-surface-raised' : 'bg-tableAlt'
                  )}>
                    <td className="px-3 py-2.5">
                      <div className="w-4 h-4 border-[1.5px] border-text-muted rounded-[2px]" />
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-text-primary">
                      {row.confirmation_number ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 font-body text-[14px] font-semibold text-text-primary">
                      {row.guest_name ?? (`${row.guests?.first_name ?? ''} ${row.guests?.last_name ?? ''}`.trim() || '—')}
                    </td>
                    <td className="px-3 py-2.5 font-body text-[13px] text-text-secondary">
                      {row.room_name ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-text-secondary">
                      {row.check_in ? format(parseISO(row.check_in), 'MMM d') : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-text-secondary">
                      {row.check_out ? format(parseISO(row.check_out), 'MMM d') : '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[13px] text-text-primary">
                      {row.total_due_cents != null ? dollars(row.total_due_cents) : '—'}
                    </td>
                    <td className={cn(
                      'px-3 py-2.5 font-body text-[12px]',
                      row.notes ? 'text-text-secondary' : 'text-text-muted italic'
                    )}>
                      {row.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3 flex justify-between font-body text-[11px] text-text-muted pt-2 border-t border-border">
              <span>{sorted.length} reservations · imported {displayDate}</span>
              <span>{property?.name ?? 'Lodge-ical'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
