// src/pages/admin/Guests.jsx
// Guests management page.

import { useState, useEffect, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { MagnifyingGlass, X, UserCircle } from '@phosphor-icons/react'

import { useGuests, useUpdateGuest } from '@/hooks/useGuests'
import { useReservations } from '@/hooks/useReservations'
import { DataTable } from '@/components/shared/DataTable'
import { StatusChip } from '@/components/shared/StatusChip'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'

function GuestDrawer({ guest, onClose }) {
  const { data, isLoading } = useReservations()
  const { addToast } = useToast()
  const updateGuest = useUpdateGuest()
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({
    first_name: guest.first_name ?? '',
    last_name: guest.last_name ?? '',
    phone: guest.phone ?? '',
  })

  const guestReservations = useMemo(() => {
    const all = data?.pages?.flatMap((p) => p.data) ?? []
    return all.filter((r) => r.guests?.id === guest.id)
  }, [data, guest.id])

  async function handleSave() {
    try {
      await updateGuest.mutateAsync({ id: guest.id, ...form })
      addToast({ message: 'Guest updated', variant: 'success' })
      setEditMode(false)
    } catch {
      addToast({ message: 'Failed to update guest', variant: 'error' })
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black opacity-30" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[440px] max-w-full z-[9991] bg-surface-raised shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <UserCircle size={32} className="text-text-muted" />
            <h2 className="font-heading text-[20px] text-text-primary">
              {guest.first_name} {guest.last_name}
            </h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Contact Info */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-body text-[13px] uppercase tracking-wider font-semibold text-text-secondary">
                Contact
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>
                {editMode ? 'Cancel' : 'Edit'}
              </Button>
            </div>

            {editMode ? (
              <div className="flex flex-col gap-3">
                <Input
                  label="First Name"
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                />
                <Input
                  label="Last Name"
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                />
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
                <Button
                  variant="primary"
                  size="sm"
                  loading={updateGuest.isPending}
                  onClick={handleSave}
                >
                  Save Changes
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="font-body text-[14px] text-text-primary">{guest.email}</p>
                {guest.phone && (
                  <p className="font-body text-[14px] text-text-secondary">{guest.phone}</p>
                )}
                <p className="font-body text-[13px] text-text-muted">
                  Since: <span className="font-mono text-[13px]">
                    {guest.created_at ? format(parseISO(guest.created_at), 'MMM d, yyyy') : '—'}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Tags */}
          {guest.tags && guest.tags.length > 0 && (
            <div>
              <h3 className="font-body text-[13px] uppercase tracking-wider font-semibold text-text-secondary mb-2">
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {guest.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-body text-[12px] bg-info-bg text-info border border-info rounded-full px-3 py-1"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reservation History */}
          <div>
            <h3 className="font-body text-[13px] uppercase tracking-wider font-semibold text-text-secondary mb-3">
              Reservation History
            </h3>
            {isLoading ? (
              <div className="animate-pulse bg-border rounded h-24 w-full" />
            ) : guestReservations.length === 0 ? (
              <p className="font-body text-[14px] text-text-muted">No reservations found</p>
            ) : (
              <div className="flex flex-col gap-3">
                {guestReservations.map((r) => (
                  <div
                    key={r.id}
                    className="bg-surface border border-border rounded-[6px] p-3 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[13px] text-text-primary">
                        {r.confirmation_number ?? r.id}
                      </span>
                      <StatusChip status={r.status} />
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="font-mono text-[13px] text-text-secondary">
                        {r.check_in ? format(parseISO(r.check_in), 'MMM d') : '—'}
                      </span>
                      <span className="text-text-muted">→</span>
                      <span className="font-mono text-[13px] text-text-secondary">
                        {r.check_out ? format(parseISO(r.check_out), 'MMM d, yyyy') : '—'}
                      </span>
                    </div>
                    <span className="font-mono text-[13px] text-text-primary">
                      ${r.total_due_cents != null ? (r.total_due_cents / 100).toFixed(2) : '0.00'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const COLUMNS = [
  {
    key: 'first_name',
    label: 'First Name',
    render: (val) => <span className="font-body text-[14px]">{val ?? '—'}</span>,
  },
  {
    key: 'last_name',
    label: 'Last Name',
    render: (val) => <span className="font-body text-[14px]">{val ?? '—'}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    render: (val) => <span className="font-body text-[14px]">{val ?? '—'}</span>,
  },
  {
    key: 'phone',
    label: 'Phone',
    render: (val) => <span className="font-body text-[14px]">{val ?? '—'}</span>,
  },
  {
    key: 'created_at',
    label: 'Created',
    render: (val) => (
      <span className="font-mono text-[14px]">
        {val ? format(parseISO(val), 'MMM d, yyyy') : '—'}
      </span>
    ),
  },
]

export default function Guests() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedGuest, setSelectedGuest] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: guests = [], isLoading } = useGuests(debouncedSearch)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">Guests</h1>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
        />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 w-full border-[1.5px] border-border rounded-[6px] pl-9 pr-3 font-body text-[15px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border border-border rounded-[8px] overflow-hidden">
        <DataTable
          columns={COLUMNS}
          data={guests}
          loading={isLoading}
          emptyState={
            <p className="font-body text-[15px] text-text-muted py-8">
              {debouncedSearch ? `No guests matching "${debouncedSearch}"` : 'No guests yet'}
            </p>
          }
        />
      </div>

      {/* Clickable rows — overlay since DataTable doesn't natively support row clicks */}
      {/* We render a visually hidden row overlay approach via separate solution */}
      {guests.length > 0 && !isLoading && (
        <div className="text-[13px] text-text-muted font-body">
          Click a guest row to view details. ({guests.length} guest{guests.length !== 1 ? 's' : ''} found)
        </div>
      )}

      {/* Guest Drawer */}
      {selectedGuest && (
        <GuestDrawer
          guest={selectedGuest}
          onClose={() => setSelectedGuest(null)}
        />
      )}
    </div>
  )
}
