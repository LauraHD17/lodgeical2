// src/pages/admin/Contacts.jsx
// Vendors and Staff contact directory.
// Vendors tab: cards in a 3-col responsive grid.
// Staff tab: simple table view.

import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import * as Switch from '@radix-ui/react-switch'
import {
  Plus, Phone, EnvelopeSimple, UserCircle,
} from '@phosphor-icons/react'

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

const VENDOR_CATEGORIES = ['Cleaning','Plumbing','Electrical','HVAC','Landscaping','Pest Control','Internet','Other']
const ACCESS_LEVELS = [
  { value: 'owner',   label: 'Owner',   desc: 'Full access including billing and team management' },
  { value: 'manager', label: 'Manager', desc: 'Can manage reservations, rooms, guests, and payments' },
  { value: 'staff',   label: 'Staff',   desc: 'Can view reservations and manage guests and maintenance' },
]

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useContacts(type) {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: queryKeys.contacts.list(propertyId, type),
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('property_id', propertyId)
        .eq('type', type)
        .order('first_name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

// ---------------------------------------------------------------------------
// Shared form fields
// ---------------------------------------------------------------------------

function FormField({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="h-11 border-[1.5px] border-border rounded-[6px] px-3 font-body text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
    />
  )
}

// ---------------------------------------------------------------------------
// Vendor card
// ---------------------------------------------------------------------------

const CATEGORY_COLORS = {
  Cleaning:     'bg-success-bg text-success',
  Plumbing:     'bg-info-bg text-info',
  Electrical:   'bg-warning-bg text-warning',
  HVAC:         'bg-danger-bg text-danger',
  Landscaping:  'bg-success-bg text-success',
  'Pest Control': 'bg-warning-bg text-warning',
  Internet:     'bg-info-bg text-info',
  Other:        'bg-surface text-text-secondary',
}

function VendorCard({ contact, onEdit }) {
  const catColor = CATEGORY_COLORS[contact.category] ?? CATEGORY_COLORS.Other
  return (
    <div
      className={cn(
        'bg-surface-raised border border-border rounded-[8px] p-5 flex flex-col gap-3 cursor-pointer',
        'hover:shadow-md transition-shadow',
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

      <div className="flex items-center gap-4 pt-1 border-t border-border">
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 font-body text-[13px] text-info hover:underline"
          >
            <Phone size={13} /> {contact.phone}
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 font-body text-[13px] text-info hover:underline truncate"
          >
            <EnvelopeSimple size={13} /> {contact.email}
          </a>
        )}
        {!contact.phone && !contact.email && (
          <span className="font-body text-[13px] text-text-muted">No contact info</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Contact Drawer
// ---------------------------------------------------------------------------

const EMPTY_VENDOR = {
  first_name: '', last_name: '', company: '', category: 'Other',
  role: '', phone: '', email: '', notes: '', is_active: true,
}
const EMPTY_STAFF = {
  first_name: '', last_name: '', role: '', access_level: 'staff',
  phone: '', email: '', notes: '', is_active: true,
}

function ContactDrawer({ contact, type, onClose, onSaved }) {
  const { propertyId } = useProperty()
  const { addToast } = useToast()
  const isEdit = !!contact?.id

  const [form, setForm] = useState(() => {
    if (contact) {
      const { id, property_id, type: _t, created_at, updated_at, ...rest } = contact
      return rest
    }
    return type === 'vendor' ? EMPTY_VENDOR : EMPTY_STAFF
  })
  const [saving, setSaving] = useState(false)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.first_name.trim()) {
      addToast({ message: 'First name is required', variant: 'error' })
      return
    }
    if (!form.last_name.trim()) {
      addToast({ message: 'Last name is required', variant: 'error' })
      return
    }

    setSaving(true)
    const payload = {
      property_id: propertyId,
      type,
      first_name:    form.first_name.trim(),
      last_name:     form.last_name.trim(),
      company:       form.company?.trim() || null,
      category:      type === 'vendor' ? form.category : null,
      role:          form.role?.trim() || null,
      access_level:  type === 'staff' ? form.access_level : null,
      phone:         form.phone?.trim() || null,
      email:         form.email?.trim() || null,
      notes:         form.notes?.trim() || null,
      is_active:     form.is_active,
    }

    try {
      let error
      if (isEdit) {
        ;({ error } = await supabase.from('contacts').update(payload).eq('id', contact.id))
      } else {
        ;({ error } = await supabase.from('contacts').insert(payload))
      }
      if (error) throw error
      addToast({ message: isEdit ? 'Contact updated' : 'Contact added', variant: 'success' })
      onSaved()
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to save contact', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const categoryOptions = VENDOR_CATEGORIES.map(c => ({ value: c, label: c }))

  return (
    <div className="flex flex-col gap-5">
      {/* Name row */}
      <div className="grid grid-cols-2 gap-3">
        <FormField label="First Name" required>
          <TextInput value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First" />
        </FormField>
        <FormField label="Last Name" required>
          <TextInput value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last" />
        </FormField>
      </div>

      {type === 'vendor' && (
        <FormField label="Company">
          <TextInput value={form.company ?? ''} onChange={e => set('company', e.target.value)} placeholder="e.g. Blue Ridge Cleaning" />
        </FormField>
      )}

      {type === 'vendor' && (
        <Select
          label="Category"
          options={categoryOptions}
          value={form.category}
          onValueChange={v => set('category', v)}
        />
      )}

      <FormField label={type === 'vendor' ? 'Role / Specialty' : 'Role / Title'}>
        <TextInput
          value={form.role ?? ''}
          onChange={e => set('role', e.target.value)}
          placeholder={type === 'vendor' ? 'e.g. Licensed Electrician' : 'e.g. Head of Housekeeping'}
        />
      </FormField>

      {type === 'staff' && (
        <div className="flex flex-col gap-2">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
            Access Level
          </label>
          <div className="flex flex-col gap-2">
            {ACCESS_LEVELS.map(lvl => (
              <label
                key={lvl.value}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-[6px] border cursor-pointer transition-colors',
                  form.access_level === lvl.value
                    ? 'bg-info-bg border-info'
                    : 'bg-surface border-border hover:bg-border'
                )}
              >
                <input
                  type="radio"
                  name="access_level"
                  value={lvl.value}
                  checked={form.access_level === lvl.value}
                  onChange={() => set('access_level', lvl.value)}
                  className="mt-0.5 accent-info"
                />
                <div>
                  <p className="font-body text-[14px] font-semibold text-text-primary">{lvl.label}</p>
                  <p className="font-body text-[12px] text-text-secondary">{lvl.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <FormField label="Phone">
        <TextInput value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="+1 800 555 0100" type="tel" />
      </FormField>

      <FormField label="Email">
        <TextInput value={form.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="contact@example.com" type="email" />
      </FormField>

      <FormField label="Notes">
        <textarea
          value={form.notes ?? ''}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-none"
        />
      </FormField>

      <div className="flex items-center gap-3">
        <Switch.Root
          checked={form.is_active}
          onCheckedChange={v => set('is_active', v)}
          className={cn('w-10 h-6 rounded-full transition-colors', form.is_active ? 'bg-success' : 'bg-border')}
        >
          <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
        </Switch.Root>
        <label className="font-body text-[14px] text-text-secondary">
          {form.is_active ? 'Active' : 'Inactive'}
        </label>
      </div>

      <div className="pt-2">
        <Button variant="primary" size="md" loading={saving} onClick={handleSave} className="w-full justify-center">
          {isEdit ? 'Save Changes' : type === 'vendor' ? 'Add Vendor' : 'Add Staff Member'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Vendor Tab
// ---------------------------------------------------------------------------

function VendorTab() {
  const queryClient = useQueryClient()
  const { propertyId } = useProperty()
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const { data: vendors = [], isLoading } = useContacts('vendor')

  const active   = useMemo(() => vendors.filter(v => v.is_active), [vendors])
  const inactive = useMemo(() => vendors.filter(v => !v.is_active), [vendors])
  const displayed = useMemo(() => {
    const all = [...active, ...inactive]
    if (!search) return all
    const q = search.toLowerCase()
    return all.filter(v =>
      `${v.first_name} ${v.last_name} ${v.company ?? ''} ${v.category ?? ''} ${v.notes ?? ''}`.toLowerCase().includes(q)
    )
  }, [active, inactive, search])

  function openEdit(contact) { setEditing(contact); setDrawerOpen(true) }
  function openNew() { setEditing(null); setDrawerOpen(true) }

  function handleSaved() {
    setDrawerOpen(false)
    queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all })
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <input
          type="search"
          placeholder="Search vendors…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 border border-border rounded-[6px] px-3 font-body text-[14px] bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1 flex-1 max-w-xs"
        />
        <Button variant="primary" size="sm" onClick={openNew}>
          <Plus size={14} weight="bold" /> Add Vendor
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="animate-pulse bg-border rounded-[8px] h-36" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <UserCircle size={40} className="text-text-muted" weight="light" />
          <p className="font-body text-[15px] text-text-muted">
            {search ? 'No vendors match your search' : 'No vendors yet'}
          </p>
          {!search && (
            <Button variant="primary" size="sm" onClick={openNew}>
              <Plus size={14} weight="bold" /> Add first vendor
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map(v => (
            <VendorCard key={v.id} contact={v} onEdit={openEdit} />
          ))}
        </div>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Vendor' : 'Add Vendor'}
      >
        <ContactDrawer
          key={editing?.id ?? 'new-vendor'}
          contact={editing}
          type="vendor"
          onClose={() => setDrawerOpen(false)}
          onSaved={handleSaved}
        />
      </Drawer>
    </>
  )
}

// ---------------------------------------------------------------------------
// Staff Tab
// ---------------------------------------------------------------------------

const STAFF_COLUMNS = [
  {
    key: 'name',
    label: 'Name',
    render: (_, row) => (
      <span className="font-body text-[14px] text-text-primary">
        {row.first_name} {row.last_name}
      </span>
    ),
  },
  {
    key: 'role',
    label: 'Role',
    render: (val) => <span className="font-body text-[14px] text-text-secondary">{val ?? '—'}</span>,
  },
  {
    key: 'access_level',
    label: 'Access',
    render: (val) => (
      <span className="font-body text-[14px] capitalize text-text-secondary">{val ?? '—'}</span>
    ),
  },
  {
    key: 'phone',
    label: 'Phone',
    render: (val) => val
      ? <a href={`tel:${val}`} className="font-mono text-[13px] text-info hover:underline" onClick={e => e.stopPropagation()}>{val}</a>
      : <span className="text-text-muted font-body text-[14px]">—</span>,
  },
  {
    key: 'is_active',
    label: 'Status',
    render: (val) => (
      <span className={cn(
        'font-body text-[12px] px-2.5 py-0.5 rounded-full border',
        val ? 'bg-success-bg text-success border-success' : 'bg-border text-text-muted border-border'
      )}>
        {val ? 'Active' : 'Inactive'}
      </span>
    ),
  },
]

function StaffTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const { data: staff = [], isLoading } = useContacts('staff')

  const displayed = useMemo(() => {
    if (!search) return staff
    const q = search.toLowerCase()
    return staff.filter(s =>
      `${s.first_name} ${s.last_name} ${s.role ?? ''}`.toLowerCase().includes(q)
    )
  }, [staff, search])

  function openEdit(contact) { setEditing(contact); setDrawerOpen(true) }
  function openNew() { setEditing(null); setDrawerOpen(true) }

  function handleSaved() {
    setDrawerOpen(false)
    queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all })
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <input
          type="search"
          placeholder="Search staff…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 border border-border rounded-[6px] px-3 font-body text-[14px] bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1 flex-1 max-w-xs"
        />
        <Button variant="primary" size="sm" onClick={openNew}>
          <Plus size={14} weight="bold" /> Add Staff Member
        </Button>
      </div>

      <div className="border border-border rounded-[8px] overflow-hidden">
        <DataTable
          columns={STAFF_COLUMNS}
          data={displayed}
          loading={isLoading}
          onRowClick={openEdit}
          emptyState={
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="font-body text-[15px] text-text-muted">
                {search ? 'No staff match your search' : 'No staff members yet'}
              </p>
              {!search && (
                <Button variant="primary" size="sm" onClick={openNew}>
                  <Plus size={14} weight="bold" /> Add first staff member
                </Button>
              )}
            </div>
          }
        />
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Staff Member' : 'Add Staff Member'}
      >
        <ContactDrawer
          key={editing?.id ?? 'new-staff'}
          contact={editing}
          type="staff"
          onClose={() => setDrawerOpen(false)}
          onSaved={handleSaved}
        />
      </Drawer>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Contacts() {
  const { data: vendors = [] } = useContacts('vendor')
  const { data: staff = [] }   = useContacts('staff')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-[32px] text-text-primary">Contacts</h1>

      <Tabs.Root defaultValue="vendors">
        <Tabs.List className="flex gap-0 border-b border-border mb-6">
          {[
            { value: 'vendors', label: 'Vendors', count: vendors.filter(v => v.is_active).length },
            { value: 'staff',   label: 'Staff',   count: staff.filter(s => s.is_active).length },
          ].map(tab => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className={cn(
                'flex items-center gap-2 px-5 py-3 font-body text-[14px] font-medium text-text-secondary',
                'border-b-2 border-transparent transition-colors hover:text-text-primary',
                'data-[state=active]:text-text-primary data-[state=active]:border-text-primary'
              )}
            >
              {tab.label}
              <span className="font-mono text-[12px] bg-border text-text-secondary px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="vendors">
          <VendorTab />
        </Tabs.Content>
        <Tabs.Content value="staff">
          <StaffTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
