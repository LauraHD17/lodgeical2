// src/pages/admin/Settings.jsx
// Settings page with Radix Tabs: Property, Check-in/out, Tax & Policy, Team,
// iCal Feeds, Channel Sync.

import { useState, useEffect } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import * as Switch from '@radix-ui/react-switch'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Check, ArrowsClockwise, Link, CalendarPlus, Code } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DataTable } from '@/components/shared/DataTable'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'GMT/BST' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
]

const CANCELLATION_OPTIONS = [
  { value: 'flexible', label: 'Flexible — Full refund up to 24 hours before check-in' },
  { value: 'moderate', label: 'Moderate — Full refund up to 5 days before check-in' },
  { value: 'strict', label: 'Strict — 50% refund up to 1 week before check-in' },
]

function useSettings() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: queryKeys.settings.property(propertyId),
    queryFn: async () => {
      if (!propertyId) return null
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!propertyId,
  })
}

function useTeamMembers() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['team', propertyId],
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('user_property_access')
        .select('id, role, created_at, user_id, users(email)')
        .eq('property_id', propertyId)
      if (error) return []
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function TabLabel({ children }) {
  return (
    <span className="font-body font-semibold text-[14px]">{children}</span>
  )
}

function SectionHeader({ children }) {
  return (
    <h3 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-4 pb-2 border-b border-border">
      {children}
    </h3>
  )
}

export default function Settings() {
  const { propertyId } = useProperty()
  const { data: settings, isLoading } = useSettings()
  const { data: team = [], isLoading: teamLoading } = useTeamMembers()
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)

  // Property tab state
  const [property, setProperty] = useState({
    name: '', slug: '', location: '', timezone: 'America/New_York', is_active: true,
    lat: '', lon: '',
  })

  // Check-in/out tab state
  const [checkinout, setCheckinout] = useState({
    check_in_time: '15:00', check_out_time: '11:00', min_stay_nights: 1,
  })

  // Tax & Policy tab state
  const [taxPolicy, setTaxPolicy] = useState({
    tax_rate: 0, cancellation_policy: 'flexible', cleaning_fee_cents: 0,
  })

  useEffect(() => {
    if (settings) {
      setProperty({
        name: settings.name ?? '',
        slug: settings.slug ?? '',
        location: settings.location ?? '',
        timezone: settings.timezone ?? 'America/New_York',
        is_active: settings.is_active ?? true,
        lat: settings.lat ?? '',
        lon: settings.lon ?? '',
      })
      setCheckinout({
        check_in_time: settings.check_in_time ?? '15:00',
        check_out_time: settings.check_out_time ?? '11:00',
        min_stay_nights: settings.min_stay_nights ?? 1,
      })
      setTaxPolicy({
        tax_rate: settings.tax_rate ?? 0,
        cancellation_policy: settings.cancellation_policy ?? 'flexible',
        cleaning_fee_cents: settings.cleaning_fee_cents ?? 0,
      })
    }
  }, [settings])

  async function saveTab(updates) {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', propertyId)
      if (error) throw error
      addToast({ message: 'Settings saved', variant: 'success' })
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to save settings', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const TEAM_COLUMNS = [
    {
      key: 'email',
      label: 'Email',
      render: (_, row) => (
        <span className="font-body text-[14px]">{row.users?.email ?? '—'}</span>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (val) => (
        <span className="font-body text-[14px] capitalize">{val ?? '—'}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Joined',
      render: (val) => {
        try {
          const d = new Date(val)
          return (
            <span className="font-mono text-[14px]">
              {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )
        } catch {
          return <span className="font-mono text-[14px]">—</span>
        }
      },
    },
  ]

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-10 bg-border rounded w-48" />
        <div className="h-64 bg-border rounded" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-[32px] text-text-primary">Settings</h1>

      <Tabs.Root defaultValue="property">
        <Tabs.List className="flex gap-0 border-b border-border mb-6 overflow-x-auto">
          {['property', 'checkin', 'tax', 'emails', 'team', 'ical', 'sync', 'widget'].map((tab) => (
            <Tabs.Trigger
              key={tab}
              value={tab}
              className={cn(
                'px-5 py-3 font-body text-[14px] font-medium text-text-secondary border-b-2 border-transparent whitespace-nowrap',
                'transition-colors hover:text-text-primary',
                'data-[state=active]:text-text-primary data-[state=active]:border-text-primary'
              )}
            >
              {tab === 'property' && 'Property'}
              {tab === 'checkin' && 'Check-in/out'}
              {tab === 'tax' && 'Tax & Policy'}
              {tab === 'emails' && 'Email Templates'}
              {tab === 'team' && 'Team'}
              {tab === 'ical' && 'iCal Feeds'}
              {tab === 'sync' && 'Channel Sync'}
              {tab === 'widget' && 'Booking Widget'}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Property Tab */}
        <Tabs.Content value="property">
          <div className="max-w-lg flex flex-col gap-5">
            <SectionHeader>Property Details</SectionHeader>
            <Input
              label="Property Name"
              value={property.name}
              onChange={(e) => setProperty((p) => ({ ...p, name: e.target.value }))}
            />
            <Input
              label="Slug"
              value={property.slug}
              onChange={(e) => setProperty((p) => ({ ...p, slug: e.target.value }))}
              placeholder="my-property"
            />
            <Input
              label="Location"
              value={property.location}
              onChange={(e) => setProperty((p) => ({ ...p, location: e.target.value }))}
              placeholder="City, State, Country"
            />
            <Select
              label="Timezone"
              options={TIMEZONE_OPTIONS}
              value={property.timezone}
              onValueChange={(v) => setProperty((p) => ({ ...p, timezone: v }))}
            />
            <div className="flex items-center gap-3">
              <Switch.Root
                checked={property.is_active}
                onCheckedChange={(v) => setProperty((p) => ({ ...p, is_active: v }))}
                className={cn(
                  'w-10 h-6 rounded-full transition-colors',
                  property.is_active ? 'bg-success' : 'bg-border'
                )}
              >
                <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
              </Switch.Root>
              <label className="font-body text-[14px] text-text-secondary">
                Property is {property.is_active ? 'active' : 'inactive'}
              </label>
            </div>

            <SectionHeader>Property Location</SectionHeader>
            <p className="font-body text-[14px] text-text-secondary -mt-3">
              Enter your property's approximate latitude and longitude so we can show you the local weather on your dashboard.{' '}
              <a
                href="https://maps.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                Find your coordinates
              </a>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Latitude"
                type="number"
                step="any"
                value={property.lat}
                onChange={(e) => setProperty((p) => ({ ...p, lat: e.target.value }))}
                placeholder="e.g. 35.5951"
              />
              <Input
                label="Longitude"
                type="number"
                step="any"
                value={property.lon}
                onChange={(e) => setProperty((p) => ({ ...p, lon: e.target.value }))}
                placeholder="e.g. -82.5515"
              />
            </div>

            <Button
              variant="primary"
              size="md"
              loading={saving}
              onClick={() => saveTab(property)}
              className="self-start"
            >
              Save Property Settings
            </Button>
          </div>
        </Tabs.Content>

        {/* Check-in/out Tab */}
        <Tabs.Content value="checkin">
          <div className="max-w-lg flex flex-col gap-5">
            <SectionHeader>Check-in &amp; Check-out Times</SectionHeader>
            <Input
              label="Check-in Time"
              type="time"
              value={checkinout.check_in_time}
              onChange={(e) => setCheckinout((c) => ({ ...c, check_in_time: e.target.value }))}
            />
            <Input
              label="Check-out Time"
              type="time"
              value={checkinout.check_out_time}
              onChange={(e) => setCheckinout((c) => ({ ...c, check_out_time: e.target.value }))}
            />
            <Input
              label="Minimum Stay (nights)"
              type="number"
              min={1}
              value={checkinout.min_stay_nights}
              onChange={(e) =>
                setCheckinout((c) => ({ ...c, min_stay_nights: Number(e.target.value) }))
              }
            />
            <Button
              variant="primary"
              size="md"
              loading={saving}
              onClick={() => saveTab(checkinout)}
              className="self-start"
            >
              Save Check-in/out Settings
            </Button>
          </div>
        </Tabs.Content>

        {/* Tax & Policy Tab */}
        <Tabs.Content value="tax">
          <div className="max-w-lg flex flex-col gap-5">
            <SectionHeader>Tax &amp; Cancellation Policy</SectionHeader>
            <div className="flex flex-col">
              <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Tax Rate (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={taxPolicy.tax_rate}
                  onChange={(e) =>
                    setTaxPolicy((t) => ({ ...t, tax_rate: Number(e.target.value) }))
                  }
                  className="h-11 border-[1.5px] border-border rounded-[6px] px-3 pr-7 font-mono text-[15px] text-text-primary bg-surface-raised w-full focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">%</span>
              </div>
            </div>
            <Select
              label="Cancellation Policy"
              options={CANCELLATION_OPTIONS}
              value={taxPolicy.cancellation_policy}
              onValueChange={(v) => setTaxPolicy((t) => ({ ...t, cancellation_policy: v }))}
            />
            <div className="flex flex-col">
              <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Cleaning Fee ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={(taxPolicy.cleaning_fee_cents / 100).toFixed(2)}
                  onChange={(e) =>
                    setTaxPolicy((t) => ({ ...t, cleaning_fee_cents: Math.round(Number(e.target.value) * 100) }))
                  }
                  className="h-11 border-[1.5px] border-border rounded-[6px] pl-7 pr-3 font-mono text-[15px] text-text-primary bg-surface-raised w-full focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
                />
              </div>
              <p className="mt-1 font-body text-[12px] text-text-muted">Applied once per reservation. Used in the Rates fee calculator.</p>
            </div>
            <Button
              variant="primary"
              size="md"
              loading={saving}
              onClick={() => saveTab({ tax_rate: taxPolicy.tax_rate, cancellation_policy: taxPolicy.cancellation_policy, cleaning_fee_cents: taxPolicy.cleaning_fee_cents })}
              className="self-start"
            >
              Save Tax &amp; Policy Settings
            </Button>
          </div>
        </Tabs.Content>

        {/* Email Templates Tab */}
        <Tabs.Content value="emails">
          <EmailTemplatesTab />
        </Tabs.Content>

        {/* iCal Feeds Tab */}
        <Tabs.Content value="ical">
          <ICalFeedsTab />
        </Tabs.Content>

        {/* Channel Sync Tab */}
        <Tabs.Content value="sync">
          <ChannelSyncTab />
        </Tabs.Content>

        {/* Booking Widget Tab */}
        <Tabs.Content value="widget">
          <BookingWidgetTab property={settings} />
        </Tabs.Content>

        {/* Team Tab */}
        <Tabs.Content value="team">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <SectionHeader>Team Members</SectionHeader>
              <Button variant="secondary" size="sm" disabled>
                Invite (coming soon)
              </Button>
            </div>
            <div className="border border-border rounded-[8px] overflow-hidden">
              <DataTable
                columns={TEAM_COLUMNS}
                data={team}
                loading={teamLoading}
                emptyState={
                  <p className="font-body text-[15px] text-text-muted py-8">
                    No team members found
                  </p>
                }
              />
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Email Templates tab
// ---------------------------------------------------------------------------

const TEMPLATE_TYPES = [
  { value: 'booking_confirmation',  label: 'Booking Confirmation' },
  { value: 'cancellation_notice',   label: 'Cancellation Notice' },
  { value: 'payment_failed',        label: 'Payment Failed' },
  { value: 'check_in_reminder',     label: 'Check-in Reminder' },
  { value: 'check_out_reminder',    label: 'Check-out Reminder' },
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

function EmailTemplatesTab() {
  const { propertyId } = useProperty()
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [activeType, setActiveType] = useState('booking_confirmation')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const { data: template, isLoading } = useEmailTemplate(propertyId, activeType)

  // Populate editor when template or type changes
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
        // Blank save = revert to built-in default by removing the custom row
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

      {/* Type selector */}
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

          {/* Variable tag buttons */}
          <div className="flex flex-col gap-2">
            <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
              Insert variable
            </label>
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

          {/* Body editor */}
          <div className="flex flex-col gap-1">
            <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
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

// ---------------------------------------------------------------------------
// iCal Feeds tab — shows per-room export feed URLs
// ---------------------------------------------------------------------------

function useRoomsWithTokens() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['rooms-ical', propertyId],
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('rooms')
        .select('id, name, ical_token, is_active')
        .eq('property_id', propertyId)
        .order('name')
      if (error) return []
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy URL"
      className="flex items-center gap-1 text-info hover:opacity-80 transition-opacity font-body text-[13px]"
    >
      {copied ? <Check size={14} weight="bold" className="text-success" /> : <Copy size={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function ICalFeedsTab() {
  const { data: rooms = [], isLoading } = useRoomsWithTokens()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
  const baseUrl = supabaseUrl
    ? `${supabaseUrl}/functions/v1/ical-export`
    : 'https://<project>.supabase.co/functions/v1/ical-export'

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader>iCal Feed URLs</SectionHeader>
      <p className="font-body text-[14px] text-text-secondary -mt-2">
        Subscribe to these URLs in Google Calendar, Apple Calendar, or any platform that
        supports iCal feeds. Each room has a unique, stable URL — anyone with the URL can
        read the calendar, so treat it like a password.
      </p>

      {isLoading ? (
        <div className="animate-pulse flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-border rounded-[6px]" />)}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex items-start gap-3 bg-info-bg border border-info rounded-[8px] p-4">
          <CalendarPlus size={18} className="text-info mt-0.5 shrink-0" />
          <p className="font-body text-[14px] text-info">
            No rooms found. Add rooms in the Rooms section to generate iCal feeds.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rooms.map(room => {
            const feedUrl = `${baseUrl}?token=${room.ical_token}`
            return (
              <div
                key={room.id}
                className="border border-border rounded-[8px] p-4 flex flex-col gap-2 bg-surface"
              >
                <div className="flex items-center justify-between">
                  <span className="font-body font-semibold text-[15px] text-text-primary">
                    {room.name}
                  </span>
                  {!room.is_active && (
                    <span className="font-body text-[12px] text-text-muted bg-border px-2 py-0.5 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 bg-surface-raised border border-border rounded-[6px] px-3 py-2">
                    <Link size={13} className="text-text-muted shrink-0" />
                    <span className="font-mono text-[12px] text-text-secondary truncate">
                      {feedUrl}
                    </span>
                  </div>
                  <CopyButton text={feedUrl} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Channel Sync tab — manage external iCal feeds (Airbnb, VRBO, etc.)
// ---------------------------------------------------------------------------

function useExternalFeeds() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['external-feeds', propertyId],
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('room_external_feeds')
        .select('id, room_id, label, feed_url, last_synced_at, rooms(name)')
        .eq('property_id', propertyId)
        .order('created_at')
      if (error) return []
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function useRoomsSimple() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['rooms-simple', propertyId],
    queryFn: async () => {
      if (!propertyId) return []
      const { data } = await supabase
        .from('rooms')
        .select('id, name')
        .eq('property_id', propertyId)
        .order('name')
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function ChannelSyncTab() {
  const { propertyId } = useProperty()
  const { addToast } = useToast()
  const queryClient = useQueryClient()

  const { data: feeds = [], isLoading: feedsLoading } = useExternalFeeds()
  const { data: rooms = [] } = useRoomsSimple()

  const [newRoomId, setNewRoomId] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [syncing, setSyncing] = useState(null) // room_id being synced

  // Rooms that don't already have a feed configured
  const feedRoomIds = new Set(feeds.map(f => f.room_id))
  const availableRooms = rooms.filter(r => !feedRoomIds.has(r.id))

  async function handleAddFeed() {
    if (!newRoomId || !newUrl) {
      addToast({ message: 'Room and feed URL are required', variant: 'error' })
      return
    }
    try {
      const { error } = await supabase.from('room_external_feeds').upsert(
        {
          room_id: newRoomId,
          property_id: propertyId,
          label: newLabel || 'External Calendar',
          feed_url: newUrl,
        },
        { onConflict: 'room_id' },
      )
      if (error) throw error
      addToast({ message: 'External feed saved', variant: 'success' })
      setNewRoomId('')
      setNewLabel('')
      setNewUrl('')
      queryClient.invalidateQueries({ queryKey: ['external-feeds', propertyId] })
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to save feed', variant: 'error' })
    }
  }

  async function handleSync(feed) {
    setSyncing(feed.room_id)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        addToast({ message: 'Your session has expired. Please log in again.', variant: 'error' })
        setSyncing(null)
        return
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/ical-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ room_id: feed.room_id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Sync failed')
      addToast({
        message: `Synced: ${json.synced} new block(s), ${json.skipped} skipped`,
        variant: 'success',
      })
      queryClient.invalidateQueries({ queryKey: ['external-feeds', propertyId] })
    } catch (err) {
      addToast({ message: err?.message ?? 'Sync failed', variant: 'error' })
    } finally {
      setSyncing(null)
    }
  }

  async function handleDelete(feed) {
    if (!confirm(`Remove external feed for "${feed.rooms?.name}"?`)) return
    const { error } = await supabase
      .from('room_external_feeds')
      .delete()
      .eq('id', feed.id)
    if (error) {
      addToast({ message: 'Failed to remove feed', variant: 'error' })
    } else {
      addToast({ message: 'Feed removed', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['external-feeds', propertyId] })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader>External Calendar Sync</SectionHeader>
      <p className="font-body text-[14px] text-text-secondary -mt-4">
        Paste iCal feed URLs from Airbnb, VRBO, Booking.com, or any other platform. Lodge-ical
        will import them as blocked dates so your availability stays accurate.
      </p>

      {/* Add new feed */}
      {availableRooms.length > 0 && (
        <div className="border border-border rounded-[8px] p-5 flex flex-col gap-4 bg-surface">
          <h3 className="font-body font-semibold text-[15px] text-text-primary">
            Add External Feed
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Room"
              options={availableRooms.map(r => ({ value: r.id, label: r.name }))}
              value={newRoomId}
              onValueChange={setNewRoomId}
              placeholder="Select a room"
            />
            <Input
              label="Label (optional)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="e.g. Airbnb, VRBO"
            />
          </div>
          <Input
            label="iCal Feed URL"
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            placeholder="https://www.airbnb.com/calendar/ical/..."
          />
          <Button variant="primary" size="md" onClick={handleAddFeed} className="self-start">
            <CalendarPlus size={16} /> Save Feed
          </Button>
        </div>
      )}

      {/* Existing feeds */}
      {feedsLoading ? (
        <div className="animate-pulse flex flex-col gap-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-border rounded-[6px]" />)}
        </div>
      ) : feeds.length === 0 ? (
        <p className="font-body text-[14px] text-text-muted">
          No external feeds configured yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {feeds.map(feed => (
            <div
              key={feed.id}
              className="border border-border rounded-[8px] p-4 flex flex-col gap-2 bg-surface"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-body font-semibold text-[15px] text-text-primary">
                    {feed.rooms?.name ?? '—'}
                  </span>
                  <span className="ml-2 font-body text-[13px] text-text-muted">
                    {feed.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={syncing === feed.room_id}
                    onClick={() => handleSync(feed)}
                  >
                    <ArrowsClockwise size={14} />
                    {syncing === feed.room_id ? 'Syncing…' : 'Sync Now'}
                  </Button>
                  <button
                    onClick={() => handleDelete(feed)}
                    className="font-body text-[13px] text-danger hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 bg-surface-raised border border-border rounded-[6px] px-3 py-2">
                <Link size={13} className="text-text-muted shrink-0" />
                <span className="font-mono text-[12px] text-text-secondary truncate">
                  {feed.feed_url}
                </span>
              </div>
              {feed.last_synced_at && (
                <p className="font-body text-[12px] text-text-muted">
                  Last synced:{' '}
                  {new Date(feed.last_synced_at).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Booking Widget tab — iframe embed snippet for embedding on external websites
// ---------------------------------------------------------------------------

function BookingWidgetTab({ property }) {
  const [copied, setCopied] = useState(false)
  const slug = property?.slug ?? 'your-property'
  const origin = window.location.origin
  const iframeSnippet = `<iframe\n  src="${origin}/widget?property=${slug}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border: none; border-radius: 8px;"\n  title="Booking Widget"\n></iframe>`

  function handleCopy() {
    navigator.clipboard.writeText(iframeSnippet).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <SectionHeader>Embed Booking Widget</SectionHeader>
      <p className="font-body text-[14px] text-text-secondary -mt-2">
        Copy this code and paste it into your website's HTML wherever you want the booking form to appear.
        The widget allows guests to check availability and create reservations directly on your site.
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
            iframe Snippet
          </label>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 font-body text-[13px] text-info hover:opacity-80 transition-opacity"
          >
            {copied ? <Check size={14} weight="bold" className="text-success" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="relative bg-surface-raised border border-border rounded-[6px] p-4 overflow-x-auto">
          <Code size={14} className="text-text-muted absolute top-3 left-3" />
          <pre className="pl-5 font-mono text-[12px] text-text-secondary whitespace-pre-wrap break-all">
            {iframeSnippet}
          </pre>
        </div>
      </div>

      <div className="bg-info-bg border border-info rounded-[8px] p-4">
        <p className="font-body text-[14px] text-info">
          <span className="font-semibold">Property slug:</span> {slug}
          {slug === 'your-property' && (
            <span className="ml-2 text-warning">
              {' '}— Set your property slug in the Property tab to personalize this URL.
            </span>
          )}
        </p>
      </div>

      <div>
        <p className="font-body text-[13px] text-text-muted font-semibold mb-2">Preview</p>
        <a
          href={`/widget?property=${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-[14px] text-info hover:underline"
        >
          Open widget preview in new tab →
        </a>
      </div>
    </div>
  )
}
