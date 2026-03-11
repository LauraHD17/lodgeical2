// src/pages/admin/Settings.jsx
// Settings page with Radix Tabs: Property, Check-in/out, Tax & Policy, Team,
// iCal Feeds, Channel Sync, Booking Widget.

import { useState, useEffect } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import * as Switch from '@radix-ui/react-switch'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { HelpTip } from '@/components/ui/HelpTip'
import { DataTable } from '@/components/shared/DataTable'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

import { SectionHeader } from './settings/EmailTemplatesTab'
import { ICalFeedsTab } from './settings/ICalFeedsTab'
import { ChannelSyncTab } from './settings/ChannelSyncTab'
import { BookingWidgetTab } from './settings/BookingWidgetTab'

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
    pet_fee_cents: 0, pet_fee_type: 'flat', pass_through_stripe_fee: false,
  })

  // Policies tab state
  const [policies, setPolicies] = useState({
    terms_and_conditions: '', cancellation_policy_text: '',
    incidental_policy: '', marketing_policy: '',
  })

  // Daily digest toggle (saved with property tab)
  const [dailyDigest, setDailyDigest] = useState(false)

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
        pet_fee_cents: settings.pet_fee_cents ?? 0,
        pet_fee_type: settings.pet_fee_type ?? 'flat',
        pass_through_stripe_fee: settings.pass_through_stripe_fee ?? false,
      })
      setPolicies({
        terms_and_conditions: settings.terms_and_conditions ?? '',
        cancellation_policy_text: settings.cancellation_policy_text ?? '',
        incidental_policy: settings.incidental_policy ?? '',
        marketing_policy: settings.marketing_policy ?? '',
      })
      setDailyDigest(settings.daily_digest_enabled ?? false)
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
      <h1 className="font-heading text-[32px] text-text-primary uppercase">Settings</h1>

      <Tabs.Root defaultValue="property">
        <Tabs.List className="flex gap-0 border-b border-border mb-6 overflow-x-auto">
          {['property', 'checkin', 'tax', 'policies', 'team', 'ical', 'sync', 'widget'].map((tab) => (
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
              {tab === 'tax' && 'Tax & Fees'}
              {tab === 'policies' && 'Policies'}
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
            <div className="flex flex-col">
              <Input
                label="URL Name"
                value={property.slug}
                onChange={(e) => setProperty((p) => ({ ...p, slug: e.target.value }))}
                placeholder="my-property"
              />
              <p className="mt-1 font-body text-[12px] text-text-muted">A short, URL-friendly name for your property (e.g. &quot;sunrise-lodge&quot;). Used in booking links and public pages.</p>
            </div>
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

            <SectionHeader>Notifications</SectionHeader>
            <div className="flex items-center gap-3">
              <Switch.Root
                checked={dailyDigest}
                onCheckedChange={setDailyDigest}
                className={cn(
                  'w-10 h-6 rounded-full transition-colors',
                  dailyDigest ? 'bg-success' : 'bg-border'
                )}
              >
                <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
              </Switch.Root>
              <span className="font-body text-[14px] text-text-secondary">
                Send daily morning digest
              </span>
            </div>
            <p className="font-body text-[12px] text-text-muted -mt-3">
              Owners and managers receive a daily email summary of arrivals and departures.
            </p>

            <Button
              variant="primary"
              size="md"
              loading={saving}
              onClick={() => saveTab({ ...property, daily_digest_enabled: dailyDigest })}
              className="self-start"
            >
              Save Property Settings
            </Button>
          </div>
        </Tabs.Content>

        {/* Check-in/out Tab */}
        <Tabs.Content value="checkin">
          <div className="max-w-lg flex flex-col gap-5">
            <SectionHeader>Check-in & Check-out Times</SectionHeader>
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
              label={<span className="flex items-center gap-1.5">Minimum Stay (nights) <HelpTip text="The fewest nights a guest can book in a single reservation. Setting this to 2 or 3 during busy periods reduces frequent turnover for short stays." /></span>}
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
            <SectionHeader>Tax & Cancellation Policy</SectionHeader>
            <div className="flex flex-col">
              <label htmlFor="settings-tax-rate" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1 flex items-center gap-1.5">
                Tax Rate (%)
                <HelpTip text="Enter the combined occupancy or lodging tax percentage required in your area. This is added to the guest's total at checkout. Check with your local tax authority for the correct rate — it varies by city, county, and state." />
              </label>
              <div className="relative">
                <input
                  id="settings-tax-rate"
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
              <label htmlFor="settings-cleaning-fee" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Cleaning Fee ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">$</span>
                <input
                  id="settings-cleaning-fee"
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

            <SectionHeader>Pet Fee</SectionHeader>
            <div className="flex flex-col">
              <label htmlFor="settings-pet-fee" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Pet Fee ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">$</span>
                <input
                  id="settings-pet-fee"
                  type="number"
                  min={0}
                  step={0.01}
                  value={(taxPolicy.pet_fee_cents / 100).toFixed(2)}
                  onChange={(e) =>
                    setTaxPolicy((t) => ({ ...t, pet_fee_cents: Math.round(Number(e.target.value) * 100) }))
                  }
                  className="h-11 border-[1.5px] border-border rounded-[6px] pl-7 pr-3 font-mono text-[15px] text-text-primary bg-surface-raised w-full focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
                />
              </div>
              <p className="mt-1 font-body text-[12px] text-text-muted">Property-wide default. Override per room in the Rooms section.</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
                Pet Fee Type
              </span>
              <div className="flex gap-5">
                {[
                  { value: 'flat', label: 'One-time charge' },
                  { value: 'per_night', label: 'Per night' },
                ].map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pet_fee_type"
                      value={value}
                      checked={taxPolicy.pet_fee_type === value}
                      onChange={() => setTaxPolicy((t) => ({ ...t, pet_fee_type: value }))}
                      className="accent-info w-4 h-4"
                    />
                    <span className="font-body text-[14px] text-text-primary">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <SectionHeader>Stripe Processing Fee</SectionHeader>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={taxPolicy.pass_through_stripe_fee}
                onChange={(e) => setTaxPolicy((t) => ({ ...t, pass_through_stripe_fee: e.target.checked }))}
                className="accent-info w-4 h-4"
              />
              <span className="font-body text-[14px] text-text-primary flex items-center gap-1.5">
                Pass processing fee to guests
                <HelpTip text="Stripe charges your property 2.9% + $0.30 per online payment. When this is on, that fee is added to the guest's total so your property receives the full booking amount. When it's off, the fee comes out of your earnings." />
              </span>
            </label>
            <p className="font-body text-[12px] text-text-muted">When enabled, a 2.9% + $0.30 processing fee is added to the guest&apos;s total so your property receives the full booking amount.</p>

            <Button
              variant="primary"
              size="md"
              loading={saving}
              onClick={() => saveTab({ tax_rate: taxPolicy.tax_rate, cancellation_policy: taxPolicy.cancellation_policy, cleaning_fee_cents: taxPolicy.cleaning_fee_cents, pet_fee_cents: taxPolicy.pet_fee_cents, pet_fee_type: taxPolicy.pet_fee_type, pass_through_stripe_fee: taxPolicy.pass_through_stripe_fee })}
              className="self-start"
            >
              Save Tax & Policy Settings
            </Button>
          </div>
        </Tabs.Content>

        {/* Policies Tab */}
        <Tabs.Content value="policies">
          <div className="max-w-lg flex flex-col gap-5">
            <SectionHeader>Guest Policies</SectionHeader>
            <p className="font-body text-[14px] text-text-secondary -mt-3">
              Guests must accept these policies before completing a booking. Leave blank to skip a policy.
            </p>

            <div className="flex flex-col">
              <label htmlFor="settings-terms" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Terms & Conditions
              </label>
              <textarea
                id="settings-terms"
                rows={6}
                value={policies.terms_and_conditions}
                onChange={(e) => setPolicies((p) => ({ ...p, terms_and_conditions: e.target.value }))}
                placeholder="Enter your terms and conditions..."
                className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[14px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-y"
              />
              <p className="mt-1 font-body text-[12px] text-text-muted">
                {policies.terms_and_conditions.length} characters
              </p>
            </div>

            <div className="flex flex-col">
              <label htmlFor="settings-cancellation-text" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Cancellation Policy (Custom Text)
              </label>
              <textarea
                id="settings-cancellation-text"
                rows={4}
                value={policies.cancellation_policy_text}
                onChange={(e) => setPolicies((p) => ({ ...p, cancellation_policy_text: e.target.value }))}
                placeholder="Detailed cancellation policy text shown to guests..."
                className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[14px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-y"
              />
              <p className="mt-1 font-body text-[12px] text-text-muted">
                Supplements the cancellation tier selected in Tax & Fees. {policies.cancellation_policy_text.length} characters
              </p>
            </div>

            <div className="flex flex-col">
              <label htmlFor="settings-incidental" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Incidental Policy
              </label>
              <textarea
                id="settings-incidental"
                rows={4}
                value={policies.incidental_policy}
                onChange={(e) => setPolicies((p) => ({ ...p, incidental_policy: e.target.value }))}
                placeholder="Policy for incidental charges, damages, etc..."
                className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[14px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-y"
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="settings-marketing" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Marketing Policy
              </label>
              <textarea
                id="settings-marketing"
                rows={4}
                value={policies.marketing_policy}
                onChange={(e) => setPolicies((p) => ({ ...p, marketing_policy: e.target.value }))}
                placeholder="Marketing opt-in language (optional, shown as optional checkbox to guests)..."
                className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[14px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-y"
              />
              <p className="mt-1 font-body text-[12px] text-text-muted">
                If set, guests see an optional &quot;I&apos;d like to receive marketing communications&quot; checkbox at booking.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              loading={saving}
              onClick={() => saveTab(policies)}
              className="self-start"
            >
              Save Policies
            </Button>
          </div>
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
          <BookingWidgetTab property={settings} onSaveClosure={saveTab} />
        </Tabs.Content>

        {/* Team Tab */}
        <Tabs.Content value="team">
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <SectionHeader>Team Members</SectionHeader>
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

