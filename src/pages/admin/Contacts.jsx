// src/pages/admin/Contacts.jsx
// Admin Contacts — important vendor / service provider information for staff.
// Examples: plumber, insurance contact, alarm company, internet provider.
// Staff management lives in Settings > Team.

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Switch from '@radix-ui/react-switch'
import {
  Plus, Phone, EnvelopeSimple, AddressBook, Copy, Check,
} from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VENDOR_CATEGORIES = [
  'Emergency Contact',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Insurance',
  'Alarm / Security',
  'Internet / Cable',
  'Cleaning',
  'Landscaping',
  'Pest Control',
  'Other',
]

const CATEGORY_COLORS = {
  'Emergency Contact': 'bg-danger-bg text-danger',
  'Plumbing':          'bg-info-bg text-info',
  'Electrical':        'bg-warning-bg text-warning',
  'HVAC':              'bg-danger-bg text-danger',
  'Insurance':         'bg-success-bg text-success',
  'Alarm / Security':  'bg-warning-bg text-warning',
  'Internet / Cable':  'bg-info-bg text-info',
  'Cleaning':          'bg-success-bg text-success',
  'Landscaping':       'bg-success-bg text-success',
  'Pest Control':      'bg-warning-bg text-warning',
  'Other':             'bg-surface text-text-secondary',
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useContacts() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: queryKeys.contacts.list(propertyId, 'vendor'),
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('property_id', propertyId)
        .eq('type', 'vendor')
        .order('category')
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy(e) {
    e.stopPropagation()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
      title="Copy"
    >
      {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Vendor card
// ---------------------------------------------------------------------------

function VendorCard({ contact, onEdit }) {
  const catColor = CATEGORY_COLORS[contact.category] ?? CATEGORY_COLORS.Other
  return (
    <button
      type="button"
      className={cn(
        'bg-surface-raised border border-border rounded-[8px] p-5 flex flex-col gap-3 cursor-pointer text-left w-full',
        !contact.is_active && 'opacity-60'
      )}
      onClick={() => onEdit(contact)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-body font-semibold text-[15px] text-text-primary truncate">
            {contact.first_name} {contact.last_name}
          </p>
          {contact.company && (
            <p className="font-body text-[13px] text-text-secondary truncate">{contact.company}</p>
          )}
        </div>
        {!contact.is_active && (
          <span className="font-body text-[11px] bg-border text-text-muted px-2 py-0.5 rounded-full shrink-0">
            Inactive
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {contact.category && (
          <span className={cn('font-body text-[12px] px-2.5 py-0.5 rounded-full font-medium', catColor)}>
            {contact.category}
          </span>
        )}
        {contact.role && (
          <span className="font-body text-[12px] text-text-muted">{contact.role}</span>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1 border-t border-border flex-wrap">
        {contact.phone && (
          <div className="flex items-center gap-1">
            <a
              href={`tel:${contact.phone}`}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 font-body text-[13px] text-info hover:underline"
            >
              <Phone size={13} /> {contact.phone}
            </a>
            <CopyButton text={contact.phone} />
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-1 min-w-0">
            <a
              href={`mailto:${contact.email}`}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 font-body text-[13px] text-info hover:underline truncate"
            >
              <EnvelopeSimple size={13} /> {contact.email}
            </a>
            <CopyButton text={contact.email} />
          </div>
        )}
        {!contact.phone && !contact.email && (
          <span className="font-body text-[13px] text-text-muted">No contact info</span>
        )}
      </div>

      {contact.notes && (
        <p className="font-body text-[12px] text-text-muted border-t border-border pt-2 line-clamp-2">
          {contact.notes}
        </p>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Contact drawer form
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  first_name: '', last_name: '', company: '', category: 'Other',
  role: '', phone: '', email: '', notes: '', is_active: true,
}

function ContactDrawer({ contact, onClose, onSaved }) {
  const { propertyId } = useProperty()
  const { addToast } = useToast()
  const isEdit = !!contact?.id

  const [form, setForm] = useState(() => {
    if (contact) {
      const { id: _id, property_id: _pid, type: _t, created_at: _ca, updated_at: _ua, ...rest } = contact
      return rest
    }
    return EMPTY_FORM
  })
  const [saving, setSaving] = useState(false)

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function handleSave() {
    if (!form.first_name.trim()) { addToast({ message: 'First name required', variant: 'error' }); return }
    if (!form.last_name.trim())  { addToast({ message: 'Last name required',  variant: 'error' }); return }

    setSaving(true)
    const payload = {
      property_id: propertyId,
      type:        'vendor',
      first_name:  form.first_name.trim(),
      last_name:   form.last_name.trim(),
      company:     form.company?.trim() || null,
      category:    form.category,
      role:        form.role?.trim() || null,
      phone:       form.phone?.trim() || null,
      email:       form.email?.trim() || null,
      notes:       form.notes?.trim() || null,
      is_active:   form.is_active,
    }

    let error
    if (isEdit) {
      ;({ error } = await supabase.from('contacts').update(payload).eq('id', contact.id))
    } else {
      ;({ error } = await supabase.from('contacts').insert(payload))
    }
    setSaving(false)
    if (error) { addToast({ message: 'Save failed', variant: 'error' }); return }
    addToast({ message: isEdit ? 'Contact updated' : 'Contact added', variant: 'success' })
    onSaved()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-body text-[13px] text-text-muted font-semibold uppercase tracking-[0.06em]">First name *</span>
          <Input value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-body text-[13px] text-text-muted font-semibold uppercase tracking-[0.06em]">Last name *</span>
          <Input value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last" />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-body text-[13px] text-text-muted font-semibold uppercase tracking-[0.06em]">Company</span>
        <Input value={form.company ?? ''} onChange={e => set('company', e.target.value)} placeholder="e.g. Blue Ridge Plumbing" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-body text-[13px] text-text-muted font-semibold uppercase tracking-[0.06em]">Category</span>
        <Select
          value={form.category}
          onValueChange={v => set('category', v)}
          options={VENDOR_CATEGORIES.map(c => ({ value: c, label: c }))}
          placeholder="Select a category"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-body text-[13px] text-text-muted font-semibold uppercase tracking-[0.06em]">Role / Specialty</span>
        <Input value={form.role ?? ''} onChange={e => set('role', e.target.value)} placeholder="e.g. Licensed Electrician" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-body text-[13px] text-text-muted font-semibold uppercase tracking-[0.06em]">Phone</span>
        <Input type="tel" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="+1 800 555 0100" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-body text-[13px] text-text-muted font-semibold uppercase tracking-[0.06em]">Email</span>
        <Input type="email" value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="contact@example.com" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-body text-[13px] text-text-muted font-semibold uppercase tracking-[0.06em]">Notes</span>
        <textarea
          value={form.notes ?? ''}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          placeholder="Account numbers, hours, special instructions…"
          className="rounded-[6px] border border-border bg-surface px-3 py-2 font-body text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info resize-none"
        />
      </label>

      <div className="flex items-center gap-3">
        <Switch.Root
          checked={form.is_active}
          onCheckedChange={v => set('is_active', v)}
          className={cn('w-10 h-6 rounded-full transition-colors', form.is_active ? 'bg-success' : 'bg-border')}
        >
          <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
        </Switch.Root>
        <span className="font-body text-[14px] text-text-secondary">
          {form.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="pt-2 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Contact'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Contacts() {
  const queryClient = useQueryClient()
  const { data: contacts = [], isLoading } = useContacts()

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const displayed = useMemo(() => {
    let list = contacts.filter(c => c.is_active)
    if (filterCategory) list = list.filter(c => c.category === filterCategory)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        `${c.first_name} ${c.last_name} ${c.company ?? ''} ${c.category ?? ''} ${c.notes ?? ''}`.toLowerCase().includes(q)
      )
    }
    return list
  }, [contacts, search, filterCategory])

  function openEdit(contact) { setEditing(contact); setDrawerOpen(true) }
  function openNew() { setEditing(null); setDrawerOpen(true) }

  function handleSaved() {
    setDrawerOpen(false)
    queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all })
  }

  // Group by category for the grid
  const grouped = useMemo(() => {
    const map = {}
    for (const c of displayed) {
      const cat = c.category ?? 'Other'
      ;(map[cat] ??= []).push(c)
    }
    return Object.entries(map).sort(([a], [b]) => {
      const ai = VENDOR_CATEGORIES.indexOf(a)
      const bi = VENDOR_CATEGORIES.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  }, [displayed])

  const inactiveCount = contacts.filter(c => !c.is_active).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-[24px] sm:text-[32px] text-text-primary uppercase">Admin Contacts</h1>
          <p className="font-body text-[14px] text-text-secondary mt-1">
            Service providers, emergency contacts, and key vendors.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={openNew}>
          <Plus size={16} weight="bold" /> Add contact
        </Button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search contacts…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 border border-border rounded-[6px] px-3 font-body text-[14px] bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info flex-1 max-w-xs"
        />
        <Select
          value={filterCategory}
          onValueChange={v => setFilterCategory(v === 'all' ? '' : v)}
          className="w-52"
          options={[{ value: 'all', label: 'All categories' }, ...VENDOR_CATEGORIES.map(c => ({ value: c, label: c }))]}
          placeholder="All categories"
        />
        {filterCategory && filterCategory !== 'all' && (
          <span className="bg-info-bg text-info text-[12px] font-mono px-2 py-0.5 rounded-full">
            1
          </span>
        )}
        {(search || filterCategory) && (
          <button
            onClick={() => { setSearch(''); setFilterCategory('') }}
            className="font-body text-[13px] text-text-muted hover:text-text-primary underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-border rounded-[8px] h-36" />
          ))}
        </div>
      ) : displayed.length === 0 && contacts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <AddressBook size={18} weight="fill" className="text-text-muted" />
          <p className="font-body text-[15px] text-text-muted">No contacts yet</p>
          <Button variant="primary" size="sm" onClick={openNew}>
            <Plus size={14} weight="bold" /> Add first contact
          </Button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className="font-body text-[15px] text-text-muted">No contacts match your filters.</p>
          <button onClick={() => { setSearch(''); setFilterCategory('') }} className="font-body text-[13px] text-info underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {(filterCategory || search) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayed.map(c => <VendorCard key={c.id} contact={c} onEdit={openEdit} />)}
            </div>
          ) : (
            grouped.map(([category, cats]) => (
              <div key={category}>
                <h2 className="font-heading text-[16px] text-text-primary mb-3 flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', (CATEGORY_COLORS[category] ?? '').split(' ')[0])} />
                  {category}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cats.map(c => <VendorCard key={c.id} contact={c} onEdit={openEdit} />)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {inactiveCount > 0 && (
        <p className="font-body text-[13px] text-text-muted">
          {inactiveCount} inactive contact{inactiveCount !== 1 ? 's' : ''} hidden.
        </p>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'Edit Contact' : 'New Contact'}>
        <ContactDrawer
          key={editing?.id ?? 'new'}
          contact={editing}
          onClose={() => setDrawerOpen(false)}
          onSaved={handleSaved}
        />
      </Drawer>
    </div>
  )
}
