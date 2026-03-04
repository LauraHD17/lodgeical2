// src/pages/admin/Contacts.jsx
// Admin Contacts — vendor and service provider reference list.
// Not for guest contacts. Categories: Emergency, Plumbing, HVAC, Electrical,
// Insurance, Security, Internet, Cleaning, Other.

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, PencilSimple, Trash, Phone, Envelope, X } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  'Emergency',
  'Plumbing',
  'HVAC',
  'Electrical',
  'Insurance',
  'Security',
  'Internet',
  'Cleaning',
  'Other',
]

const CATEGORY_COLORS = {
  Emergency:  'bg-red-100 text-red-700 border-red-200',
  Plumbing:   'bg-blue-100 text-blue-700 border-blue-200',
  HVAC:       'bg-orange-100 text-orange-700 border-orange-200',
  Electrical: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Insurance:  'bg-purple-100 text-purple-700 border-purple-200',
  Security:   'bg-gray-100 text-gray-700 border-gray-200',
  Internet:   'bg-cyan-100 text-cyan-700 border-cyan-200',
  Cleaning:   'bg-green-100 text-green-700 border-green-200',
  Other:      'bg-surface text-text-secondary border-border',
}

function useContacts() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['contacts', propertyId],
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('property_id', propertyId)
        .order('category')
        .order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function useUpsertContact() {
  const { propertyId } = useProperty()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }) => {
      if (id) {
        const { error } = await supabase.from('contacts').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('contacts').insert({ ...fields, property_id: propertyId })
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts', propertyId] }),
  })
}

function useDeleteContact() {
  const { propertyId } = useProperty()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts', propertyId] }),
  })
}

const EMPTY_FORM = { name: '', category: 'Other', phone: '', email: '', notes: '' }

function ContactModal({ open, onClose, contact }) {
  const upsert = useUpsertContact()
  const { addToast } = useToast()
  const [form, setForm] = useState(() => contact ? { ...contact } : { ...EMPTY_FORM })
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    try {
      await upsert.mutateAsync({ ...form })
      addToast({ message: contact ? 'Contact updated' : 'Contact added', variant: 'success' })
      onClose()
    } catch {
      addToast({ message: 'Failed to save contact', variant: 'error' })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={contact ? 'Edit Contact' : 'Add Contact'}>
      <div className="flex flex-col gap-4">
        <Input
          label="Name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          error={errors.name}
          placeholder="Joe's Plumbing Co."
        />
        <Select
          label="Category"
          options={CATEGORIES.map(c => ({ value: c, label: c }))}
          value={form.category}
          onValueChange={v => setForm(f => ({ ...f, category: v }))}
        />
        <Input
          label="Phone"
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          placeholder="(555) 555-1234"
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="info@example.com"
        />
        <div className="flex flex-col">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
            Notes
          </label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Account numbers, access codes, anything useful..."
            className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised resize-none focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
          />
        </div>
        <div className="flex gap-3 justify-end mt-2">
          <Button variant="secondary" size="md" onClick={onClose} disabled={upsert.isPending}>Cancel</Button>
          <Button variant="primary" size="md" loading={upsert.isPending} onClick={handleSave}>
            {contact ? 'Save Changes' : 'Add Contact'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ContactCard({ contact, onEdit, onDelete }) {
  const colorClass = CATEGORY_COLORS[contact.category] ?? CATEGORY_COLORS.Other
  return (
    <div className="bg-surface border border-border rounded-[8px] p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="font-body font-semibold text-[15px] text-text-primary truncate">{contact.name}</h3>
          <span className={cn('inline-flex self-start px-2 py-0.5 rounded-full text-[11px] font-semibold border', colorClass)}>
            {contact.category}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(contact)}
            className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-border transition-colors"
            title="Edit"
          >
            <PencilSimple size={14} />
          </button>
          <button
            onClick={() => onDelete(contact)}
            className="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger-bg transition-colors"
            title="Delete"
          >
            <Trash size={14} />
          </button>
        </div>
      </div>

      {(contact.phone || contact.email) && (
        <div className="flex flex-col gap-1.5">
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-2 font-body text-[14px] text-text-secondary hover:text-text-primary transition-colors"
            >
              <Phone size={14} className="text-text-muted shrink-0" />
              {contact.phone}
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2 font-body text-[14px] text-text-secondary hover:text-text-primary transition-colors"
            >
              <Envelope size={14} className="text-text-muted shrink-0" />
              {contact.email}
            </a>
          )}
        </div>
      )}

      {contact.notes && (
        <p className="font-body text-[13px] text-text-muted line-clamp-3">{contact.notes}</p>
      )}
    </div>
  )
}

export default function Contacts() {
  const { data: contacts = [], isLoading } = useContacts()
  const deleteContact = useDeleteContact()
  const { addToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [filterCategory, setFilterCategory] = useState('All')

  const categories = ['All', ...CATEGORIES]
  const filtered = filterCategory === 'All'
    ? contacts
    : contacts.filter(c => c.category === filterCategory)

  async function handleDelete(contact) {
    if (!confirm(`Delete "${contact.name}"?`)) return
    try {
      await deleteContact.mutateAsync(contact.id)
      addToast({ message: 'Contact deleted', variant: 'success' })
    } catch {
      addToast({ message: 'Failed to delete contact', variant: 'error' })
    }
  }

  function handleEdit(contact) {
    setEditContact(contact)
    setModalOpen(true)
  }

  function handleClose() {
    setModalOpen(false)
    setEditContact(null)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[32px] text-text-primary">Admin Contacts</h1>
          <p className="font-body text-[14px] text-text-muted mt-0.5">
            Service providers, vendors, and emergency contacts for your property.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
          <Plus size={16} weight="bold" /> Add Contact
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

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-border rounded-[8px] h-36" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="font-body text-[16px] text-text-muted">
            {filterCategory === 'All' ? 'No contacts yet' : `No ${filterCategory} contacts`}
          </p>
          <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
            <Plus size={16} weight="bold" /> Add first contact
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(contact => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ContactModal
        open={modalOpen}
        onClose={handleClose}
        contact={editContact}
      />
    </div>
  )
}
