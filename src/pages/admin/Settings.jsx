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
          {['property', 'checkin', 'tax', 'team', 'ical', 'sync', 'widget'].map((tab) => (
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
            <SectionHeader>Tax & Cancellation Policy</SectionHeader>
            <div className="flex flex-col">
              <label htmlFor="settings-tax-rate" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                Tax Rate (%)
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
              <span className="font-body text-[14px] text-text-primary">Pass processing fee to guests</span>
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

