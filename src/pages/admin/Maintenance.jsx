// src/pages/admin/Maintenance.jsx
// Maintenance log — chronological record of completed work, with optional reminders.
// Uses maintenance_logs table (not the old tickets/ticket-system).

import { useState, useMemo } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Bell, Wrench, CheckCircle, X, CaretDown, CaretUp,
} from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/components/ui/useToast'
import { cn, dollars } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_CATEGORIES = [
  'General', 'Plumbing', 'Electrical', 'HVAC', 'Appliance',
  'Cleaning', 'Painting', 'Landscaping', 'Pest Control', 'Safety', 'Other',
]

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useMaintenanceLogs() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['maintenance-logs', propertyId],
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select('*, rooms(name)')
        .eq('property_id', propertyId)
        .order('completed_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function useRooms() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['rooms-list', propertyId],
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
// Reminder badge chip
// ---------------------------------------------------------------------------

function ReminderBadge({ date }) {
  const today = new Date()
  const reminderDate = parseISO(date)
  const isPast = reminderDate < today
  const isSoon = !isPast && reminderDate <= addDays(today, 7)

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border',
      isPast
        ? 'bg-danger-bg text-danger border-danger'
        : isSoon
          ? 'bg-warning-bg text-warning border-warning'
          : 'bg-surface text-text-muted border-border',
    )}>
      <Bell size={10} weight="fill" />
      {format(reminderDate, 'MMM d, yyyy')}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Log form (new / edit)
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  completed_date: format(new Date(), 'yyyy-MM-dd'),
  category: 'General',
  description: '',
  performed_by: '',
  cost_display: '',
  next_reminder_date: '',
  notes: '',
  room_id: '',
}

function LogForm({ log, rooms, onClose }) {
  const { propertyId } = useProperty()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [form, setForm] = useState(log
    ? {
        completed_date:    log.completed_date ?? '',
        category:          log.category ?? 'General',
        description:       log.description ?? '',
        performed_by:      log.performed_by ?? '',
        cost_display:      log.cost_cents != null ? String(log.cost_cents / 100) : '',
        next_reminder_date: log.next_reminder_date ?? '',
        notes:             log.notes ?? '',
        room_id:           log.room_id ?? '',
      }
    : EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.description.trim()) {
      toast({ title: 'Description required', variant: 'error' })
      return
    }
    setSaving(true)
    const cost = form.cost_display ? Math.round(parseFloat(form.cost_display) * 100) : null
    const payload = {
      property_id:        propertyId,
      completed_date:     form.completed_date,
      category:           form.category,
      description:        form.description.trim(),
      performed_by:       form.performed_by.trim() || null,
      cost_cents:         isNaN(cost) ? null : cost,
      next_reminder_date: form.next_reminder_date || null,
      notes:              form.notes.trim() || null,
      room_id:            form.room_id || null,
    }
    let error
    if (log?.id) {
      ;({ error } = await supabase.from('maintenance_logs').update(payload).eq('id', log.id))
    } else {
      ;({ error } = await supabase.from('maintenance_logs').insert(payload))
    }
    setSaving(false)
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'error' }); return }
    toast({ title: log?.id ? 'Log entry updated' : 'Work logged' })
    qc.invalidateQueries({ queryKey: ['maintenance-logs'] })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-body text-[12px] text-text-muted font-semibold uppercase tracking-wider">Date completed *</span>
          <Input type="date" value={form.completed_date} onChange={e => set('completed_date', e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-body text-[12px] text-text-muted font-semibold uppercase tracking-wider">Category</span>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            {LOG_CATEGORIES.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
          </Select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-body text-[12px] text-text-muted font-semibold uppercase tracking-wider">What was done *</span>
        <textarea
          rows={3}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Describe the work completed…"
          required
          className="rounded-[6px] border border-border bg-surface px-3 py-2 font-body text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info resize-none"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-body text-[12px] text-text-muted font-semibold uppercase tracking-wider">Room (optional)</span>
          <Select value={form.room_id} onValueChange={v => set('room_id', v)}>
            <Select.Option value="">All / Common area</Select.Option>
            {rooms.map(r => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-body text-[12px] text-text-muted font-semibold uppercase tracking-wider">Performed by</span>
          <Input value={form.performed_by} onChange={e => set('performed_by', e.target.value)} placeholder="Name or company" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-body text-[12px] text-text-muted font-semibold uppercase tracking-wider">Cost ($)</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.cost_display}
            onChange={e => set('cost_display', e.target.value)}
            placeholder="0.00"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-body text-[12px] text-text-muted font-semibold uppercase tracking-wider">Remind me on</span>
          <Input type="date" value={form.next_reminder_date} onChange={e => set('next_reminder_date', e.target.value)} />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-body text-[12px] text-text-muted font-semibold uppercase tracking-wider">Notes</span>
        <textarea
          rows={2}
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Anything else to record…"
          className="rounded-[6px] border border-border bg-surface px-3 py-2 font-body text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info resize-none"
        />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save entry'}
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Log row card
// ---------------------------------------------------------------------------

function LogRow({ log, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-surface-raised border border-border rounded-[8px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <CheckCircle size={16} weight="fill" className="text-success mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-body text-[13px] text-text-primary font-medium">{log.description}</span>
              <span className="font-mono text-[11px] text-text-muted bg-surface border border-border px-1.5 py-0.5 rounded-full">
                {log.category}
              </span>
              {log.rooms?.name && (
                <span className="font-mono text-[11px] text-info bg-info-bg border border-info/30 px-1.5 py-0.5 rounded-full">
                  {log.rooms.name}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[12px] text-text-muted">
                {format(parseISO(log.completed_date), 'MMM d, yyyy')}
              </span>
              {log.performed_by && (
                <span className="font-body text-[12px] text-text-secondary">by {log.performed_by}</span>
              )}
              {log.cost_cents != null && log.cost_cents > 0 && (
                <span className="font-mono text-[12px] text-text-secondary">{dollars(log.cost_cents)}</span>
              )}
              {log.next_reminder_date && <ReminderBadge date={log.next_reminder_date} />}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {log.notes && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-[4px] text-text-muted hover:text-text-primary hover:bg-border transition-colors"
              title="Show notes"
            >
              {expanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
            </button>
          )}
          <button
            onClick={() => onEdit(log)}
            className="p-1.5 rounded-[4px] text-text-muted hover:text-text-primary hover:bg-border transition-colors font-body text-[12px]"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(log.id)}
            className="p-1.5 rounded-[4px] text-text-muted hover:text-danger hover:bg-danger-bg transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {expanded && log.notes && (
        <p className="mt-2 pl-7 font-body text-[13px] text-text-secondary border-t border-border pt-2">
          {log.notes}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Maintenance() {
  const { propertyId } = useProperty()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data: logs = [], isLoading } = useMaintenanceLogs()
  const { data: rooms = [] } = useRooms()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingLog, setEditingLog] = useState(null)
  const [filterRoom, setFilterRoom] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  // Upcoming reminders (within 7 days or overdue)
  const upcomingReminders = useMemo(() => {
    const limit = addDays(new Date(), 7)
    return logs.filter(l => l.next_reminder_date && parseISO(l.next_reminder_date) <= limit)
  }, [logs])

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterRoom && l.room_id !== filterRoom) return false
      if (filterCategory && l.category !== filterCategory) return false
      return true
    })
  }, [logs, filterRoom, filterCategory])

  async function handleDelete(id) {
    if (!confirm('Delete this log entry?')) return
    const { error } = await supabase.from('maintenance_logs').delete().eq('id', id)
    if (error) { toast({ title: 'Delete failed', variant: 'error' }); return }
    toast({ title: 'Entry deleted' })
    qc.invalidateQueries({ queryKey: ['maintenance-logs', propertyId] })
  }

  function openNew() { setEditingLog(null); setDrawerOpen(true) }
  function openEdit(log) { setEditingLog(log); setDrawerOpen(true) }
  function closeDrawer() { setDrawerOpen(false); setEditingLog(null) }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-[32px] text-text-primary">Maintenance Log</h1>
          <p className="font-body text-[14px] text-text-secondary mt-1">
            Track completed work, repairs, and recurring tasks.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={openNew}>
          <Plus size={16} weight="bold" /> Log work
        </Button>
      </div>

      {/* Reminders banner */}
      {upcomingReminders.length > 0 && (
        <div className="bg-warning-bg border border-warning rounded-[8px] p-4 flex items-start gap-3">
          <Bell size={18} weight="fill" className="text-warning mt-0.5 shrink-0" />
          <div>
            <p className="font-body text-[14px] text-warning font-semibold mb-1">
              {upcomingReminders.length} reminder{upcomingReminders.length !== 1 ? 's' : ''} due soon
            </p>
            <ul className="flex flex-col gap-0.5">
              {upcomingReminders.map(l => (
                <li key={l.id} className="font-body text-[13px] text-text-primary flex items-center gap-2">
                  <span>{l.description}</span>
                  <ReminderBadge date={l.next_reminder_date} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterRoom} onValueChange={setFilterRoom} className="w-44">
          <Select.Option value="">All rooms</Select.Option>
          {rooms.map(r => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory} className="w-44">
          <Select.Option value="">All categories</Select.Option>
          {LOG_CATEGORIES.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}
        </Select>
        {(filterRoom || filterCategory) && (
          <button
            onClick={() => { setFilterRoom(''); setFilterCategory('') }}
            className="font-body text-[13px] text-text-muted hover:text-text-primary underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-[8px] bg-border animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Wrench size={32} weight="thin" className="text-text-muted" />
          <p className="font-body text-[15px] text-text-muted">
            {logs.length === 0
              ? 'No maintenance entries yet. Log your first completed task.'
              : 'No entries match your filters.'}
          </p>
          {logs.length === 0 && (
            <Button variant="secondary" onClick={openNew}>Log work</Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(log => (
            <LogRow key={log.id} log={log} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Drawer */}
      <Drawer open={drawerOpen} onClose={closeDrawer} title={editingLog ? 'Edit log entry' : 'Log completed work'}>
        <LogForm log={editingLog} rooms={rooms} onClose={closeDrawer} />
      </Drawer>
    </div>
  )
}
