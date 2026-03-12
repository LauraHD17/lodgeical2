// src/pages/admin/settings/EmailTemplatesTab.jsx
// Email template editor with variable tag insertion and automation rule configuration.

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { HelpTip } from '@/components/ui/HelpTip'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

const TEMPLATE_TYPES = [
  { value: 'booking_confirmation',      label: 'Booking Confirmation' },
  { value: 'cancellation_notice',       label: 'Cancellation Notice' },
  { value: 'modification_confirmation', label: 'Modification Confirmation' },
  { value: 'payment_failed',            label: 'Payment Failed' },
  { value: 'check_in_reminder',         label: 'Check-in Reminder' },
  { value: 'check_out_reminder',        label: 'Check-out Reminder' },
  { value: 'pre_arrival_info',          label: 'Pre-arrival Info' },
  { value: 'post_stay_follow_up',       label: 'Post-stay Follow-up' },
  { value: 'booking_thank_you_delay',   label: 'Booking Thank You (Delayed)' },
  { value: 'custom',                    label: 'Custom (Blank)' },
]

// These templates fire immediately on events — automation rules do not apply to them.
const INSTANT_TYPES = new Set([
  'booking_confirmation',
  'cancellation_notice',
  'modification_confirmation',
  'payment_failed',
])

const TRIGGER_OPTIONS = [
  { value: 'after_booking',   label: 'after booking' },
  { value: 'before_check_in', label: 'before check-in' },
  { value: 'after_check_out', label: 'after check-out' },
]

const VARIABLE_TAGS = [
  '{{guest_first_name}}', '{{guest_last_name}}', '{{confirmation_number}}',
  '{{check_in_date}}', '{{check_out_date}}', '{{check_in_time}}', '{{check_out_time}}',
  '{{room_names}}', '{{num_nights}}', '{{total_due}}', '{{balance_due}}',
  '{{property_name}}', '{{refund_amount}}',
]

function useEmailTemplate(propertyId, templateType) {
  return useQuery({
    queryKey: queryKeys.emailTemplates.byType(propertyId, templateType),
    queryFn: async () => {
      if (!propertyId || !templateType) return null
      const { data } = await supabase
        .from('email_templates')
        .select('id, subject, body_html, is_active, rule_enabled, trigger_event, offset_days, send_time')
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

function rulePreviewText(ruleEnabled, triggerEvent, offsetDays, sendTime) {
  if (!ruleEnabled || !triggerEvent || offsetDays === '' || !sendTime) return null
  const days = Number(offsetDays)
  const timeLabel = sendTime ? sendTime.slice(0, 5) + ' (property local time)' : ''
  const triggerLabel = TRIGGER_OPTIONS.find(o => o.value === triggerEvent)?.label ?? triggerEvent
  if (days === 0) {
    return `Sends same day as the ${triggerLabel.replace('after ', '').replace('before ', '')} at ${timeLabel}.`
  }
  return `Sends ${days} day${days !== 1 ? 's' : ''} ${triggerLabel} at ${timeLabel}.`
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

  // Automation rule state
  const [ruleEnabled, setRuleEnabled] = useState(false)
  const [triggerEvent, setTriggerEvent] = useState('before_check_in')
  const [offsetDays, setOffsetDays] = useState(3)
  const [sendTime, setSendTime] = useState('10:00')

  const { data: template, isLoading } = useEmailTemplate(propertyId, activeType)

  useEffect(() => {
    setSubject(template?.subject ?? '')
    setBody(template?.body_html ?? '')
    setRuleEnabled(template?.rule_enabled ?? false)
    setTriggerEvent(template?.trigger_event ?? 'before_check_in')
    setOffsetDays(template?.offset_days ?? 3)
    // send_time from DB is 'HH:MM:SS'; time input wants 'HH:MM'
    setSendTime(template?.send_time ? template.send_time.slice(0, 5) : '10:00')
  }, [template, activeType])

  function insertTag(tag) {
    const el = document.getElementById('email-body-editor')
    if (!el) { setBody(b => b + tag); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    setBody(b => b.slice(0, start) + tag + b.slice(end))
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + tag.length; el.focus() })
  }

  const isInstantType = INSTANT_TYPES.has(activeType)
  const preview = !isInstantType ? rulePreviewText(ruleEnabled, triggerEvent, offsetDays, sendTime) : null

  async function handleSave() {
    setSaving(true)
    try {
      const isBlank = !subject.trim() && !body.trim()
      if (isBlank && !ruleEnabled) {
        await supabase
          .from('email_templates')
          .delete()
          .eq('property_id', propertyId)
          .eq('template_type', activeType)
        addToast({ message: 'Template cleared — built-in default will be used', variant: 'success' })
      } else {
        const payload = {
          property_id: propertyId,
          template_type: activeType,
          subject,
          body_html: body,
          is_active: true,
          // Rule config only persisted for timed template types
          rule_enabled: isInstantType ? false : ruleEnabled,
          trigger_event: (!isInstantType && ruleEnabled) ? triggerEvent : null,
          offset_days: (!isInstantType && ruleEnabled) ? Number(offsetDays) : null,
          send_time: (!isInstantType && ruleEnabled) ? sendTime + ':00' : null,
        }
        const { error } = await supabase
          .from('email_templates')
          .upsert(payload, { onConflict: 'property_id,template_type' })
        if (error) throw error
        addToast({ message: 'Template saved', variant: 'success' })
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.byType(propertyId, activeType) })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates.byType(propertyId, activeType) })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader>Email Templates</SectionHeader>
      <p className="font-body text-[14px] text-text-secondary -mt-3">
        Customize the emails sent to guests. Use <span className="font-mono text-[13px] bg-border px-1 rounded">{'{{variable}}'}</span> tags to insert dynamic content.
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
            placeholder="e.g. Booking Confirmed — {{confirmation_number}}"
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

          {/* Automation Rule */}
          <div className="border-t border-border pt-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <h3 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
                Automation Rule
              </h3>
              <HelpTip text="When enabled, Lodge-ical will automatically schedule this email for each new reservation. Changes apply to future reservations only." />
            </div>

            {isInstantType ? (
              <p className="font-body text-[13px] text-text-muted bg-surface rounded px-3 py-2.5 border border-border">
                This template is sent automatically when the event occurs. Automation rules apply to timed follow-up templates only.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 w-fit">
                  <button
                    id="rule-enabled-switch"
                    role="switch"
                    aria-checked={ruleEnabled}
                    aria-label="Automatically send this template"
                    onClick={() => setRuleEnabled(v => !v)}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2',
                      ruleEnabled ? 'bg-text-primary border-text-primary' : 'bg-border border-border'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                        ruleEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                  <span className="font-body text-[14px] text-text-primary">
                    Automatically send this template
                  </span>
                </div>

                <div className={cn('grid grid-cols-3 gap-3 transition-opacity', !ruleEnabled && 'opacity-40 pointer-events-none')}>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="rule-trigger" className="font-body text-[12px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
                      Trigger
                    </label>
                    <select
                      id="rule-trigger"
                      value={triggerEvent}
                      onChange={e => setTriggerEvent(e.target.value)}
                      disabled={!ruleEnabled}
                      className="h-11 border-[1.5px] border-border rounded-[6px] px-3 font-body text-[14px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
                    >
                      {TRIGGER_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="rule-offset-days" className="font-body text-[12px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
                      Days offset
                    </label>
                    <input
                      id="rule-offset-days"
                      type="number"
                      min={0}
                      max={365}
                      value={offsetDays}
                      onChange={e => setOffsetDays(e.target.value)}
                      disabled={!ruleEnabled}
                      className="h-11 border-[1.5px] border-border rounded-[6px] px-3 font-mono text-[14px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="rule-send-time" className="font-body text-[12px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
                      Send at
                    </label>
                    <input
                      id="rule-send-time"
                      type="time"
                      value={sendTime}
                      onChange={e => setSendTime(e.target.value)}
                      disabled={!ruleEnabled}
                      className="h-11 border-[1.5px] border-border rounded-[6px] px-3 font-mono text-[14px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
                    />
                  </div>
                </div>

                {preview && (
                  <p className="font-body text-[13px] text-info bg-info-bg px-3 py-2 rounded border border-info/30">
                    {preview}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
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
