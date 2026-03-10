// src/pages/admin/Guests.jsx
// Guests management page with search, guest drawer, and merge-guest flow.
// Merge: Step 1 — search for secondary guest. Step 2 — confirm primary wins all data.
// Merge is executed via supabase edge function 'merge-guests'.

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { MagnifyingGlass, X, UserCircle, GitMerge, ArrowRight } from '@phosphor-icons/react'

import { useGuests, useUpdateGuest } from '@/hooks/useGuests'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/config/queryKeys'
import { DataTable } from '@/components/shared/DataTable'
import { StatusChip } from '@/components/shared/StatusChip'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/useToast'
import { supabase } from '@/lib/supabaseClient'

// ─── Merge Guest Modal ────────────────────────────────────────────────────────

function MergeModal({ primaryGuest, onClose, onMerged }) {
  const [step, setStep] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [secondaryGuest, setSecondaryGuest] = useState(null)
  const [merging, setMerging] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: searchResults = [] } = useGuests(debouncedSearch)
  const filteredResults = searchResults.filter(g => g.id !== primaryGuest.id)

  async function handleMerge() {
    if (!secondaryGuest) return
    setMerging(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expired. Please log in again.')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/merge-guests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          primary_guest_id: primaryGuest.id,
          secondary_guest_id: secondaryGuest.id,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Merge failed')
      addToast({
        message: `Merged successfully — ${json.reservations_updated ?? 0} reservation(s) updated`,
        variant: 'success',
      })
      onMerged()
    } catch (err) {
      addToast({ message: err.message ?? 'Merge failed', variant: 'error' })
    } finally {
      setMerging(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Merge Guests">
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <p className="font-body text-[14px] text-text-secondary">
            Search for the <strong>duplicate guest</strong> to merge into{' '}
            <strong>{primaryGuest.first_name} {primaryGuest.last_name}</strong>.
            All reservations will be moved to the primary guest. The duplicate will be deleted.
          </p>
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-11 w-full border-[1.5px] border-border rounded-[6px] pl-9 pr-3 font-body text-[15px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
            />
          </div>
          {debouncedSearch && filteredResults.length === 0 && (
            <p className="font-body text-[14px] text-text-muted">No matching guests found.</p>
          )}
          {filteredResults.length > 0 && (
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {filteredResults.map(g => (
                <button
                  key={g.id}
                  onClick={() => { setSecondaryGuest(g); setStep(2) }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-[6px] hover:bg-border text-left transition-colors"
                >
                  <span className="font-body text-[14px] text-text-primary">
                    {g.first_name} {g.last_name}
                  </span>
                  <span className="font-body text-[13px] text-text-muted">{g.email}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}

      {step === 2 && secondaryGuest && (
        <div className="flex flex-col gap-5">
          <p className="font-body text-[14px] text-text-secondary">
            Confirm the merge. This <strong>cannot be undone</strong>.
          </p>

          <div className="flex items-center gap-4 bg-surface-raised border border-border rounded-[8px] p-4">
            <div className="flex-1 text-center">
              <p className="font-body text-[11px] uppercase tracking-wider text-text-muted mb-1">Keep (Primary)</p>
              <p className="font-body text-[15px] font-semibold text-text-primary">
                {primaryGuest.first_name} {primaryGuest.last_name}
              </p>
              <p className="font-body text-[13px] text-text-muted">{primaryGuest.email}</p>
            </div>
            <ArrowRight size={20} className="text-text-muted shrink-0" />
            <div className="flex-1 text-center">
              <p className="font-body text-[11px] uppercase tracking-wider text-text-muted mb-1">Delete (Duplicate)</p>
              <p className="font-body text-[15px] font-semibold text-danger">
                {secondaryGuest.first_name} {secondaryGuest.last_name}
              </p>
              <p className="font-body text-[13px] text-text-muted">{secondaryGuest.email}</p>
            </div>
          </div>

          <p className="font-body text-[13px] text-text-muted">
            All reservations from <strong>{secondaryGuest.email}</strong> will move to{' '}
            <strong>{primaryGuest.email}</strong>. The duplicate guest record will be permanently deleted.
          </p>

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" size="md" onClick={() => setStep(1)} disabled={merging}>
              Back
            </Button>
            <Button variant="primary" size="md" loading={merging} onClick={handleMerge}>
              Confirm Merge
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Guest Drawer ─────────────────────────────────────────────────────────────

function GuestDrawer({ guest, onClose, onMergeStart }) {
  const { addToast } = useToast()
  const updateGuest = useUpdateGuest()
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({
    first_name: guest.first_name ?? '',
    last_name: guest.last_name ?? '',
    phone: guest.phone ?? '',
  })

  const { data: guestReservations = [], isLoading } = useQuery({
    queryKey: queryKeys.guests.reservations(guest.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('id, confirmation_number, check_in, check_out, status, total_due_cents')
        .eq('guest_id', guest.id)
        .order('check_in', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!guest.id,
  })

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
      <div className="fixed inset-0 z-[9990] bg-black opacity-30" role="presentation" onClick={onClose} />
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

          {/* Merge */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMergeStart}
            >
              <GitMerge size={14} /> Merge with another guest
            </Button>
            <p className="mt-1 font-body text-[12px] text-text-muted">
              Use this to combine duplicate guest profiles.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Column definitions ────────────────────────────────────────────────────────

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Guests() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedGuest, setSelectedGuest] = useState(null)
  const [mergeOpen, setMergeOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { data: guests = [], isLoading, refetch } = useGuests(debouncedSearch)

  function handleMerged() {
    setMergeOpen(false)
    setSelectedGuest(null)
    refetch()
  }

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
          onRowClick={(row) => setSelectedGuest(row)}
          emptyState={
            debouncedSearch ? (
              <p className="font-body text-[15px] text-text-muted py-12">
                No guests matching &quot;{debouncedSearch}&quot;
              </p>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12">
                <UserCircle size={40} weight="light" className="text-text-muted" />
                <p className="font-body text-[15px] text-text-muted">No guests yet</p>
              </div>
            )
          }
        />
      </div>

      {/* Guest Drawer */}
      {selectedGuest && !mergeOpen && (
        <GuestDrawer
          guest={selectedGuest}
          onClose={() => setSelectedGuest(null)}
          onMergeStart={() => setMergeOpen(true)}
        />
      )}

      {/* Merge Modal */}
      {mergeOpen && selectedGuest && (
        <MergeModal
          primaryGuest={selectedGuest}
          onClose={() => setMergeOpen(false)}
          onMerged={handleMerged}
        />
      )}
    </div>
  )
}
