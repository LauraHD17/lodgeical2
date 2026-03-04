// src/pages/admin/Maintenance.jsx
// Maintenance log — chronological record of completed work.
// Not a ticket system. Each entry logs what was done, when, cost, and who did it.
// Optional reminder date: entries with next_reminder_date ≤ today+7 show a reminder badge.

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, addDays, isBefore, isAfter } from 'date-fns'
import {
  Plus,
  Wrench,
  Bell,
  PencilSimple,
  Trash,
  X,
  CaretDown,
  CaretUp,
} from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { useRooms } from '@/hooks/useRooms'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  'General',
  'Plumbing',
  'HVAC',
  'Electrical',
  'Cleaning',
  'Landscaping',
  'Appliances',
  'Structural',
  'Pest Control',
  'Safety',
  'Other',
]

const CATEGORY_COLORS = {
  General:       'bg-surface text-text-secondary border-border',
  Plumbing:      'bg-blue-100 text-blue-700 border-blue-200',
  HVAC:          'bg-orange-100 text-orange-700 border-orange-200',
  Electrical:    'bg-yellow-100 text-yellow-700 border-yellow-200',
  Cleaning:      'bg-green-100 text-green-700 border-green-200',
  Landscaping:   'bg-lime-100 text-lime-700 border-lime-200',
  Appliances:    'bg-purple-100 text-purple-700 border-purple-200',
  Structural:    'bg-red-100 text-red-700 border-red-200',
  'Pest Control':'bg-teal-100 text-teal-700 border-teal-200',
  Safety:        'bg-rose-100 text-rose-700 border-rose-200',
  Other:         'bg-surface text-text-secondary border-border',
}

function useMaintenanceLogs() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['maintenance_logs', propertyId],
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

function useUpsertLog() {
  const { propertyId } = useProperty()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }) => {
      if (id) {
        const { error } = await supabase
          .from('maintenance_logs')
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('maintenance_logs')
          .insert({ ...fields, property_id: propertyId })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance_logs', propertyId] }),
  })
}

function useDeleteLog() {
  const { propertyId } = useProperty()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('maintenance_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance_logs', propertyId] }),
  })
}

const EMPTY_FORM = {
  completed_date: format(new Date(), 'yyyy-MM-dd'),
  category: 'General',
  room_id: '',
  description: '',
  performed_by: '',
  cost_cents: '',
  next_reminder_date: '',
  notes: '',
}

function LogModal({ open, onClose, log, rooms }) {
  const upsert = useUpsertLog()
  const { addToast } = useToast()
  const [form, setForm] = useState(() =>
    log
      ? {
          ...log,
          cost_cents: log.cost_cents != null ? String(log.cost_cents / 100) : '',
          room_id: log.room_id ?? '',
          next_reminder_date: log.next_reminder_date ?? '',
        }
      : { ...EMPTY_FORM }
  )
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.description.trim()) e.description = 'Description is required'
    if (!form.completed_date) e.completed_date = 'Date is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    const payload = {
      ...form,
      room_id: form.room_id || null,
      cost_cents: form.cost_cents ? Math.round(Number(form.cost_cents) * 100) : null,
      next_reminder_date: form.next_reminder_date || null,
    }
    if (log) payload.id = log.id
    try {
      await upsert.mutateAsync(payload)
      addToast({ message: log ? 'Log entry updated' : 'Log entry added', variant: 'success' })
      onClose()
    } catch {
      addToast({ message: 'Failed to save log entry', variant: 'error' })
    }
  }

  const roomOptions = [
    { value: '', label: 'Property-wide (no specific room)' },
    ...rooms.map(r => ({ value: r.id, label: r.name })),
  ]

  return (
    <Modal open={open} onClose={onClose} title={log ? 'Edit Log Entry' : 'Add Log Entry'}>
      <div className="flex flex-col gap-4">
        <Input
          label="Date Completed"
          type="date"
          value={form.completed_date}
          onChange={e => setForm(f => ({ ...f, completed_date: e.target.value }))}
          error={errors.completed_date}
        />
        <Select
          label="Category"
          options={CATEGORIES.map(c => ({ value: c, label: c }))}
          value={form.category}
          onValueChange={v => setForm(f => ({ ...f, category: v }))}
        />
        <Select
          label="Room (optional)"
          options={roomOptions}
          value={form.room_id}
          onValueChange={v => setForm(f => ({ ...f, room_id: v }))}
        />
        <div className="flex flex-col">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
            Description *
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What was done?"
            className={cn(
              'border-[1.5px] rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised resize-none focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2',
              errors.description ? 'border-danger' : 'border-border'
            )}
          />
          {errors.description && <span className="mt-1 text-danger text-[13px]">{errors.description}</span>}
        </div>
        <Input
          label="Performed By (optional)"
          value={form.performed_by}
          onChange={e => setForm(f => ({ ...f, performed_by: e.target.value }))}
          placeholder="Contractor name or 'Self'"
        />
        <div className="flex flex-col">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
            Cost (optional, $)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">$</span>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.cost_cents}
              onChange={e => setForm(f => ({ ...f, cost_cents: e.target.value }))}
              placeholder="0.00"
              className="h-11 border-[1.5px] border-border rounded-[6px] pl-7 pr-3 font-mono text-[15px] text-text-primary bg-surface-raised w-full focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
            />
          </div>
        </div>
        <Input
          label="Next Reminder Date (optional)"
          type="date"
          value={form.next_reminder_date}
          onChange={e => setForm(f => ({ ...f, next_reminder_date: e.target.value }))}
        />
        <div className="flex flex-col">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
            Notes (optional)
          </label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Any additional context..."
            className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised resize-none focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
          />
        </div>
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="secondary" size="md" onClick={onClose} disabled={upsert.isPending}>Cancel</Button>
          <Button variant="primary" size="md" loading={upsert.isPending} onClick={handleSave}>
            {log ? 'Save Changes' : 'Add Entry'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function LogCard({ log, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const colorClass = CATEGORY_COLORS[log.category] ?? CATEGORY_COLORS.Other

  const hasReminder = !!log.next_reminder_date
  const today = new Date()
  const soonThreshold = addDays(today, 7)
  const reminderDate = hasReminder ? parseISO(log.next_reminder_date) : null
  const isReminderSoon = reminderDate && !isAfter(reminderDate, soonThreshold)
  const isReminderPast = reminderDate && isBefore(reminderDate, today)

  return (
    <div className={cn(
      'bg-surface border rounded-[8px] p-4 flex flex-col gap-3 transition-colors',
      isReminderSoon ? 'border-warning' : 'border-border'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-mono text-[13px] text-text-muted">{log.completed_date}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-semibold border', colorClass)}>
              {log.category}
            </span>
            {log.rooms?.name && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-body border border-border bg-surface-raised text-text-secondary">
                {log.rooms.name}
              </span>
            )}
          </div>
          <p className="font-body text-[15px] text-text-primary">{log.description}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {log.performed_by && (
              <span className="font-body text-[13px] text-text-muted">
                By: <span className="text-text-secondary">{log.performed_by}</span>
              </span>
            )}
            {log.cost_cents != null && (
              <span className="font-mono text-[13px] text-text-secondary">
                Cost: ${(log.cost_cents / 100).toFixed(2)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(log)}
            className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-border transition-colors"
            title="Edit"
          >
            <PencilSimple size={14} />
          </button>
          <button
            onClick={() => onDelete(log)}
            className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger-bg transition-colors"
            title="Delete"
          >
            <Trash size={14} />
          </button>
        </div>
      </div>

      {/* Reminder badge */}
      {hasReminder && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-[6px] text-[13px] font-body',
          isReminderPast ? 'bg-danger-bg text-danger' : isReminderSoon ? 'bg-warning-bg text-warning' : 'bg-info-bg text-info'
        )}>
          <Bell size={14} className="shrink-0" />
          <span>
            {isReminderPast ? 'Reminder overdue: ' : 'Next reminder: '}
            <span className="font-mono">{log.next_reminder_date}</span>
          </span>
        </div>
      )}

      {/* Expandable notes */}
      {log.notes && (
        <div>
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 font-body text-[13px] text-text-muted hover:text-text-primary transition-colors"
          >
            {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
            {expanded ? 'Hide notes' : 'Show notes'}
          </button>
          {expanded && (
            <p className="mt-2 font-body text-[13px] text-text-secondary whitespace-pre-wrap">
              {log.notes}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Maintenance() {
  const { data: logs = [], isLoading } = useMaintenanceLogs()
  const { data: rooms = [] } = useRooms()
  const deleteLog = useDeleteLog()
  const { addToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editLog, setEditLog] = useState(null)
  const [filterCategory, setFilterCategory] = useState('All')

  const today = new Date()
  const soonThreshold = addDays(today, 7)

  const upcomingReminders = useMemo(() =>
    logs.filter(l => {
      if (!l.next_reminder_date) return false
      const d = parseISO(l.next_reminder_date)
      return !isAfter(d, soonThreshold)
    }).length,
    [logs, soonThreshold]
  )

  const categories = ['All', ...CATEGORIES]
  const filtered = filterCategory === 'All'
    ? logs
    : logs.filter(l => l.category === filterCategory)

  async function handleDelete(log) {
    if (!confirm('Delete this log entry?')) return
    try {
      await deleteLog.mutateAsync(log.id)
      addToast({ message: 'Entry deleted', variant: 'success' })
    } catch {
      addToast({ message: 'Failed to delete entry', variant: 'error' })
    }
  }

  function handleEdit(log) {
    setEditLog(log)
    setModalOpen(true)
  }

  function handleClose() {
    setModalOpen(false)
    setEditLog(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-[32px] text-text-primary">Maintenance Log</h1>
            {upcomingReminders > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-warning-bg text-warning border border-warning rounded-full font-body text-[12px] font-semibold">
                <Bell size={12} />
                {upcomingReminders} reminder{upcomingReminders > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="font-body text-[14px] text-text-muted mt-0.5">
            Chronological record of completed work. Add entries as tasks are done.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
          <Plus size={16} weight="bold" /> Add Entry
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={cn(
              'px-3 py-1.5 rounded-full font-body text-[13px] border transition-colors',
              filterCategory === cat
                ? 'bg-text-primary text-white border-text-primary'
                : 'border-border text-text-secondary hover:bg-border hover:text-text-primary'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Log entries */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-border rounded-[8px] h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <Wrench size={40} className="text-text-muted" />
          <p className="font-body text-[16px] text-text-muted">
            {filterCategory === 'All' ? 'No maintenance entries yet' : `No ${filterCategory} entries`}
          </p>
          <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
            <Plus size={16} weight="bold" /> Add first entry
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(log => (
            <LogCard
              key={log.id}
              log={log}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <LogModal
        open={modalOpen}
        onClose={handleClose}
        log={editLog}
        rooms={rooms}
      />
    </div>
  )
}
