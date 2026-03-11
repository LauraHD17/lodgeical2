// src/pages/admin/Inquiries.jsx
// Inquiry log — guest interest submissions from the booking widget.
// Mirrors the Maintenance log layout: search + status filters + table + drawer.

import { useState, useMemo } from 'react'
import { format, formatDistanceToNow, parseISO, differenceInCalendarDays } from 'date-fns'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Tray, MagnifyingGlass } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Drawer } from '@/components/ui/Drawer'
import { DataTable } from '@/components/shared/DataTable'
import { StatusChip } from '@/components/shared/StatusChip'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUSES = ['all', 'new', 'reviewed', 'contacted', 'converted', 'declined']
const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'declined', label: 'Declined' },
]
const GUEST_RANGES = ['1-2', '3-4', '5-6', '7+']

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useInquiries(propertyId, statusFilter) {
  return useQuery({
    queryKey: queryKeys.inquiries.list(propertyId, statusFilter),
    queryFn: async () => {
      if (!propertyId) return []
      let q = supabase
        .from('inquiries')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })

      if (statusFilter && statusFilter !== 'all') {
        q = q.eq('status', statusFilter)
      }
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function useRooms(propertyId) {
  return useQuery({
    queryKey: queryKeys.rooms.list(),
    queryFn: async () => {
      if (!propertyId) return []
      const { data } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .order('name')
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

// ---------------------------------------------------------------------------
// Empty form for manual add
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  guest_first_name: '',
  guest_last_name: '',
  guest_email: '',
  guest_phone: '',
  check_in: '',
  check_out: '',
  num_guests_range: '1-2',
  room_ids: [],
  notes: '',
  status: 'new',
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const COLUMNS = [
  {
    key: 'guest',
    label: 'Guest',
    render: (row) => (
      <div>
        <p className="font-body text-[14px] text-text-primary font-medium">
          {row.guest_first_name} {row.guest_last_name}
        </p>
        <p className="font-body text-[12px] text-text-muted">{row.guest_email}</p>
      </div>
    ),
  },
  {
    key: 'dates',
    label: 'Dates',
    render: (row) => (
      <span className="font-mono text-[13px] text-text-primary whitespace-nowrap">
        {format(parseISO(row.check_in), 'MMM d')} &rarr; {format(parseISO(row.check_out), 'MMM d, yyyy')}
      </span>
    ),
  },
  {
    key: 'guests',
    label: 'Guests',
    render: (row) => (
      <span className="font-body text-[13px] text-text-secondary">{row.num_guests_range}</span>
    ),
  },
  {
    key: 'submitted',
    label: 'Submitted',
    render: (row) => (
      <span className="font-body text-[13px] text-text-muted">
        {formatDistanceToNow(parseISO(row.created_at), { addSuffix: true })}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <StatusChip status={row.status} type="inquiry" />,
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Inquiries() {
  const { propertyId } = useProperty()
  const queryClient = useQueryClient()
  const { addToast } = useToast()

  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const { data: inquiries = [], isLoading } = useInquiries(propertyId, statusFilter)
  const { data: rooms = [] } = useRooms(propertyId)

  // Build a room name lookup
  const roomNameMap = useMemo(() => {
    const map = {}
    for (const r of rooms) map[r.id] = r.name
    return map
  }, [rooms])

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return inquiries
    const q = search.toLowerCase()
    return inquiries.filter(inq =>
      `${inq.guest_first_name} ${inq.guest_last_name}`.toLowerCase().includes(q) ||
      inq.guest_email.toLowerCase().includes(q)
    )
  }, [inquiries, search])

  function openDetail(row) {
    setSelected(row)
    setIsCreating(false)
    setForm({
      ...EMPTY_FORM,
      ...row,
      room_ids: row.room_ids ?? [],
    })
    setDrawerOpen(true)
  }

  function openCreate() {
    setSelected(null)
    setIsCreating(true)
    setForm(EMPTY_FORM)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setSelected(null)
    setIsCreating(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (isCreating) {
        // Manual add
        const { error } = await supabase
          .from('inquiries')
          .insert({
            property_id: propertyId,
            guest_first_name: form.guest_first_name,
            guest_last_name: form.guest_last_name,
            guest_email: form.guest_email,
            guest_phone: form.guest_phone || null,
            check_in: form.check_in,
            check_out: form.check_out,
            num_guests_range: form.num_guests_range,
            room_ids: form.room_ids.length > 0 ? form.room_ids : null,
            notes: form.notes || null,
            status: form.status,
          })
        if (error) throw error
        addToast({ message: 'Inquiry added', variant: 'success' })
      } else {
        // Update status (and notes)
        const { error } = await supabase
          .from('inquiries')
          .update({
            status: form.status,
            notes: form.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selected.id)
        if (error) throw error
        addToast({ message: 'Inquiry updated', variant: 'success' })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.inquiries.all })
      closeDrawer()
    } catch (err) {
      addToast({ message: err.message || 'Save failed', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  function updateForm(key, value) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleRoomId(roomId) {
    setForm(prev => {
      const ids = prev.room_ids.includes(roomId)
        ? prev.room_ids.filter(id => id !== roomId)
        : [...prev.room_ids, roomId]
      return { ...prev, room_ids: ids }
    })
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-[24px] sm:text-[32px] text-text-primary uppercase">Inquiries</h1>
        <Button variant="primary" size="md" onClick={openCreate}>
          <Plus size={16} weight="bold" className="mr-1" />
          Add Inquiry
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlass size={14} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full h-11 border-[1.5px] border-border rounded-[6px] pl-9 pr-3 font-body text-[14px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
          />
        </div>

        {/* Status chips */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-full font-body text-[12px] font-semibold capitalize border transition-colors',
                statusFilter === s
                  ? 'bg-text-primary text-white border-text-primary'
                  : 'bg-surface-raised text-text-secondary border-border hover:border-text-muted'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        data={filtered}
        loading={isLoading}
        onRowClick={openDetail}
        emptyState={
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Tray size={18} weight="fill" className="text-text-muted" />
            <h3 className="font-body font-semibold text-[18px] text-text-primary mt-4">No inquiries yet</h3>
            <p className="font-body text-[15px] text-text-secondary mt-2 max-w-sm">
              When guests send inquiries from your booking widget, they&apos;ll appear here.
            </p>
          </div>
        }
      />

      {/* Drawer — detail or create */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={isCreating ? 'Add Inquiry' : `${form.guest_first_name} ${form.guest_last_name}`}
      >
        <div className="space-y-5">
          {/* Guest info */}
          {isCreating ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="First name"
                  value={form.guest_first_name}
                  onChange={e => updateForm('guest_first_name', e.target.value)}
                />
                <Input
                  label="Last name"
                  value={form.guest_last_name}
                  onChange={e => updateForm('guest_last_name', e.target.value)}
                />
              </div>
              <Input
                label="Email"
                type="email"
                value={form.guest_email}
                onChange={e => updateForm('guest_email', e.target.value)}
              />
              <Input
                label="Phone"
                value={form.guest_phone}
                onChange={e => updateForm('guest_phone', e.target.value)}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Check-in"
                  type="date"
                  value={form.check_in}
                  onChange={e => updateForm('check_in', e.target.value)}
                />
                <Input
                  label="Check-out"
                  type="date"
                  value={form.check_out}
                  onChange={e => updateForm('check_out', e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                  Contact
                </p>
                <p className="font-body text-[15px] text-text-primary">{form.guest_email}</p>
                {form.guest_phone && (
                  <p className="font-body text-[14px] text-text-secondary">{form.guest_phone}</p>
                )}
              </div>

              <div>
                <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                  Dates
                </p>
                {form.check_in && form.check_out && (
                  <p className="font-mono text-[14px] text-text-primary">
                    {format(parseISO(form.check_in), 'MMM d, yyyy')} &rarr; {format(parseISO(form.check_out), 'MMM d, yyyy')}
                    <span className="text-text-muted ml-2">
                      ({differenceInCalendarDays(parseISO(form.check_out), parseISO(form.check_in))} nights)
                    </span>
                  </p>
                )}
              </div>
            </>
          )}

          {/* Guest count */}
          {isCreating ? (
            <fieldset>
              <legend className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-2">
                Guests
              </legend>
              <div className="flex gap-2 flex-wrap">
                {GUEST_RANGES.map(range => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => updateForm('num_guests_range', range)}
                    className={cn(
                      'px-3 py-1.5 rounded-[6px] border font-body text-[13px] transition-colors',
                      form.num_guests_range === range
                        ? 'border-info bg-info-bg text-info'
                        : 'border-border bg-surface-raised text-text-secondary hover:border-text-muted'
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            <div>
              <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Guests
              </p>
              <p className="font-body text-[14px] text-text-primary">{form.num_guests_range} guests</p>
            </div>
          )}

          {/* Room interest */}
          {isCreating && rooms.length > 0 && (
            <fieldset>
              <legend className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-2">
                Room interest (optional)
              </legend>
              <div className="flex flex-col gap-1.5">
                {rooms.map(room => (
                  <label
                    key={room.id}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-[6px] border cursor-pointer font-body text-[13px] transition-colors',
                      form.room_ids.includes(room.id)
                        ? 'border-info bg-info-bg text-text-primary'
                        : 'border-border bg-surface-raised text-text-secondary hover:border-text-muted'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.room_ids.includes(room.id)}
                      onChange={() => toggleRoomId(room.id)}
                      className="accent-info w-3.5 h-3.5"
                    />
                    {room.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {!isCreating && form.room_ids && form.room_ids.length > 0 && (
            <div>
              <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Room interest
              </p>
              <p className="font-body text-[14px] text-text-primary">
                {form.room_ids.map(id => roomNameMap[id] || id).join(', ')}
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="inq-notes" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1 block">
              Notes
            </label>
            <textarea
              id="inq-notes"
              value={form.notes || ''}
              onChange={e => updateForm('notes', e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={isCreating ? 'Guest notes or context...' : 'Add internal notes...'}
              className="w-full border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-none"
            />
          </div>

          {/* Status */}
          <Select
            label="Status"
            value={form.status}
            onValueChange={v => updateForm('status', v)}
            options={STATUS_OPTIONS}
          />

          {/* Submitted timestamp (view mode only) */}
          {!isCreating && selected?.created_at && (
            <div>
              <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Submitted
              </p>
              <p className="font-mono text-[13px] text-text-muted">
                {format(parseISO(selected.created_at), 'MMM d, yyyy h:mm a')}
                {' '}({formatDistanceToNow(parseISO(selected.created_at), { addSuffix: true })})
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={saving || (isCreating && (!form.guest_first_name || !form.guest_email || !form.check_in || !form.check_out))}
              className="flex-1"
            >
              {saving ? 'Saving...' : isCreating ? 'Add Inquiry' : 'Update'}
            </Button>
            <Button variant="ghost" size="md" onClick={closeDrawer}>
              Cancel
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
