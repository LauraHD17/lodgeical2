// src/pages/admin/Reservations.jsx
// Full reservations management page with filters, list view, and side drawer.

import { useState, useMemo, useCallback } from 'react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { Plus, X, FunnelSimple, CalendarBlank } from '@phosphor-icons/react'

import { useReservations } from '@/hooks/useReservations'
import { DataTable } from '@/components/shared/DataTable'
import { StatusChip } from '@/components/shared/StatusChip'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ReservationModal } from '@/components/reservations/ReservationModal'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
]

const COLUMNS = [
  {
    key: 'confirmation_number',
    label: 'Confirmation #',
    render: (val) => <span className="font-mono text-[14px]">{val ?? '—'}</span>,
  },
  {
    key: 'guest_name',
    label: 'Guest Name',
    render: (_, row) => {
      const g = row.guests
      if (!g) return <span className="text-text-muted font-body text-[14px]">—</span>
      return <span className="font-body text-[14px]">{g.first_name} {g.last_name}</span>
    },
  },
  {
    key: 'check_in',
    label: 'Check-in',
    render: (val) => (
      <span className="font-mono text-[14px]">
        {val ? format(parseISO(val), 'MMM d, yyyy') : '—'}
      </span>
    ),
  },
  {
    key: 'check_out',
    label: 'Check-out',
    render: (val) => (
      <span className="font-mono text-[14px]">
        {val ? format(parseISO(val), 'MMM d, yyyy') : '—'}
      </span>
    ),
  },
  {
    key: 'nights',
    label: 'Nights',
    numeric: true,
    render: (_, row) => {
      if (!row.check_in || !row.check_out) return <span className="font-mono text-[14px]">—</span>
      const n = differenceInCalendarDays(parseISO(row.check_out), parseISO(row.check_in))
      return <span className="font-mono text-[14px]">{n}</span>
    },
  },
  {
    key: 'room',
    label: 'Room',
    render: (_, row) => (
      <span className="font-body text-[14px] text-text-secondary">
        {row.room_ids?.length ? `${row.room_ids.length} room(s)` : '—'}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (val) => <StatusChip status={val} />,
  },
  {
    key: 'total_due_cents',
    label: 'Total',
    numeric: true,
    render: (val) => (
      <span className="font-mono text-[14px]">
        ${val != null ? (val / 100).toFixed(2) : '0.00'}
      </span>
    ),
  },
]

function ReservationDrawer({ reservation, onClose }) {
  if (!reservation) return null
  const g = reservation.guests
  const nights =
    reservation.check_in && reservation.check_out
      ? differenceInCalendarDays(parseISO(reservation.check_out), parseISO(reservation.check_in))
      : 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[9990] bg-black opacity-30"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[420px] max-w-full z-[9991] bg-surface-raised shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-heading text-[20px] text-text-primary">Reservation Details</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <div>
            <label className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-secondary">
              Confirmation #
            </label>
            <p className="font-mono text-[16px] text-text-primary mt-1">
              {reservation.confirmation_number ?? '—'}
            </p>
          </div>

          <div>
            <label className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-secondary">
              Status
            </label>
            <div className="mt-1">
              <StatusChip status={reservation.status} />
            </div>
          </div>

          {g && (
            <div>
              <label className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-secondary">
                Guest
              </label>
              <p className="font-body text-[15px] text-text-primary mt-1">
                {g.first_name} {g.last_name}
              </p>
              <p className="font-body text-[13px] text-text-secondary">{g.email}</p>
              {g.phone && (
                <p className="font-body text-[13px] text-text-secondary">{g.phone}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-secondary">
                Check-in
              </label>
              <p className="font-mono text-[14px] text-text-primary mt-1">
                {reservation.check_in ? format(parseISO(reservation.check_in), 'MMM d, yyyy') : '—'}
              </p>
            </div>
            <div>
              <label className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-secondary">
                Check-out
              </label>
              <p className="font-mono text-[14px] text-text-primary mt-1">
                {reservation.check_out ? format(parseISO(reservation.check_out), 'MMM d, yyyy') : '—'}
              </p>
            </div>
          </div>

          <div>
            <label className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-secondary">
              Nights
            </label>
            <p className="font-mono text-[14px] text-text-primary mt-1">{nights}</p>
          </div>

          <div>
            <label className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-secondary">
              Guests
            </label>
            <p className="font-mono text-[14px] text-text-primary mt-1">{reservation.num_guests ?? '—'}</p>
          </div>

          <div>
            <label className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-secondary">
              Total Due
            </label>
            <p className="font-mono text-[20px] text-text-primary mt-1">
              ${reservation.total_due_cents != null ? (reservation.total_due_cents / 100).toFixed(2) : '0.00'}
            </p>
          </div>

          {reservation.notes && (
            <div>
              <label className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-secondary">
                Notes
              </label>
              <p className="font-body text-[14px] text-text-secondary mt-1">{reservation.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function Reservations() {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const [filters, setFilters] = useState({ status: '', dateFrom: '', dateTo: '' })
  const [activeFilters, setActiveFilters] = useState({})

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useReservations(activeFilters)

  const allReservations = useMemo(() => {
    return data?.pages?.flatMap((p) => p.data) ?? []
  }, [data])

  const applyFilters = useCallback(() => {
    const f = {}
    if (filters.status) f.status = filters.status
    if (filters.dateFrom) f.dateFrom = filters.dateFrom
    if (filters.dateTo) f.dateTo = filters.dateTo
    setActiveFilters(f)
  }, [filters])

  const clearFilters = useCallback(() => {
    setFilters({ status: '', dateFrom: '', dateTo: '' })
    setActiveFilters({})
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">Reservations</h1>
        <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
          <Plus size={16} weight="bold" /> New Reservation
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface border border-border rounded-[8px] p-4 flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 text-text-secondary">
          <FunnelSimple size={16} />
          <span className="font-body text-[14px] font-semibold">Filters</span>
        </div>

        <div className="flex flex-wrap gap-4 flex-1">
          <div className="min-w-[160px]">
            <Input
              label="From"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            />
          </div>
          <div className="min-w-[160px]">
            <Input
              label="To"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            />
          </div>
          <div className="min-w-[180px]">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={filters.status}
              onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={applyFilters}>
            Apply
          </Button>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="border border-border rounded-[8px] overflow-hidden">
        <DataTable
          columns={COLUMNS}
          data={allReservations}
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center gap-3 py-8">
              <CalendarBlank size={40} className="text-text-muted" weight="light" />
              <p className="font-body text-[15px] text-text-muted">No reservations yet</p>
              <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
                <Plus size={14} weight="bold" /> Create first reservation
              </Button>
            </div>
          }
        />
      </div>

      {/* Load More */}
      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            size="md"
            loading={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            Load more
          </Button>
        </div>
      )}

      {/* Row click handler is via a wrapper — using onRowClick simulation */}
      {/* Reservation Drawer */}
      {selectedReservation && (
        <ReservationDrawer
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
        />
      )}

      {/* New Reservation Modal */}
      <ReservationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
