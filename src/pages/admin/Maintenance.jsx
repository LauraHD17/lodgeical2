// src/pages/admin/Maintenance.jsx
// Internal tool for logging room problems, repairs, and cleaning tasks.

import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, WarningCircle, ArrowCounterClockwise } from '@phosphor-icons/react'
import * as Switch from '@radix-ui/react-switch'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_COLORS = {
  urgent:  { bg: 'bg-danger-bg',  text: 'text-danger',         border: 'border-danger' },
  high:    { bg: 'bg-warning-bg', text: 'text-warning',        border: 'border-warning' },
  medium:  { bg: 'bg-info-bg',    text: 'text-info',           border: 'border-info' },
  low:     { bg: 'bg-surface',    text: 'text-text-secondary', border: 'border-border' },
}

const CATEGORIES = ['Plumbing','Electrical','HVAC','Cleaning','Furniture','Appliance','Exterior','Other']
const PRIORITIES = ['urgent','high','medium','low']
const STATUSES   = ['open','in_progress','resolved']

const STATUS_LABELS = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved' }

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useMaintenanceTickets(filters) {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: queryKeys.maintenance.list(propertyId, filters),
    queryFn: async () => {
      if (!propertyId) return []
      let q = supabase
        .from('maintenance_tickets')
        .select('*, rooms(id,name), contacts(id,first_name,last_name,role)')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })

      if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status)
      if (filters.priority && filters.priority !== 'all') q = q.eq('priority', filters.priority)
      if (filters.room_id) q = q.eq('room_id', filters.room_id)
      if (filters.category && filters.category !== 'all') q = q.eq('category', filters.category)

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function useRooms() {
  const { propertyId } = useProperty()
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

function useStaffContacts() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: queryKeys.contacts.staff(propertyId),
    queryFn: async () => {
      if (!propertyId) return []
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, role')
        .eq('property_id', propertyId)
        .eq('type', 'staff')
        .eq('is_active', true)
        .order('first_name')
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

// ---------------------------------------------------------------------------
// Priority chip
// ---------------------------------------------------------------------------

function PriorityChip({ priority }) {
  const c = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.low
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full font-body text-[12px] font-semibold capitalize border',
      c.bg, c.text, c.border
    )}>
      {priority}
    </span>
  )
}

function StatusChip({ status }) {
  const colorMap = {
    open:        'bg-warning-bg text-warning border-warning',
    in_progress: 'bg-info-bg text-info border-info',
    resolved:    'bg-success-bg text-success border-success',
  }
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full font-body text-[12px] font-semibold border',
      colorMap[status] ?? 'bg-surface text-text-secondary border-border'
    )}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Ticket Drawer
// ---------------------------------------------------------------------------

const EMPTY_TICKET = {
  room_id: '', title: '', description: '', category: 'Other',
  priority: 'medium', status: 'open', assigned_to: '', blocks_booking: false,
}

function TicketDrawer({ ticket, rooms, staff, onClose: _onClose, onSaved }) {
  const { propertyId } = useProperty()
  const { addToast } = useToast()
  const isEdit = !!ticket?.id
  const [form, setForm] = useState(() => ticket
    ? {
        room_id:       ticket.room_id ?? '',
        title:         ticket.title ?? '',
        description:   ticket.description ?? '',
        category:      ticket.category ?? 'Other',
        priority:      ticket.priority ?? 'medium',
        status:        ticket.status ?? 'open',
        assigned_to:   ticket.assigned_to ?? '',
        blocks_booking: ticket.blocks_booking ?? false,
      }
    : EMPTY_TICKET
  )
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.room_id) { addToast({ message: 'Please select a room', variant: 'error' }); return }
    if (!form.title.trim()) { addToast({ message: 'Title is required', variant: 'error' }); return }

    setSaving(true)
    const payload = {
      property_id:    propertyId,
      room_id:        form.room_id,
      title:          form.title.trim(),
      description:    form.description.trim() || null,
      category:       form.category,
      priority:       form.priority,
      status:         form.status,
      assigned_to:    form.assigned_to || null,
      blocks_booking: form.blocks_booking,
      ...(form.status === 'resolved' && !ticket?.resolved_at ? { resolved_at: new Date().toISOString() } : {}),
      ...(form.status !== 'resolved' ? { resolved_at: null } : {}),
    }

    try {
      let error
      if (isEdit) {
        ;({ error } = await supabase.from('maintenance_tickets').update(payload).eq('id', ticket.id))
      } else {
        ;({ error } = await supabase.from('maintenance_tickets').insert(payload))
      }
      if (error) throw error
      addToast({ message: isEdit ? 'Ticket updated' : 'Ticket created', variant: 'success' })
      onSaved()
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to save ticket', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleReopen() {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('maintenance_tickets')
        .update({ status: 'open', resolved_at: null })
        .eq('id', ticket.id)
      if (error) throw error
      addToast({ message: 'Ticket reopened', variant: 'success' })
      onSaved()
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to reopen ticket', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const roomOptions = rooms.map(r => ({ value: r.id, label: r.name }))
  const staffOptions = [
    { value: '', label: 'Unassigned' },
    ...staff.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}${s.role ? ` — ${s.role}` : ''}` })),
  ]
  const categoryOptions = CATEGORIES.map(c => ({ value: c, label: c }))
  const statusOptions = STATUSES.map(s => ({ value: s, label: STATUS_LABELS[s] }))

  return (
    <div className="flex flex-col gap-5">
      <Select
        label="Room"
        options={roomOptions}
        value={form.room_id}
        onValueChange={v => set('room_id', v)}
        placeholder="Select a room"
      />

      <div className="flex flex-col gap-1">
        <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
          Title <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="What's the issue? e.g., Shower drain is slow."
          className="h-11 border-[1.5px] border-border rounded-[6px] px-3 font-body text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Any extra details that will help whoever fixes it."
          rows={3}
          className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-none"
        />
      </div>

      <Select
        label="Category"
        options={categoryOptions}
        value={form.category}
        onValueChange={v => set('category', v)}
      />

      {/* Priority pills */}
      <div className="flex flex-col gap-2">
        <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
          Priority
        </label>
        <div className="flex gap-2 flex-wrap">
          {PRIORITIES.map(p => {
            const c = PRIORITY_COLORS[p]
            const selected = form.priority === p
            return (
              <button
                key={p}
                onClick={() => set('priority', p)}
                className={cn(
                  'px-3 py-1.5 rounded-[6px] font-body text-[13px] capitalize border transition-colors',
                  selected ? cn(c.bg, c.text, c.border) : 'bg-surface border-border text-text-secondary hover:bg-border'
                )}
              >
                {p}
              </button>
            )
          })}
        </div>
      </div>

      {isEdit && (
        <Select
          label="Status"
          options={statusOptions}
          value={form.status}
          onValueChange={v => set('status', v)}
        />
      )}

      <Select
        label="Assigned To"
        options={staffOptions}
        value={form.assigned_to}
        onValueChange={v => set('assigned_to', v)}
      />

      {/* Block booking toggle */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Switch.Root
            checked={form.blocks_booking}
            onCheckedChange={v => set('blocks_booking', v)}
            className={cn(
              'w-10 h-6 rounded-full transition-colors shrink-0',
              form.blocks_booking ? 'bg-danger' : 'bg-border'
            )}
          >
            <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
          </Switch.Root>
          <label className="font-body text-[14px] text-text-secondary">
            Block this room from new bookings
          </label>
        </div>
        {form.blocks_booking && (
          <p className="font-body text-[12px] text-danger flex items-start gap-1.5">
            <WarningCircle size={14} className="mt-0.5 shrink-0" />
            Guests won't be able to book this room until you turn this off.
          </p>
        )}
      </div>

      <div className="pt-2 flex flex-col gap-3">
        <Button variant="primary" size="md" loading={saving} onClick={handleSave} className="w-full justify-center">
          {isEdit ? 'Save Changes' : 'Create Ticket'}
        </Button>

        {isEdit && ticket?.status === 'resolved' && (
          <button
            onClick={handleReopen}
            disabled={saving}
            className="flex items-center justify-center gap-2 font-body text-[14px] text-info hover:underline"
          >
            <ArrowCounterClockwise size={14} /> Reopen Ticket
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

function FilterBar({ filters, setFilters, rooms }) {
  const roomOptions = [
    { value: '', label: 'All Rooms' },
    ...rooms.map(r => ({ value: r.id, label: r.name })),
  ]
  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...CATEGORIES.map(c => ({ value: c, label: c })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Status pills */}
      <div className="flex gap-1">
        {['all', ...STATUSES].map(s => (
          <button
            key={s}
            onClick={() => setFilters(f => ({ ...f, status: s }))}
            className={cn(
              'px-3 py-1.5 rounded-full font-body text-[13px] border transition-colors',
              filters.status === s
                ? 'bg-text-primary text-white border-text-primary'
                : 'bg-surface border-border text-text-secondary hover:bg-border'
            )}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <Select
        options={[{ value: 'all', label: 'All Priorities' }, ...PRIORITIES.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))]}
        value={filters.priority}
        onValueChange={v => setFilters(f => ({ ...f, priority: v }))}
      />

      <Select
        options={roomOptions}
        value={filters.room_id}
        onValueChange={v => setFilters(f => ({ ...f, room_id: v }))}
      />

      <Select
        options={categoryOptions}
        value={filters.category}
        onValueChange={v => setFilters(f => ({ ...f, category: v }))}
      />

      <input
        type="search"
        placeholder="Search tickets…"
        value={filters.search}
        onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
        className="h-9 border border-border rounded-[6px] px-3 font-body text-[14px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1 min-w-[180px]"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const COLUMNS = [
  {
    key: 'priority',
    label: 'Priority',
    render: (val) => <PriorityChip priority={val} />,
  },
  {
    key: 'title',
    label: 'Issue',
    render: (val, row) => (
      <div>
        <p className="font-body text-[14px] text-text-primary">{val}</p>
        {row.rooms?.name && (
          <p className="font-body text-[12px] text-text-muted">{row.rooms.name}</p>
        )}
      </div>
    ),
  },
  {
    key: 'category',
    label: 'Category',
    render: (val) => <span className="font-body text-[14px] text-text-secondary">{val}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    render: (val) => <StatusChip status={val} />,
  },
  {
    key: 'assigned_to',
    label: 'Assigned To',
    render: (_, row) => {
      const c = row.contacts
      if (!c) return <span className="text-text-muted font-body text-[14px]">—</span>
      return <span className="font-body text-[14px]">{c.first_name} {c.last_name}</span>
    },
  },
  {
    key: 'created_at',
    label: 'Opened',
    render: (val) => (
      <span className="font-mono text-[13px] text-text-secondary">
        {val ? format(parseISO(val), 'MMM d, yyyy') : '—'}
      </span>
    ),
  },
]

export default function Maintenance() {
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState({
    status: 'all', priority: 'all', room_id: '', category: 'all', search: '',
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTicket, setEditingTicket] = useState(null)

  const { data: tickets = [], isLoading } = useMaintenanceTickets(filters)
  const { data: rooms = [] } = useRooms()
  const { data: staff = [] } = useStaffContacts()

  const filteredTickets = useMemo(() => {
    if (!filters.search) return tickets
    const q = filters.search.toLowerCase()
    return tickets.filter(t =>
      t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
    )
  }, [tickets, filters.search])

  function openNew() {
    setEditingTicket(null)
    setDrawerOpen(true)
  }

  function openEdit(ticket) {
    setEditingTicket(ticket)
    setDrawerOpen(true)
  }

  function handleSaved() {
    setDrawerOpen(false)
    queryClient.invalidateQueries({ queryKey: queryKeys.maintenance.all })
  }

  const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved').length
  const openCount   = tickets.filter(t => t.status !== 'resolved').length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-[32px] text-text-primary">Maintenance</h1>
          {openCount > 0 && (
            <span className="font-body text-[13px] bg-warning-bg text-warning border border-warning px-2.5 py-0.5 rounded-full">
              {openCount} open
            </span>
          )}
          {urgentCount > 0 && (
            <span className="font-body text-[13px] bg-danger-bg text-danger border border-danger px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <WarningCircle size={12} weight="fill" /> {urgentCount} urgent
            </span>
          )}
        </div>
        <Button variant="primary" size="md" onClick={openNew}>
          <Plus size={16} weight="bold" /> New Ticket
        </Button>
      </div>

      {/* Filter bar */}
      <FilterBar filters={filters} setFilters={setFilters} rooms={rooms} />

      {/* Ticket list */}
      <div className="border border-border rounded-[8px] overflow-hidden">
        <DataTable
          columns={COLUMNS}
          data={filteredTickets}
          loading={isLoading}
          onRowClick={openEdit}
          emptyState={
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="font-body text-[15px] text-text-muted">No maintenance tickets</p>
              <Button variant="primary" size="sm" onClick={openNew}>
                <Plus size={14} weight="bold" /> Log first issue
              </Button>
            </div>
          }
        />
      </div>

      {/* Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingTicket ? 'Edit Ticket' : 'New Maintenance Ticket'}
      >
        <TicketDrawer
          key={editingTicket?.id ?? 'new'}
          ticket={editingTicket}
          rooms={rooms}
          staff={staff}
          onClose={() => setDrawerOpen(false)}
          onSaved={handleSaved}
        />
      </Drawer>
    </div>
  )
}
