// src/pages/admin/settings/EmailTemplatesTab.jsx
// Email template editor with variable tag insertion.

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

const TEMPLATE_TYPES = [
  { value: 'booking_confirmation',      label: 'Booking Confirmation' },
  { value: 'cancellation_notice',       label: 'Cancellation Notice' },
  { value: 'modification_confirmation', label: 'Modification Confirmation' },
  { value: 'payment_failed',            label: 'Payment Failed' },
  { value: 'check_in_reminder',         label: 'Check-in Reminder' },
  { value: 'check_out_reminder',        label: 'Check-out Reminder' },
]

const VARIABLE_TAGS = [
  '{{guest_first_name}}', '{{guest_last_name}}', '{{confirmation_number}}',
  '{{check_in_date}}', '{{check_out_date}}', '{{check_in_time}}', '{{check_out_time}}',
  '{{room_names}}', '{{num_nights}}', '{{total_due}}', '{{balance_due}}',
  '{{property_name}}', '{{refund_amount}}',
]

function useEmailTemplate(propertyId, templateType) {
  return useQuery({
    queryKey: ['email-template', propertyId, templateType],
    queryFn: async () => {
      if (!propertyId || !templateType) return null
      const { data } = await supabase
        .from('email_templates')
        .select('id, subject, body_html, is_active')
        .eq('property_id', propertyId)
        .eq('template_type', templateType)
        .maybeSingle()
      return data ?? null
    },
    enabled: !!propertyId && !!templateType,
  })
}

export function SectionHeader({ children }) {
  return (
    <h3 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-4 pb-2 border-b border-border">
      {children}
    </h3>
  )
}

export function EmailTemplatesTab() {
  const { propertyId } = useProperty()
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [activeType, setActiveType] = useState('booking_confirmation')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const { data: template, isLoading } = useEmailTemplate(propertyId, activeType)

  useEffect(() => {
    setSubject(template?.subject ?? '')
    setBody(template?.body_html ?? '')
  }, [template, activeType])

  function insertTag(tag) {
    const el = document.getElementById('email-body-editor')
    if (!el) { setBody(b => b + tag); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    setBody(b => b.slice(0, start) + tag + b.slice(end))
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + tag.length; el.focus() })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const isBlank = !subject.trim() && !body.trim()
      if (isBlank) {
        await supabase
          .from('email_templates')
          .delete()
          .eq('property_id', propertyId)
          .eq('template_type', activeType)
        addToast({ message: 'Template cleared — built-in default will be used', variant: 'success' })
      } else {
        const payload = { property_id: propertyId, template_type: activeType, subject, body_html: body, is_active: true }
        const { error } = await supabase.from('email_templates').upsert(payload, { onConflict: 'property_id,template_type' })
        if (error) throw error
        addToast({ message: 'Template saved', variant: 'success' })
      }
      queryClient.invalidateQueries({ queryKey: ['email-template', propertyId, activeType] })
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to save template', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('property_id', propertyId)
      .eq('template_type', activeType)
    setConfirmReset(false)
    if (!error) {
      addToast({ message: 'Template reset to default', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['email-template', propertyId, activeType] })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader>Email Templates</SectionHeader>
      <p className="font-body text-[14px] text-text-secondary -mt-3">
        Customise the emails sent to guests. Use <span className="font-mono text-[13px] bg-border px-1 rounded">{'{{variable}}'}</span> tags to insert dynamic content.
        Leave a template blank to use the built-in default.
      </p>

      <div className="flex flex-wrap gap-2">
        {TEMPLATE_TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setActiveType(t.value)}
            className={cn(
              'font-body text-[13px] px-4 py-2 rounded-full border transition-colors',
              activeType === t.value
                ? 'bg-text-primary text-white border-text-primary'
                : 'border-border text-text-secondary hover:border-text-primary hover:text-text-primary'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="animate-pulse flex flex-col gap-3"><div className="h-11 bg-border rounded" /><div className="h-48 bg-border rounded" /></div>
      ) : (
        <>
          <Input
            label="Subject line"
            placeholder={`e.g. Booking Confirmed — {{confirmation_number}}`}
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />

          <div className="flex flex-col gap-2">
            <span className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
              Insert variable
            </span>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLE_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => insertTag(tag)}
                  className="font-mono text-[11px] px-2 py-1 bg-info-bg border border-info text-info rounded hover:bg-info hover:text-white transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="email-body-editor" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
              Email body (HTML)
            </label>
            <textarea
              id="email-body-editor"
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={14}
              placeholder="Enter HTML email body, or leave blank to use the built-in default template."
              className="border-[1.5px] border-border rounded-[6px] px-3 py-2.5 font-mono text-[13px] text-text-primary bg-surface-raised resize-y focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="primary" size="md" loading={saving} onClick={handleSave}>Save Template</Button>
            {template && !confirmReset && (
              <Button variant="secondary" size="md" onClick={() => setConfirmReset(true)}>Reset to Default</Button>
            )}
            {confirmReset && (
              <div className="flex items-center gap-2">
                <span className="font-body text-[13px] text-text-secondary">Reset to built-in default?</span>
                <Button variant="danger" size="sm" onClick={handleReset}>Yes, reset</Button>
                <Button variant="secondary" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
