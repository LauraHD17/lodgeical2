import { CaretUpDown, CaretUp, CaretDown, CaretRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

function SkeletonRow({ columnCount }) {
  return (
    <tr>
      {Array.from({ length: columnCount }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="animate-pulse bg-border rounded h-10 w-full" />
        </td>
      ))}
    </tr>
  )
}

export function DataTable({
  columns = [],
  data = [],
  loading = false,
  emptyState,
  onSort,
  sortKey,
  sortDir,
  onRowClick,
}) {
  function handleSort(col) {
    if (!col.sortable || !onSort) return
    const newDir = sortKey === col.key && sortDir === 'asc' ? 'desc' : 'asc'
    onSort(col.key, newDir)
  }

  function SortIcon({ colKey }) {
    if (sortKey !== colKey) {
      return <CaretUpDown size={14} className="shrink-0 opacity-60" />
    }
    if (sortDir === 'asc') {
      return <CaretUp size={14} className="shrink-0 text-info" />
    }
    return <CaretDown size={14} className="shrink-0 text-info" />
  }

  const isEmpty = !loading && data.length === 0

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-text-primary">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left font-body text-[13px] uppercase tracking-[0.08em] text-white font-semibold select-none whitespace-nowrap',
                  col.numeric && 'text-right',
                  col.sortable && 'cursor-pointer hover:opacity-80',
                  sortKey === col.key && 'underline text-info'
                )}
                onClick={() => handleSort(col)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && <SortIcon colKey={col.key} />}
                </span>
              </th>
            ))}
            {onRowClick && <th className="w-8" />}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <>
              <SkeletonRow columnCount={columns.length + (onRowClick ? 1 : 0)} />
              <SkeletonRow columnCount={columns.length + (onRowClick ? 1 : 0)} />
              <SkeletonRow columnCount={columns.length + (onRowClick ? 1 : 0)} />
            </>
          ) : isEmpty ? (
            <tr>
              <td colSpan={columns.length + (onRowClick ? 1 : 0)} className="px-4 py-12 text-center">
                {emptyState ?? (
                  <span className="text-text-muted font-body text-[15px]">
                    No data found
                  </span>
                )}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={row.id ?? rowIndex}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(row) } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'button' : undefined}
                className={cn(
                  'group transition-colors duration-150 hover:bg-info-bg',
                  rowIndex % 2 === 0 ? 'bg-white' : 'bg-tableAlt',
                  onRowClick && 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-info'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3.5 font-body text-[15px] text-text-primary',
                      col.numeric && 'font-mono text-right'
                    )}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
                {onRowClick && (
                  <td className="w-8 px-2 py-3.5">
                    <CaretRight size={14} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
