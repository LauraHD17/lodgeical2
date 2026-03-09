// src/components/reservations/ReservationModal.jsx
// Multi-step modal for creating / editing reservations.
// Steps: 1=Dates, 2=Rooms, 3=Guest, 4=Fees, 5=Review

import { useState, useEffect, useCallback } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { format, differenceInCalendarDays, isWithinInterval, parseISO } from 'date-fns'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, ArrowLeft, ArrowRight } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import * as Switch from '@radix-ui/react-switch'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FolderCard } from '@/components/shared/FolderCard'
import { ConflictBanner } from './ConflictBanner'
import { useRooms, useRoomLinks } from '@/hooks/useRooms'
import { useGuestByEmail } from '@/hooks/useGuests'
import { useCreateReservation, useUpdateReservation } from '@/hooks/useReservations'
import { useToast } from '@/components/ui/useToast'
import { cn } from '@/lib/utils'

function usePropertyFeeSettings() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['property-fee-settings', propertyId],
    queryFn: async () => {
      if (!propertyId) return null
      const [propRes, settingsRes] = await Promise.all([
        supabase.from('properties').select('cleaning_fee_cents, pet_fee_cents, pet_fee_type').eq('id', propertyId).single(),
        supabase.from('settings').select('tax_rate, pass_through_stripe_fee').eq('property_id', propertyId).maybeSingle(),
      ])
      return {
        cleaning_fee_cents: propRes.data?.cleaning_fee_cents ?? 0,
        pet_fee_cents: propRes.data?.pet_fee_cents ?? 0,
        pet_fee_type: propRes.data?.pet_fee_type ?? 'flat',
        tax_rate: settingsRes.data?.tax_rate ?? 0,
        pass_through_stripe_fee: settingsRes.data?.pass_through_stripe_fee ?? false,
      }
    },
    enabled: !!propertyId,
  })
}

const STEPS = ['Dates', 'Rooms', 'Guest', 'Fees', 'Review']

const guestSchema = z.object({
  email: z.string().email('Valid email required'),
  first_name: z.string().min(1, 'First name required'),
  last_name: z.string().min(1, 'Last name required'),
  phone: z.string().optional(),
  num_guests: z.coerce.number().min(1, 'At least 1 guest'),
  notes: z.string().optional(),
})

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, idx) => {
        const stepNum = idx + 1
        const isDone = stepNum < currentStep
        const isActive = stepNum === currentStep
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold font-body transition-colors',
                  isDone && 'bg-success text-white',
                  isActive && 'bg-text-primary text-white',
                  !isDone && !isActive && 'bg-border text-text-muted'
                )}
              >
                {isDone ? <CheckCircle size={16} weight="fill" /> : stepNum}
              </div>
              <span
                className={cn(
                  'text-[11px] font-body mt-1 whitespace-nowrap',
                  isActive ? 'text-text-primary font-semibold' : 'text-text-muted'
                )}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-[2px] w-12 mx-1 mb-5 transition-colors',
                  stepNum < currentStep ? 'bg-success' : 'bg-border'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Step1Dates({ checkIn, checkOut, onSelect, bookedRanges = [], minStay = 1 }) {
  const nights = checkIn && checkOut ? differenceInCalendarDays(checkOut, checkIn) : 0

  function isBooked(day) {
    return bookedRanges.some((range) => {
      try {
        return isWithinInterval(day, {
          start: typeof range.start === 'string' ? parseISO(range.start) : range.start,
          end: typeof range.end === 'string' ? parseISO(range.end) : range.end,
        })
      } catch (err) {
        console.warn('[isBooked] invalid date range skipped:', range, err)
        return false
      }
    })
  }

  const selected = checkIn && checkOut ? { from: checkIn, to: checkOut } : checkIn ? { from: checkIn } : undefined

  return (
    <div>
      <h3 className="font-body font-semibold text-[16px] text-text-primary mb-4">
        Select check-in & check-out dates
      </h3>
      <div className="flex justify-center">
        <DayPicker
          mode="range"
          selected={selected}
          onSelect={(range) => {
            if (!range) {
              onSelect(null, null)
              return
            }
            onSelect(range.from ?? null, range.to ?? null)
          }}
          numberOfMonths={2}
          disabled={[{ before: new Date() }, isBooked]}
          fromDate={new Date()}
        />
      </div>
      {checkIn && checkOut && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-info-bg border border-info rounded-[6px]">
          <span className="font-body text-[14px] text-info">
            {format(checkIn, 'MMM d, yyyy')} → {format(checkOut, 'MMM d, yyyy')}
          </span>
          <span className="font-mono text-[14px] text-info font-semibold ml-auto">
            {nights} {nights === 1 ? 'night' : 'nights'}
          </span>
        </div>
      )}
      {minStay > 1 && nights > 0 && nights < minStay && (
        <p className="mt-2 text-[13px] text-danger font-body">
          Minimum stay is {minStay} nights
        </p>
      )}
    </div>
  )
}

function Step2Rooms({ rooms = [], roomLinks = [], selectedRoomIds, onToggle, onSelectLink, activeLink }) {
  const totalCents = activeLink
    ? (activeLink.base_rate_cents ?? 0)
    : rooms.filter((r) => selectedRoomIds.includes(r.id)).reduce((sum, r) => sum + (r.base_rate_cents ?? 0), 0)

  // Rooms that are part of the active link are grayed out
  const linkMemberIds = activeLink ? (activeLink.linked_room_ids ?? []) : []

  return (
    <div>
      <h3 className="font-body font-semibold text-[16px] text-text-primary mb-4">
        Select room(s)
      </h3>

      {/* Room Links */}
      {roomLinks.length > 0 && (
        <div className="mb-4">
          <p className="font-body text-[12px] text-text-muted uppercase tracking-[0.06em] font-semibold mb-2">Combined Rooms</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {roomLinks.map((link) => {
              const isSelected = activeLink?.id === link.id
              const memberNames = (link.linked_room_ids ?? []).map(id => rooms.find(r => r.id === id)?.name ?? '?').join(' + ')
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => onSelectLink(isSelected ? null : link)}
                  className={cn(
                    'text-left transition-all rounded-[8px] border p-4',
                    isSelected ? 'ring-2 ring-info border-info bg-info-bg' : 'border-border bg-surface-raised hover:border-info'
                  )}
                >
                  <p className="font-body font-semibold text-[14px] text-text-primary">{link.name}</p>
                  <p className="font-body text-[12px] text-text-secondary mt-0.5">{memberNames}</p>
                  <p className="font-mono text-[14px] text-text-primary mt-1">
                    ${((link.base_rate_cents ?? 0) / 100).toFixed(2)} / night
                  </p>
                  <p className="font-body text-[12px] text-text-muted mt-0.5">Max {link.max_guests} guests</p>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 mt-2 text-[12px] font-semibold text-info font-body">
                      <CheckCircle size={14} weight="fill" /> Selected
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {rooms.length === 0 && (
        <p className="text-text-muted font-body text-[14px]">No rooms found.</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rooms.map((room) => {
          const isSelected = selectedRoomIds.includes(room.id)
          const isPartOfLink = linkMemberIds.includes(room.id)
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => !isPartOfLink && onToggle(room.id)}
              disabled={isPartOfLink}
              className={cn(
                'text-left transition-all',
                isSelected && 'ring-2 ring-info rounded-[8px]',
                isPartOfLink && 'opacity-40 cursor-not-allowed'
              )}
            >
              <FolderCard
                tabLabel={room.name}
                color={isSelected ? 'info' : 'primary'}
                className="w-full"
              >
                <p className="font-body text-[13px] text-text-secondary capitalize">
                  {room.type ?? 'Room'}
                </p>
                <p className="font-mono text-[14px] text-text-primary mt-1">
                  ${((room.base_rate_cents ?? 0) / 100).toFixed(2)} / night
                </p>
                <p className="font-body text-[13px] text-text-muted mt-1">
                  Max {room.max_guests ?? 2} guests
                </p>
                {isSelected && (
                  <span className="inline-flex items-center gap-1 mt-2 text-[12px] font-semibold text-info font-body">
                    <CheckCircle size={14} weight="fill" /> Selected
                  </span>
                )}
                {isPartOfLink && (
                  <span className="inline-flex items-center gap-1 mt-2 text-[12px] text-text-muted font-body">
                    Included in {activeLink.name}
                  </span>
                )}
              </FolderCard>
            </button>
          )
        })}
      </div>
      {selectedRoomIds.length > 0 && (
        <div className="mt-4 flex items-center justify-between p-3 bg-surface border border-border rounded-[6px]">
          <span className="font-body text-[14px] text-text-secondary">
            {activeLink ? activeLink.name : `${selectedRoomIds.length} room${selectedRoomIds.length > 1 ? 's' : ''}`} selected
          </span>
          <span className="font-mono text-[14px] text-text-primary font-semibold">
            ${(totalCents / 100).toFixed(2)} / night
          </span>
        </div>
      )}
    </div>
  )
}

function Step3Guest({ form, maxGuests, emailDebounced }) {
  const { data: existingGuest } = useGuestByEmail(emailDebounced)
  const { register, setValue, watch, formState: { errors } } = form
  const numGuests = watch('num_guests')

  useEffect(() => {
    if (existingGuest) {
      setValue('first_name', existingGuest.first_name ?? '')
      setValue('last_name', existingGuest.last_name ?? '')
      setValue('phone', existingGuest.phone ?? '')
    }
  }, [existingGuest, setValue])

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-body font-semibold text-[16px] text-text-primary">
        Guest information
      </h3>

      <Input
        label="Email"
        id="email"
        type="email"
        placeholder="guest@example.com"
        error={errors.email?.message}
        {...register('email')}
      />

      {existingGuest && (
        <div className="flex items-center gap-2 p-3 bg-success-bg border border-success rounded-[6px]">
          <span className="font-body text-[13px] text-success">
            Existing guest: {existingGuest.first_name} {existingGuest.last_name}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First Name"
          id="first_name"
          error={errors.first_name?.message}
          {...register('first_name')}
        />
        <Input
          label="Last Name"
          id="last_name"
          error={errors.last_name?.message}
          {...register('last_name')}
        />
      </div>

      <Input
        label="Phone"
        id="phone"
        type="tel"
        placeholder="+1 (555) 000-0000"
        error={errors.phone?.message}
        {...register('phone')}
      />

      <div>
        <Input
          label={`Number of Guests (max ${maxGuests})`}
          id="num_guests"
          type="number"
          min={1}
          max={maxGuests}
          error={errors.num_guests?.message || (numGuests > maxGuests ? `Max ${maxGuests} guests for selected rooms` : undefined)}
          {...register('num_guests')}
        />
      </div>

      <div className="flex flex-col">
        <label
          htmlFor="notes"
          className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1"
        >
          Notes
        </label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Any special requests or notes..."
          className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 resize-none"
          {...register('notes')}
        />
      </div>
    </div>
  )
}

function Step4Review({ checkIn, checkOut, selectedRooms, guestData, nights, onSubmit, loading, conflict, error, feesData, propertySettings }) {
  const nightlyTotal = selectedRooms.reduce((sum, r) => sum + (r.base_rate_cents ?? 0), 0)
  const nightsSubtotalCents = nightlyTotal * nights

  const cleaningFee = effectiveCleaningFee(selectedRooms, propertySettings)
  const cleaningFeeApplied = feesData?.cleaningFeeWaived ? 0 : cleaningFee

  const petFeeRate = effectivePetFee(selectedRooms, propertySettings)
  const petFeeType = propertySettings?.pet_fee_type ?? 'flat'
  const petFeeTotal = feesData?.petFeeApplied ? (petFeeType === 'per_night' ? petFeeRate * nights : petFeeRate) : 0

  const miscFeeCents = feesData?.miscFeeCents ?? 0

  const taxRate = propertySettings?.tax_rate ?? 0
  const preTaxSubtotal = nightsSubtotalCents + cleaningFeeApplied + petFeeTotal + miscFeeCents
  const taxAmount = feesData?.taxExempt ? 0 : Math.round(preTaxSubtotal * taxRate / 100)

  const passThroughStripe = propertySettings?.pass_through_stripe_fee ?? false
  const preFeeCents = preTaxSubtotal + taxAmount
  const STRIPE_FIXED = 30
  const STRIPE_PCT = 0.029
  const stripeFee = passThroughStripe ? Math.ceil((preFeeCents + STRIPE_FIXED) / (1 - STRIPE_PCT)) - preFeeCents : 0
  const totalCents = preFeeCents + stripeFee

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-body font-semibold text-[16px] text-text-primary">
        Review & confirm
      </h3>

      <div className="bg-surface border border-border rounded-[8px] p-4 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="font-body text-[14px] text-text-secondary">Check-in</span>
          <span className="font-mono text-[14px] text-text-primary">
            {checkIn ? format(checkIn, 'MMM d, yyyy') : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-body text-[14px] text-text-secondary">Check-out</span>
          <span className="font-mono text-[14px] text-text-primary">
            {checkOut ? format(checkOut, 'MMM d, yyyy') : '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-body text-[14px] text-text-secondary">Nights</span>
          <span className="font-mono text-[14px] text-text-primary">{nights}</span>
        </div>
        <div className="border-t border-border pt-3">
          <span className="font-body text-[13px] text-text-secondary uppercase tracking-wider font-semibold">Rooms</span>
          {selectedRooms.map((r) => (
            <div key={r.id} className="flex justify-between mt-2">
              <span className="font-body text-[14px] text-text-primary">{r.name}</span>
              <span className="font-mono text-[14px] text-text-secondary">
                ${((r.base_rate_cents ?? 0) / 100).toFixed(2)}/night
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-3 flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-body text-[14px] text-text-secondary">Nightly subtotal ({nights} nights)</span>
            <span className="font-mono text-[14px] text-text-primary">
              ${(nightsSubtotalCents / 100).toFixed(2)}
            </span>
          </div>
          {cleaningFee > 0 && (
            <div className="flex justify-between items-center">
              <span className="font-body text-[14px] text-text-secondary">
                Cleaning fee
                {feesData?.cleaningFeeWaived && (
                  <span className="ml-1 font-body text-[12px] text-warning">(waived)</span>
                )}
              </span>
              <span className={cn('font-mono text-[14px]', feesData?.cleaningFeeWaived ? 'text-text-muted line-through' : 'text-text-primary')}>
                ${(cleaningFee / 100).toFixed(2)}
              </span>
            </div>
          )}
          {feesData?.petFeeApplied && petFeeTotal > 0 && (
            <div className="flex justify-between items-center">
              <span className="font-body text-[14px] text-text-secondary">
                Pet fee {petFeeType === 'per_night' ? `(${nights} nights)` : '(one-time)'}
              </span>
              <span className="font-mono text-[14px] text-text-primary">${(petFeeTotal / 100).toFixed(2)}</span>
            </div>
          )}
          {miscFeeCents > 0 && (
            <div className="flex justify-between items-center">
              <span className="font-body text-[14px] text-text-secondary">
                {feesData?.miscFeeLabel || 'Additional fee'}
              </span>
              <span className="font-mono text-[14px] text-text-primary">${(miscFeeCents / 100).toFixed(2)}</span>
            </div>
          )}
          {taxRate > 0 && (
            <div className="flex justify-between items-center">
              <span className="font-body text-[14px] text-text-secondary">
                Tax ({taxRate}%)
                {feesData?.taxExempt && (
                  <span className="ml-1 font-body text-[12px] text-success">(exempt)</span>
                )}
              </span>
              <span className={cn('font-mono text-[14px]', feesData?.taxExempt ? 'text-text-muted line-through' : 'text-text-primary')}>
                ${(Math.round(preTaxSubtotal * taxRate / 100) / 100).toFixed(2)}
              </span>
            </div>
          )}
          {stripeFee > 0 && (
            <div className="flex justify-between items-center">
              <span className="font-body text-[14px] text-text-secondary">Processing fee (Stripe)</span>
              <span className="font-mono text-[14px] text-text-primary">${(stripeFee / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center border-t border-border pt-2 mt-1">
            <span className="font-body font-semibold text-[15px] text-text-primary">Total</span>
            <span className="font-mono font-semibold text-[16px] text-text-primary">${(totalCents / 100).toFixed(2)}</span>
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <span className="font-body text-[13px] text-text-secondary uppercase tracking-wider font-semibold">Guest</span>
          <p className="font-body text-[14px] text-text-primary mt-1">
            {guestData.first_name} {guestData.last_name}
          </p>
          <p className="font-body text-[13px] text-text-secondary">{guestData.email}</p>
          {guestData.num_guests && (
            <p className="font-body text-[13px] text-text-muted">{guestData.num_guests} guest(s)</p>
          )}
        </div>
      </div>

      {conflict && <ConflictBanner conflictingIds={conflict} />}

      {error && !conflict && (
        <div className="bg-danger-bg border border-danger rounded-[6px] p-3">
          <p className="font-body text-[14px] text-danger">{error}</p>
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        loading={loading}
        onClick={onSubmit}
        className="w-full"
      >
        Confirm Reservation
      </Button>
    </div>
  )
}

function effectiveCleaningFee(selectedRooms, propertySettings) {
  return selectedRooms.reduce((sum, r) => {
    const roomFee = r.cleaning_fee_cents != null ? r.cleaning_fee_cents : (propertySettings?.cleaning_fee_cents ?? 0)
    return sum + roomFee
  }, 0)
}

function effectivePetFee(selectedRooms, propertySettings) {
  const petRoom = selectedRooms.find((r) => r.allows_pets)
  if (!petRoom) return 0
  return petRoom.pet_fee_cents != null ? petRoom.pet_fee_cents : (propertySettings?.pet_fee_cents ?? 0)
}

function Step4Fees({ selectedRooms, nights, propertySettings, feesData, onFeesChange }) {
  const cleaningFee = effectiveCleaningFee(selectedRooms, propertySettings)
  const anyRoomAllowsPets = selectedRooms.some((r) => r.allows_pets)
  const petFeeRate = effectivePetFee(selectedRooms, propertySettings)
  const petFeeType = propertySettings?.pet_fee_type ?? 'flat'

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-body font-semibold text-[16px] text-text-primary">
        Fees & Tax
      </h3>

      {/* Cleaning fee */}
      {cleaningFee > 0 && (
        <div className="border border-border rounded-[8px] p-4 flex flex-col gap-3 bg-surface">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body font-semibold text-[15px] text-text-primary">Cleaning Fee</p>
              <p className="font-mono text-[14px] text-text-secondary">${(cleaningFee / 100).toFixed(2)} (one-time)</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch.Root
                checked={feesData.cleaningFeeWaived}
                onCheckedChange={(v) => onFeesChange({ cleaningFeeWaived: v })}
                className={cn('w-10 h-6 rounded-full transition-colors', feesData.cleaningFeeWaived ? 'bg-warning' : 'bg-success')}
              >
                <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
              </Switch.Root>
              <span className="font-body text-[13px] text-text-secondary w-14">
                {feesData.cleaningFeeWaived ? 'Waived' : 'Applied'}
              </span>
            </div>
          </div>
          {feesData.cleaningFeeWaived && (
            <Input
              label="Waive reason (optional)"
              placeholder="e.g. Long-stay discount, loyalty comp"
              value={feesData.cleaningFeeWaiveReason}
              onChange={(e) => onFeesChange({ cleaningFeeWaiveReason: e.target.value })}
            />
          )}
        </div>
      )}

      {/* Pet fee */}
      {anyRoomAllowsPets && (
        <div className="border border-border rounded-[8px] p-4 flex flex-col gap-2 bg-surface">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body font-semibold text-[15px] text-text-primary">Pet Fee</p>
              {petFeeRate > 0 ? (
                <p className="font-mono text-[14px] text-text-secondary">
                  ${(petFeeRate / 100).toFixed(2)}
                  {petFeeType === 'per_night' ? ` × ${nights} night${nights !== 1 ? 's' : ''}` : ' (one-time)'}
                </p>
              ) : (
                <p className="font-body text-[13px] text-text-muted">No fee amount configured</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch.Root
                checked={feesData.petFeeApplied}
                onCheckedChange={(v) => onFeesChange({ petFeeApplied: v })}
                className={cn('w-10 h-6 rounded-full transition-colors', feesData.petFeeApplied ? 'bg-info' : 'bg-border')}
              >
                <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
              </Switch.Root>
              <span className="font-body text-[13px] text-text-secondary w-20">
                {feesData.petFeeApplied ? 'Applied' : 'Not applied'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Misc fee */}
      <div className="border border-border rounded-[8px] p-4 flex flex-col gap-3 bg-surface">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-body font-semibold text-[15px] text-text-primary">Additional Fee</p>
            <p className="font-body text-[13px] text-text-muted">Add a custom one-time fee (e.g. event setup, extra linens)</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch.Root
              checked={feesData.miscFeeEnabled}
              onCheckedChange={(v) => {
                onFeesChange({ miscFeeEnabled: v })
                if (!v) onFeesChange({ miscFeeEnabled: false, miscFeeCents: 0, miscFeeLabel: '' })
              }}
              className={cn('w-10 h-6 rounded-full transition-colors', feesData.miscFeeEnabled ? 'bg-info' : 'bg-border')}
            >
              <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
            </Switch.Root>
            <span className="font-body text-[13px] text-text-secondary w-20">
              {feesData.miscFeeEnabled ? 'Applied' : 'Not applied'}
            </span>
          </div>
        </div>
        {feesData.miscFeeEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Fee label"
              placeholder="e.g. Event setup fee"
              value={feesData.miscFeeLabel}
              onChange={(e) => onFeesChange({ miscFeeLabel: e.target.value })}
            />
            <Input
              label="Amount ($)"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={feesData.miscFeeDollars}
              onChange={(e) => {
                const dollars = e.target.value
                onFeesChange({ miscFeeDollars: dollars, miscFeeCents: Math.round(parseFloat(dollars || '0') * 100) })
              }}
            />
          </div>
        )}
      </div>

      {/* Tax exempt */}
      <div className="border border-border rounded-[8px] p-4 flex flex-col gap-3 bg-surface">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-body font-semibold text-[15px] text-text-primary">Tax Exempt</p>
            <p className="font-body text-[13px] text-text-muted">State & local tax waived</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch.Root
              checked={feesData.taxExempt}
              onCheckedChange={(v) => onFeesChange({ taxExempt: v })}
              className={cn('w-10 h-6 rounded-full transition-colors', feesData.taxExempt ? 'bg-success' : 'bg-border')}
            >
              <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transition-transform translate-x-1 data-[state=checked]:translate-x-5" />
            </Switch.Root>
            <span className="font-body text-[13px] text-text-secondary w-20">
              {feesData.taxExempt ? 'Exempt' : 'Standard'}
            </span>
          </div>
        </div>
        {feesData.taxExempt && (
          <Input
            label="Organization name / cert # (optional)"
            placeholder="e.g. American Red Cross or cert #12345"
            value={feesData.taxExemptOrg}
            onChange={(e) => onFeesChange({ taxExemptOrg: e.target.value })}
          />
        )}
      </div>

      {cleaningFee === 0 && !anyRoomAllowsPets && (
        <p className="font-body text-[14px] text-text-muted text-center py-2">
          No cleaning or pet fees configured for the selected room(s). You can still mark this reservation as tax-exempt above.
        </p>
      )}
    </div>
  )
}

export function ReservationModal({ open, onClose, reservationToEdit, defaultCheckIn }) {
  const [step, setStep] = useState(1)
  const [checkIn, setCheckIn] = useState(defaultCheckIn ?? null)
  const [checkOut, setCheckOut] = useState(null)
  const [selectedRoomIds, setSelectedRoomIds] = useState([])
  const [emailDebounced, setEmailDebounced] = useState('')
  const [conflict, setConflict] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [earlyConflict, setEarlyConflict] = useState(null)
  const [activeLink, setActiveLink] = useState(null)
  const [feesData, setFeesData] = useState({
    cleaningFeeWaived: false,
    cleaningFeeWaiveReason: '',
    petFeeApplied: false,
    taxExempt: false,
    taxExemptOrg: '',
    miscFeeEnabled: false,
    miscFeeCents: 0,
    miscFeeDollars: '',
    miscFeeLabel: '',
  })

  const { data: rooms = [] } = useRooms()
  const { data: roomLinks = [] } = useRoomLinks()
  const { data: propertySettings } = usePropertyFeeSettings()
  const createReservation = useCreateReservation()
  const updateReservation = useUpdateReservation()
  const { addToast } = useToast()

  const { propertyId } = useProperty()
  const isEditMode = !!reservationToEdit
  const isLoading = createReservation.isPending || updateReservation.isPending

  // Early conflict check — runs when advancing from step 2 to step 3
  const checkConflictsEarly = useCallback(async () => {
    if (!checkIn || !checkOut || selectedRoomIds.length === 0 || !propertyId) return true
    setCheckingConflicts(true)
    setEarlyConflict(null)
    try {
      const ciStr = format(checkIn, 'yyyy-MM-dd')
      const coStr = format(checkOut, 'yyyy-MM-dd')
      const { data } = await supabase
        .from('reservations')
        .select('id, room_ids, check_in, check_out')
        .eq('property_id', propertyId)
        .neq('status', 'cancelled')
        .lt('check_in', coStr)
        .gt('check_out', ciStr)
      const conflicting = (data ?? []).filter((r) => {
        if (isEditMode && r.id === reservationToEdit.id) return false
        return (r.room_ids ?? []).some((rid) => selectedRoomIds.includes(rid))
      })
      if (conflicting.length > 0) {
        setEarlyConflict(conflicting.map((r) => r.id))
        return false
      }
      return true
    } catch {
      // If check fails, allow advancing — the server will catch it on submit
      return true
    } finally {
      setCheckingConflicts(false)
    }
  }, [checkIn, checkOut, selectedRoomIds, propertyId, isEditMode, reservationToEdit])

  const form = useForm({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      phone: '',
      num_guests: 1,
      notes: '',
    },
  })

  // Track email for debounced guest lookup
  const emailWatch = form.watch('email')

  useEffect(() => {
    const timer = setTimeout(() => {
      setEmailDebounced(emailWatch)
    }, 300)
    return () => clearTimeout(timer)
  }, [emailWatch])

  useEffect(() => {
    if (reservationToEdit) {
      setCheckIn(reservationToEdit.check_in ? parseISO(reservationToEdit.check_in) : null)
      setCheckOut(reservationToEdit.check_out ? parseISO(reservationToEdit.check_out) : null)
      setSelectedRoomIds(reservationToEdit.room_ids ?? [])
      const g = reservationToEdit.guests ?? {}
      form.reset({
        email: g.email ?? '',
        first_name: g.first_name ?? '',
        last_name: g.last_name ?? '',
        phone: g.phone ?? '',
        num_guests: reservationToEdit.num_guests ?? 1,
        notes: reservationToEdit.notes ?? '',
      })
    }
  }, [reservationToEdit, form])

  function handleSelectLink(link) {
    if (link) {
      setActiveLink(link)
      setSelectedRoomIds(link.linked_room_ids ?? [])
    } else {
      setActiveLink(null)
      setSelectedRoomIds([])
    }
  }

  function resetModal() {
    setStep(1)
    setCheckIn(null)
    setCheckOut(null)
    setSelectedRoomIds([])
    setActiveLink(null)
    setEmailDebounced('')
    setConflict(null)
    setSubmitError(null)
    setFeesData({ cleaningFeeWaived: false, cleaningFeeWaiveReason: '', petFeeApplied: false, taxExempt: false, taxExemptOrg: '', miscFeeEnabled: false, miscFeeCents: 0, miscFeeDollars: '', miscFeeLabel: '' })
    form.reset()
  }

  const isDirty = step > 1 || checkIn !== null || selectedRoomIds.length > 0

  function handleClose() {
    if (isLoading) return
    if (isDirty) {
      setShowDiscardConfirm(true)
      return
    }
    resetModal()
    onClose()
  }

  function confirmDiscard() {
    setShowDiscardConfirm(false)
    resetModal()
    onClose()
  }

  function toggleRoom(roomId) {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    )
  }

  const nights = checkIn && checkOut ? differenceInCalendarDays(checkOut, checkIn) : 0
  const selectedRooms = rooms.filter((r) => selectedRoomIds.includes(r.id))
  const maxGuests = selectedRooms.reduce((sum, r) => sum + (r.max_guests ?? 2), 0) || 10

  function canAdvance() {
    if (step === 1) return checkIn && checkOut && nights > 0
    if (step === 2) return selectedRoomIds.length > 0
    if (step === 3) {
      const vals = form.getValues()
      return vals.email && vals.first_name && vals.last_name
    }
    return true
  }

  async function handleNext() {
    if (step === 2) {
      const ok = await checkConflictsEarly()
      if (!ok) return // conflict found — stay on step 2
    }
    if (step === 3) {
      const valid = await form.trigger(['email', 'first_name', 'last_name', 'num_guests'])
      if (!valid) return
    }
    setEarlyConflict(null)
    setStep((s) => Math.min(s + 1, 5))
  }

  async function handleSubmit() {
    setConflict(null)
    setSubmitError(null)

    const guestData = form.getValues()
    const payload = {
      check_in: format(checkIn, 'yyyy-MM-dd'),
      check_out: format(checkOut, 'yyyy-MM-dd'),
      room_ids: selectedRoomIds,
      num_guests: Number(guestData.num_guests),
      notes: guestData.notes ?? '',
      guest: {
        email: guestData.email,
        first_name: guestData.first_name,
        last_name: guestData.last_name,
        phone: guestData.phone ?? '',
      },
      cleaning_fee_waived: feesData.cleaningFeeWaived,
      cleaning_fee_waive_reason: feesData.cleaningFeeWaived ? (feesData.cleaningFeeWaiveReason || null) : null,
      pet_fee_applied: feesData.petFeeApplied,
      tax_exempt: feesData.taxExempt,
      tax_exempt_org: feesData.taxExempt ? (feesData.taxExemptOrg || null) : null,
      misc_fee_cents: feesData.miscFeeEnabled ? feesData.miscFeeCents : 0,
      misc_fee_label: feesData.miscFeeEnabled ? (feesData.miscFeeLabel || null) : null,
    }

    const mutation = isEditMode
      ? updateReservation.mutateAsync({ ...payload, id: reservationToEdit.id })
      : createReservation.mutateAsync(payload)

    try {
      const result = await mutation
      const confirmationNumber = result?.confirmation_number ?? result?.id ?? 'N/A'
      addToast({ message: `Reservation confirmed — ${confirmationNumber}`, variant: 'success' })
      resetModal()
      onClose()
    } catch (err) {
      if (err?.code === 'CONFLICT' || err?.conflicting_ids) {
        setConflict(err.conflicting_ids ?? [])
      } else {
        setSubmitError(err?.message ?? 'An error occurred. Please try again.')
      }
    }
  }

  const modalTitle = isEditMode ? 'Edit Reservation' : 'New Reservation'

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={modalTitle}
      className="max-w-[720px] w-full overflow-y-auto max-h-[90vh]"
    >
      <StepIndicator currentStep={step} />

      {step === 1 && (
        <Step1Dates
          checkIn={checkIn}
          checkOut={checkOut}
          onSelect={(ci, co) => { setCheckIn(ci); setCheckOut(co) }}
          minStay={1}
        />
      )}

      {step === 2 && (
        <>
          <Step2Rooms
            rooms={rooms}
            roomLinks={roomLinks}
            selectedRoomIds={selectedRoomIds}
            onToggle={toggleRoom}
            onSelectLink={handleSelectLink}
            activeLink={activeLink}
          />
          {earlyConflict && (
            <div className="mt-4">
              <ConflictBanner conflictingIds={earlyConflict} />
              <p className="font-body text-[13px] text-danger mt-2">
                Please change your dates or room selection to resolve the conflict before continuing.
              </p>
            </div>
          )}
        </>
      )}

      {step === 3 && (
        <Step3Guest
          form={form}
          maxGuests={maxGuests}
          emailDebounced={emailDebounced}
        />
      )}

      {step === 4 && (
        <Step4Fees
          selectedRooms={selectedRooms}
          nights={nights}
          propertySettings={propertySettings}
          feesData={feesData}
          onFeesChange={(updates) => setFeesData((f) => ({ ...f, ...updates }))}
        />
      )}

      {step === 5 && (
        <Step4Review
          checkIn={checkIn}
          checkOut={checkOut}
          selectedRooms={selectedRooms}
          guestData={form.getValues()}
          nights={nights}
          onSubmit={handleSubmit}
          loading={isLoading}
          conflict={conflict}
          error={submitError}
          feesData={feesData}
          propertySettings={propertySettings}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
        <Button
          variant="secondary"
          size="md"
          onClick={() => { setEarlyConflict(null); setStep((s) => Math.max(s - 1, 1)) }}
          disabled={step === 1 || isLoading}
        >
          <ArrowLeft size={16} /> Back
        </Button>

        {step < 5 && (
          <Button
            variant="primary"
            size="md"
            onClick={handleNext}
            disabled={!canAdvance() || isLoading || checkingConflicts}
            loading={checkingConflicts}
          >
            Next <ArrowRight size={16} />
          </Button>
        )}
      </div>

      {/* Discard changes confirmation */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="bg-surface-raised rounded-[12px] border border-border shadow-xl p-6 max-w-sm mx-4">
            <h4 className="font-body font-semibold text-[16px] text-text-primary mb-2">Discard changes?</h4>
            <p className="font-body text-[14px] text-text-secondary mb-6">
              You have unsaved reservation data. Are you sure you want to close?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setShowDiscardConfirm(false)}>
                Keep editing
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmDiscard}>
                Discard
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
