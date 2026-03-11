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

const DEFAULT_TIERS = [
  { days_before: 14, refund_percent: 100 },
  { days_before: 0, refund_percent: 0 },
]

function useSettings() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: queryKeys.settings.property(propertyId),
    queryFn: async () => {
      if (!propertyId) return null
      const [propResult, settingsResult] = await Promise.all([
        supabase.from('properties').select('*').eq('id', propertyId).single(),
        supabase.from('settings').select('*').eq('property_id', propertyId).single(),
      ])
      if (propResult.error) throw propResult.error
      // Merge settings into property data (settings fields take precedence)
      const { property_id: _pid, id: _sid, created_at: _sca, updated_at: _sua, ...settingsFields } = settingsResult.data ?? {}
      return { ...propResult.data, ...settingsFields }
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

// --- Smart Policy Template Generators ---
// Pure functions that produce professional policy text from existing settings.
// No API calls — all data comes from component state.

function formatTime12h(time24) {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return m === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2, '0')} ${ampm}`
}

function generateTerms(name, checkinout, taxPolicy) {
  const cin = formatTime12h(checkinout.check_in_time)
  const cout = formatTime12h(checkinout.check_out_time)
  const minStay = checkinout.min_stay_nights || 1
  const taxRate = taxPolicy.tax_rate || 0

  const sections = []

  sections.push(`TERMS & CONDITIONS — ${name.toUpperCase()}`)
  sections.push(`By completing a reservation at ${name}, you acknowledge and agree to the following terms. Please read them carefully before booking.`)

  // Check-in/out
  const times = []
  if (cin) times.push(`Check-in time is ${cin}.`)
  if (cout) times.push(`Check-out time is ${cout}.`)
  times.push('Early check-in and late check-out may be available upon request but are not guaranteed.')
  if (cin) times.push(`Please contact us if you expect to arrive after ${cin} so we can make arrangements.`)
  sections.push('CHECK-IN & CHECK-OUT\n' + times.join(' '))

  // Minimum stay
  if (minStay > 1) {
    sections.push(`MINIMUM STAY\nA minimum stay of ${minStay} night${minStay > 1 ? 's' : ''} is required for all reservations.`)
  }

  // Payment
  const paymentLines = ['Full payment is required to confirm your reservation.']
  if (taxRate > 0) {
    paymentLines.push(`All reservations are subject to applicable taxes (currently ${taxRate}%). Tax rates are set by local authorities and may change without notice.`)
  }
  paymentLines.push('Rates are per room, per night, unless otherwise stated.')
  sections.push('PAYMENT & BILLING\n' + paymentLines.join(' '))

  // Guest responsibilities
  sections.push('GUEST RESPONSIBILITIES\nGuests are expected to treat the property and its furnishings with care. Quiet hours are observed from 10 PM to 7 AM out of respect for other guests. Smoking is not permitted inside the property. The maximum number of occupants per room must not exceed the stated capacity. Guests are responsible for any damage to the property or its contents during their stay.')

  // Liability
  sections.push(`LIABILITY\n${name} is not responsible for loss, theft, or damage to personal belongings left on the premises. Guests assume responsibility for their own safety during their stay. The property is not liable for service interruptions due to weather, utility outages, or other events beyond our control.`)

  // Right to refuse
  sections.push(`RIGHT TO REFUSE SERVICE\n${name} reserves the right to refuse or terminate service to any guest whose behavior is disruptive, unsafe, or in violation of these terms, without refund.`)

  // Governing law
  sections.push('GOVERNING LAW\nThese terms are governed by the laws of the state in which the property is located. [Update this with your specific state/jurisdiction.]')

  return sections.join('\n\n')
}

function generateCancellation(name, tiers, taxPolicy) {
  const sorted = [...tiers].sort((a, b) => Number(b.days_before) - Number(a.days_before))
  const sections = []

  sections.push(`CANCELLATION POLICY — ${name.toUpperCase()}`)
  sections.push(`We understand plans change. The following cancellation schedule applies to all reservations at ${name}. Cancellation requests must be received in writing (email or through your booking confirmation) to be valid.`)

  // Tier descriptions
  const tierLines = sorted.map((tier, i) => {
    const days = Number(tier.days_before)
    const pct = Number(tier.refund_percent)
    const prev = sorted[i - 1]
    let window
    if (i === 0) {
      window = days === 0 ? 'at any time' : `${days} or more days before check-in`
    } else {
      const upper = Number(prev.days_before) - 1
      window = days === 0
        ? `less than ${Number(prev.days_before)} days before check-in`
        : `${days}–${upper} days before check-in`
    }
    if (pct === 100) return `• Cancellations made ${window}: Full refund.`
    if (pct === 0) return `• Cancellations made ${window}: Non-refundable.`
    return `• Cancellations made ${window}: ${pct}% refund.`
  })
  sections.push('REFUND SCHEDULE\n' + tierLines.join('\n'))

  // Cancellation fees
  const feeType = taxPolicy.cancellation_fee_type
  const feeDollars = Number(taxPolicy.cancellation_fee_dollars || 0)
  const feeLines = []
  if (feeType === 'processing' || feeType === 'both') {
    feeLines.push('Card processing fees (2.9% + $0.30 per transaction) are non-refundable and will be deducted from any refund amount.')
  }
  if ((feeType === 'flat' || feeType === 'both') && feeDollars > 0) {
    feeLines.push(`A $${feeDollars.toFixed(2)} cancellation fee per room will be deducted from any refund amount to cover administrative costs.`)
  }
  if (feeLines.length > 0) {
    sections.push('CANCELLATION FEES\n' + feeLines.join(' '))
  }

  // Modifications
  sections.push('MODIFICATIONS\nReservation modifications (date changes, room changes) are subject to availability. If a modification results in a higher rate, the difference will be charged. Modified reservations retain the cancellation terms from the original booking date.')

  // No-show
  sections.push('NO-SHOW\nGuests who fail to arrive on their check-in date without prior notice will be considered a no-show. No-show reservations are non-refundable.')

  return sections.join('\n\n')
}

function generatePetPolicy(name, taxPolicy) {
  const fee = Number(taxPolicy.pet_fee_dollars || 0)
  const sections = []

  sections.push(`PET & ANIMAL POLICY — ${name.toUpperCase()}`)

  if (fee > 0) {
    const perType = taxPolicy.pet_fee_type === 'per_night' ? 'per night, per room' : 'per room, per stay'
    sections.push(`Pets are welcome at ${name}! We ask that all guests with pets review the following guidelines.`)
    sections.push(`PET FEE\nA non-refundable pet fee of $${fee.toFixed(2)} (${perType}) applies to all reservations with pets. This fee covers additional cleaning and preparation of pet-friendly rooms.`)
    sections.push('GUIDELINES\n• Please notify us at the time of booking that you will be bringing a pet.\n• Pets must be supervised at all times and should not be left unattended in guest rooms.\n• Guests are responsible for cleaning up after their pets on the property grounds.\n• Pets should be leashed or contained in common areas.\n• [Update: add any breed, size, or number restrictions specific to your property.]')
    sections.push('DAMAGES\nGuests are financially responsible for any damage caused by their pet to the room, furnishings, or property. Charges for pet-related damage will be assessed after checkout.')
  } else {
    sections.push(`Pets are not permitted at ${name}. We appreciate your understanding — this policy helps us maintain a comfortable environment for all guests, including those with allergies.`)
  }

  // Service animals — always included
  sections.push('SERVICE ANIMALS\nService animals (as defined by the Americans with Disabilities Act) are welcome at all times, regardless of pet policy, at no additional charge. A service animal is a dog or miniature horse individually trained to perform tasks for a person with a disability. Emotional support animals, therapy animals, and companion animals are not considered service animals under the ADA.')

  return sections.join('\n\n')
}

function generateIncidental(name) {
  const sections = []

  sections.push(`INCIDENTAL & DAMAGE POLICY — ${name.toUpperCase()}`)
  sections.push(`${name} strives to provide a comfortable, well-maintained environment for all guests. The following policies apply to incidental charges during your stay.`)

  sections.push('CREDIT CARD ON FILE\nA valid credit card is required at booking. This card may be charged for any incidental charges, damages, or policy violations discovered during or after your stay.')

  sections.push('DAMAGES\nGuests are responsible for any damage to their room, furnishings, linens, or property caused during their stay beyond normal wear and tear. Damage will be assessed after checkout, and charges will be applied to the card on file. We will make reasonable efforts to notify you of any damage charges and provide documentation.')

  sections.push('SMOKING\nSmoking (including e-cigarettes and vaporizers) is strictly prohibited inside all rooms and indoor common areas. A cleaning fee of $[amount] will be charged for evidence of indoor smoking. [Update this amount based on your property.]')

  sections.push('LOST KEYS & ACCESS\nLost room keys or access cards will incur a replacement fee of $[amount]. Please notify the front desk immediately if you lose your key. [Update this amount based on your property.]')

  sections.push('EARLY DEPARTURE\nGuests who depart before their scheduled check-out date are not entitled to a refund for unused nights unless covered by the cancellation policy.')

  return sections.join('\n\n')
}

function generateMarketing(name) {
  const sections = []

  sections.push(`MARKETING & COMMUNICATIONS POLICY — ${name.toUpperCase()}`)
  sections.push(`${name} values your privacy. By opting in to marketing communications, you agree to the following:`)

  sections.push('WHAT YOU WILL RECEIVE\nOccasional emails about seasonal promotions, special rates, property updates, and local events. We typically send no more than 1–2 emails per month.')

  sections.push('OPT-IN & OPT-OUT\nMarketing communications are entirely optional. You may opt in at the time of booking. You can unsubscribe at any time by clicking the "unsubscribe" link in any marketing email, or by contacting us directly. Unsubscribing from marketing emails will not affect transactional emails related to your reservation (confirmations, receipts, check-in instructions).')

  sections.push('DATA USE\nYour email address and name are used solely for the purpose of sending communications you have consented to. We do not sell, rent, or share your personal information with third parties for marketing purposes.')

  sections.push('DATA RETENTION\nWe retain your contact information for as long as you remain subscribed. Upon unsubscribing, your information will be removed from our marketing lists within 30 days. Reservation records are retained separately for business and legal purposes.')

  return sections.join('\n\n')
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
    tax_rate: 0, cleaning_fee_dollars: '0.00',
    pet_fee_dollars: '0.00', pet_fee_type: 'flat', pass_through_stripe_fee: false,
    cancellation_fee_type: 'none', cancellation_fee_dollars: '0.00',
  })

  // Cancellation tiers state (strings for clean input behavior)
  const [cancellationTiers, setCancellationTiers] = useState([
    { days_before: '14', refund_percent: '100' },
    { days_before: '0', refund_percent: '0' },
  ])

  // Policies tab state
  const [policies, setPolicies] = useState({
    terms_and_conditions: '', cancellation_policy_text: '',
    pet_policy: '', incidental_policy: '', marketing_policy: '',
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
        cleaning_fee_dollars: settings.cleaning_fee_cents != null ? (settings.cleaning_fee_cents / 100).toFixed(2) : '0.00',
        pet_fee_dollars: settings.pet_fee_cents != null ? (settings.pet_fee_cents / 100).toFixed(2) : '0.00',
        pet_fee_type: settings.pet_fee_type ?? 'flat',
        pass_through_stripe_fee: settings.pass_through_stripe_fee ?? false,
        cancellation_fee_type: settings.cancellation_fee_type ?? 'none',
        cancellation_fee_dollars: settings.cancellation_fee_cents != null ? (settings.cancellation_fee_cents / 100).toFixed(2) : '0.00',
      })
      if (settings.cancellation_tiers?.length) {
        setCancellationTiers(settings.cancellation_tiers.map(t => ({
          days_before: String(t.days_before),
          refund_percent: String(t.refund_percent),
        })))
      }
      setPolicies({
        terms_and_conditions: settings.terms_and_conditions ?? '',
        cancellation_policy_text: settings.cancellation_policy_text ?? '',
        pet_policy: settings.pet_policy ?? '',
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

  async function saveSettings(updates) {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('settings')
        .update(updates)
        .eq('property_id', propertyId)
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
      <h1 className="font-heading text-[24px] sm:text-[32px] text-text-primary uppercase">Settings</h1>

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              onClick={() => saveSettings(checkinout)}
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
            <SectionHeader>Cancellation Policy</SectionHeader>
            <p className="font-body text-[14px] text-text-secondary -mt-3">
              Define your refund schedule. Each row sets the refund for cancellations made within that window.
            </p>
            <div className="flex flex-col gap-3">
              {[...cancellationTiers]
                .sort((a, b) => Number(b.days_before) - Number(a.days_before))
                .map((tier) => {
                  const days = Number(tier.days_before)
                  const origIdx = cancellationTiers.indexOf(tier)
                  return (
                    <div key={origIdx} className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-body text-[14px] text-text-secondary whitespace-nowrap">Cancel</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={tier.days_before}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '')
                            setCancellationTiers(prev => prev.map((t, j) => j === origIdx ? { ...t, days_before: raw } : t))
                          }}
                          className="h-11 w-14 border-[1.5px] border-border rounded-[6px] px-2 font-mono text-[15px] text-text-primary bg-surface-raised text-center focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
                        />
                        <span className="font-body text-[14px] text-text-secondary whitespace-nowrap">
                          {days === 1 ? 'day' : 'days'} or more before
                        </span>
                      </div>
                      <span className="font-body text-[14px] text-text-muted hidden sm:inline">&rarr;</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={tier.refund_percent}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '')
                            const clamped = raw === '' ? '' : String(Math.min(100, Number(raw)))
                            setCancellationTiers(prev => prev.map((t, j) => j === origIdx ? { ...t, refund_percent: clamped } : t))
                          }}
                          className="h-11 w-14 border-[1.5px] border-border rounded-[6px] px-2 font-mono text-[15px] text-text-primary bg-surface-raised text-center focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
                        />
                        <span className="font-body text-[14px] text-text-secondary">% refund</span>
                      </div>
                      {cancellationTiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setCancellationTiers(prev => prev.filter((_, j) => j !== origIdx))}
                          className="h-11 w-11 flex items-center justify-center text-text-muted hover:text-danger transition-colors rounded-[6px] hover:bg-danger-bg shrink-0"
                          aria-label="Remove tier"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>
            <button
              type="button"
              onClick={() => setCancellationTiers(prev => {
                const lowestDays = Math.min(...prev.map(t => Number(t.days_before)))
                const newDays = Math.max(0, lowestDays > 0 ? Math.floor(lowestDays / 2) : 0)
                return [...prev, { days_before: String(newDays), refund_percent: '0' }]
              })}
              className="self-start font-body text-[14px] text-info hover:underline"
            >
              + Add tier
            </button>
            {cancellationTiers.length > 0 && (
              <div className="border border-border rounded-[6px] bg-surface px-4 py-3">
                <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-2">What your guests will see</p>
                <ul className="flex flex-col gap-1.5">
                  {[...cancellationTiers]
                    .sort((a, b) => Number(b.days_before) - Number(a.days_before))
                    .map((tier, i, sorted) => {
                      const days = Number(tier.days_before)
                      const pct = Number(tier.refund_percent)
                      const prevTier = sorted[i - 1]
                      let rangeText
                      if (i === 0 && !prevTier) {
                        rangeText = days === 0 ? 'Any time' : `${days}+ days before check-in`
                      } else {
                        const upper = Number(prevTier.days_before) - 1
                        rangeText = days === 0
                          ? `Less than ${Number(prevTier.days_before)} days before check-in`
                          : `${days}–${upper} days before check-in`
                      }
                      return (
                        <li key={i} className="font-body text-[14px] text-text-primary flex items-baseline gap-2">
                          <span className={cn(
                            'font-mono text-[14px] font-semibold min-w-[90px]',
                            pct === 100 ? 'text-success' : pct === 0 ? 'text-danger' : 'text-warning'
                          )}>
                            {pct === 0 ? 'No refund' : `${pct}% refund`}
                          </span>
                          <span className="text-text-secondary">{rangeText}</span>
                        </li>
                      )
                    })
                  }
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <span className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary flex items-center gap-1.5">
                Cancellation Fee
                <HelpTip text="Deducted from the refund amount when a guest cancels. This covers your costs for processing fees, lost opportunity, and administrative time." />
              </span>
              <div className="flex flex-col gap-2">
                {[
                  { value: 'none', label: 'No cancellation fee — full refund per tier above' },
                  { value: 'processing', label: 'Deduct card processing fee (2.9% + $0.30)' },
                  { value: 'flat', label: 'Flat fee per room' },
                  { value: 'both', label: 'Flat fee per room + processing fee' },
                ].map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cancellation_fee_type"
                      value={value}
                      checked={taxPolicy.cancellation_fee_type === value}
                      onChange={() => setTaxPolicy((t) => ({ ...t, cancellation_fee_type: value }))}
                      className="accent-info w-4 h-4"
                    />
                    <span className="font-body text-[14px] text-text-primary">{label}</span>
                  </label>
                ))}
              </div>
              {(taxPolicy.cancellation_fee_type === 'flat' || taxPolicy.cancellation_fee_type === 'both') && (
                <div className="flex items-center gap-2 mt-1 ml-6">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={taxPolicy.cancellation_fee_dollars}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, '')
                        setTaxPolicy((t) => ({ ...t, cancellation_fee_dollars: raw }))
                      }}
                      className="h-11 w-24 border-[1.5px] border-border rounded-[6px] pl-7 pr-3 font-mono text-[15px] text-text-primary bg-surface-raised focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
                    />
                  </div>
                  <span className="font-body text-[14px] text-text-secondary">per room</span>
                </div>
              )}
            </div>
            <SectionHeader>Optional Fees</SectionHeader>
            <p className="font-body text-[14px] text-text-secondary -mt-3">
              These are added to the guest's booking total. Leave at $0 to skip.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label htmlFor="settings-cleaning-fee" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                  Cleaning Fee
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">$</span>
                  <input
                    id="settings-cleaning-fee"
                    type="text"
                    inputMode="decimal"
                    value={taxPolicy.cleaning_fee_dollars}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '')
                      setTaxPolicy((t) => ({ ...t, cleaning_fee_dollars: raw }))
                    }}
                    className="h-11 border-[1.5px] border-border rounded-[6px] pl-7 pr-3 font-mono text-[15px] text-text-primary bg-surface-raised w-full focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
                  />
                </div>
                <p className="mt-1 font-body text-[12px] text-text-muted">Per reservation</p>
              </div>
              <div className="flex flex-col">
                <label htmlFor="settings-pet-fee" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
                  Pet Fee
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">$</span>
                  <input
                    id="settings-pet-fee"
                    type="text"
                    inputMode="decimal"
                    value={taxPolicy.pet_fee_dollars}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '')
                      setTaxPolicy((t) => ({ ...t, pet_fee_dollars: raw }))
                    }}
                    className="h-11 border-[1.5px] border-border rounded-[6px] pl-7 pr-3 font-mono text-[15px] text-text-primary bg-surface-raised w-full focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
                  />
                </div>
                <p className="mt-1 font-body text-[12px] text-text-muted">
                  {taxPolicy.pet_fee_type === 'flat' ? 'One-time' : 'Per night'} · <button type="button" className="text-info hover:underline" onClick={() => setTaxPolicy((t) => ({ ...t, pet_fee_type: t.pet_fee_type === 'flat' ? 'per_night' : 'flat' }))}>{taxPolicy.pet_fee_type === 'flat' ? 'Switch to per night' : 'Switch to one-time'}</button>
                </p>
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
              onClick={() => saveSettings({
                tax_rate: taxPolicy.tax_rate,
                cancellation_tiers: [...cancellationTiers]
                  .map(t => ({ days_before: Number(t.days_before) || 0, refund_percent: Number(t.refund_percent) || 0 }))
                  .sort((a, b) => b.days_before - a.days_before),
                cancellation_fee_type: taxPolicy.cancellation_fee_type,
                cancellation_fee_cents: Math.round(Number(taxPolicy.cancellation_fee_dollars || 0) * 100),
                cleaning_fee_cents: Math.round(Number(taxPolicy.cleaning_fee_dollars || 0) * 100),
                pet_fee_cents: Math.round(Number(taxPolicy.pet_fee_dollars || 0) * 100),
                pet_fee_type: taxPolicy.pet_fee_type,
                pass_through_stripe_fee: taxPolicy.pass_through_stripe_fee,
              })}
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

            {/* Legal disclaimer banner */}
            <div className="border border-info/30 bg-info-bg rounded-[6px] px-4 py-3 -mt-2">
              <p className="font-body text-[13px] text-info leading-relaxed">
                Generated policies are starting-point templates based on your settings. <strong>You must review, customize, and verify all policy text before publishing.</strong> Lodge-ical provides these templates for convenience only — they do not constitute legal advice, and Lodge-ical is not liable for their content or accuracy. Consult a licensed attorney familiar with your jurisdiction's hospitality regulations to ensure compliance.
              </p>
            </div>

            <p className="font-body text-[14px] text-text-secondary -mt-1">
              Guests must accept these policies before completing a booking. Leave blank to skip a policy.
            </p>

            <button
              type="button"
              onClick={() => {
                const name = property.name || 'our property'
                setPolicies({
                  terms_and_conditions: generateTerms(name, checkinout, taxPolicy),
                  cancellation_policy_text: generateCancellation(name, cancellationTiers, taxPolicy),
                  pet_policy: generatePetPolicy(name, taxPolicy),
                  incidental_policy: generateIncidental(name),
                  marketing_policy: generateMarketing(name),
                })
              }}
              className="self-start font-body text-[14px] font-semibold text-info hover:underline"
            >
              Generate all policies from your settings
            </button>

            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="settings-terms" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
                  Terms & Conditions
                </label>
                <button
                  type="button"
                  onClick={() => setPolicies((p) => ({ ...p, terms_and_conditions: generateTerms(property.name || 'our property', checkinout, taxPolicy) }))}
                  className="font-body text-[13px] text-info hover:underline"
                >
                  Generate
                </button>
              </div>
              <textarea
                id="settings-terms"
                rows={8}
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
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="settings-cancellation-text" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
                  Cancellation Policy
                </label>
                <button
                  type="button"
                  onClick={() => setPolicies((p) => ({ ...p, cancellation_policy_text: generateCancellation(property.name || 'our property', cancellationTiers, taxPolicy) }))}
                  className="font-body text-[13px] text-info hover:underline"
                >
                  Generate
                </button>
              </div>
              <textarea
                id="settings-cancellation-text"
                rows={6}
                value={policies.cancellation_policy_text}
                onChange={(e) => setPolicies((p) => ({ ...p, cancellation_policy_text: e.target.value }))}
                placeholder="Your cancellation policy text shown to guests..."
                className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[14px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-y"
              />
              <p className="mt-1 font-body text-[12px] text-text-muted">
                {policies.cancellation_policy_text.length} characters · Shown to guests before booking and in confirmation emails
              </p>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="settings-pet-policy" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
                  Pet & Animal Policy
                </label>
                <button
                  type="button"
                  onClick={() => setPolicies((p) => ({ ...p, pet_policy: generatePetPolicy(property.name || 'our property', taxPolicy) }))}
                  className="font-body text-[13px] text-info hover:underline"
                >
                  Generate
                </button>
              </div>
              <textarea
                id="settings-pet-policy"
                rows={5}
                value={policies.pet_policy}
                onChange={(e) => setPolicies((p) => ({ ...p, pet_policy: e.target.value }))}
                placeholder="Are pets allowed? Which types? Any size limits? Service animals? Fees and rules..."
                className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[14px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-y"
              />
              <p className="mt-1 font-body text-[12px] text-text-muted">
                {policies.pet_policy.length} characters · Guests check this to see if they can bring pets
              </p>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="settings-incidental" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
                  Incidental Policy
                </label>
                <button
                  type="button"
                  onClick={() => setPolicies((p) => ({ ...p, incidental_policy: generateIncidental(property.name || 'our property') }))}
                  className="font-body text-[13px] text-info hover:underline"
                >
                  Generate
                </button>
              </div>
              <textarea
                id="settings-incidental"
                rows={5}
                value={policies.incidental_policy}
                onChange={(e) => setPolicies((p) => ({ ...p, incidental_policy: e.target.value }))}
                placeholder="Policy for incidental charges, damages, etc..."
                className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[14px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-y"
              />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="settings-marketing" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
                  Marketing Policy
                </label>
                <button
                  type="button"
                  onClick={() => setPolicies((p) => ({ ...p, marketing_policy: generateMarketing(property.name || 'our property') }))}
                  className="font-body text-[13px] text-info hover:underline"
                >
                  Generate
                </button>
              </div>
              <textarea
                id="settings-marketing"
                rows={5}
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

