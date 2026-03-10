// src/components/widget/BookingWidget.jsx
// 4-step public booking flow + inquiry mode. No auth required.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { DateStep } from './DateStep'
import { RoomStep } from './RoomStep'
import { GuestStep } from './GuestStep'
import { ReviewStep } from './ReviewStep'
import { InquiryStep } from './InquiryStep'
import { useWidgetState, clearWidgetState } from './useWidgetState'

const STEPS = ['Dates', 'Room', 'Your Info', 'Review & Pay']

/**
 * Check if a date range overlaps with the seasonal closure window.
 * @param {string} checkIn  YYYY-MM-DD
 * @param {string} checkOut YYYY-MM-DD
 * @param {object} property  property object with seasonal_closure_start/end
 * @returns {boolean}
 */
function isSeasonalClosure(checkIn, checkOut, property) {
  if (!property?.seasonal_closure_start || !property?.seasonal_closure_end) return false
  const ci = new Date(checkIn + 'T12:00:00')
  const co = new Date(checkOut + 'T12:00:00')
  const cs = new Date(property.seasonal_closure_start + 'T00:00:00')
  const ce = new Date(property.seasonal_closure_end + 'T23:59:59')
  // Overlap: checkIn < closureEnd AND checkOut > closureStart
  return ci <= ce && co >= cs
}

export function BookingWidget({ property, rooms, roomLinks = [], settings }) {
  const navigate = useNavigate()
  const [restored, persist] = useWidgetState(property.id)

  const [step, setStep] = useState(restored?.step ?? 0)
  const [dates, setDates] = useState(restored?.dates ?? { checkIn: null, checkOut: null })
  const [selectedRoom, setSelectedRoom] = useState(restored?.selectedRoom ?? null)
  const [guestInfo, setGuestInfo] = useState(restored?.guestInfo ?? null)
  const [isBooking, setIsBooking] = useState(false)
  const [bookingError, setBookingError] = useState(null)

  // Inquiry mode
  const [inquiryMode, setInquiryMode] = useState(false)
  const [closureMessage, setClosureMessage] = useState(null)

  // Persist widget state on changes (not payment step to avoid stale payment intents)
  useEffect(() => {
    if (step < 3) {
      persist({ step, dates, selectedRoom, guestInfo })
    }
  }, [step, dates, selectedRoom, guestInfo, persist])

  function handleDateNext(d) {
    setDates(d)
    // Check seasonal closure before proceeding to room step
    if (isSeasonalClosure(d.checkIn, d.checkOut, property)) {
      setClosureMessage(property.seasonal_closure_message || null)
      setInquiryMode(true)
    } else {
      setStep(1)
    }
  }

  function handleInquiryFromDateStep() {
    setClosureMessage(null)
    setInquiryMode(true)
  }

  function handleInquiryFromRoomStep() {
    setClosureMessage(null)
    setInquiryMode(true)
  }

  function handleInquiryBack() {
    setInquiryMode(false)
    setClosureMessage(null)
    // Return to wherever they came from: step 0 if seasonal closure, step 1 if from room step
    // If dates overlap closure they came from step 0, otherwise they came from step 1
    if (dates.checkIn && isSeasonalClosure(dates.checkIn, dates.checkOut, property)) {
      setStep(0)
    }
    // Otherwise stay on step 1 (RoomStep) — step is already 1
  }

  async function handleBook(_paymentData) {
    setIsBooking(true)
    setBookingError(null)
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-reservation`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_ids: selectedRoom.room_ids,
            check_in: dates.checkIn,
            check_out: dates.checkOut,
            num_guests: guestInfo.numGuests,
            guest_email: guestInfo.email,
            guest_first_name: guestInfo.firstName,
            guest_last_name: guestInfo.lastName,
            guest_phone: guestInfo.phone || null,
            booker_email: guestInfo.bookerEmail || null,
            cc_emails: guestInfo.ccEmails || [],
            origin: 'widget',
          }),
        }
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        setBookingError(json.error || 'Booking failed. Please try again.')
        return
      }
      clearWidgetState(property.id)
      navigate(`/booking-confirmation?confirmation=${json.confirmation_number}`)
    } catch (err) {
      setBookingError(err.message || 'Network error. Please try again.')
    } finally {
      setIsBooking(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Property name */}
      <div className="text-center mb-6">
        <h1 className="font-heading text-[28px] text-text-primary">{property.name}</h1>
        {property.location && (
          <p className="font-body text-[14px] text-text-muted mt-1">{property.location}</p>
        )}
      </div>

      {/* Progress bar — hidden during inquiry mode */}
      {!inquiryMode && (
        <nav aria-label="Booking progress" className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold font-body transition-colors',
                    i < step ? 'bg-success text-white' :
                    i === step ? 'bg-text-primary text-white' :
                    'bg-border text-text-muted'
                  )}
                  role="img"
                  aria-label={i < step ? `Step ${i + 1}: ${label} — completed` : i === step ? `Step ${i + 1}: ${label} — current` : `Step ${i + 1}: ${label} — upcoming`}
                >
                  {i < step ? <CheckCircle size={16} weight="bold" /> : i + 1}
                </div>
                <span className={cn(
                  'mt-1 text-[11px] font-body whitespace-nowrap',
                  i === step ? 'text-info font-semibold underline' :
                  i < step ? 'text-success' : 'text-text-muted'
                )} aria-hidden="true">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('flex-1 h-[1px] mx-2 mt-[-12px]', i < step ? 'bg-success' : 'bg-border')} aria-hidden="true" />
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Step content */}
      <div className="bg-surface-raised border border-border rounded-[12px] p-6 md:p-8">
        {inquiryMode ? (
          <InquiryStep
            checkIn={dates.checkIn}
            checkOut={dates.checkOut}
            propertyId={property.id}
            rooms={rooms}
            closureMessage={closureMessage}
            onBack={handleInquiryBack}
          />
        ) : (
          <>
            {step === 0 && (
              <DateStep
                settings={settings}
                propertyId={property.id}
                rooms={rooms}
                initialDates={dates}
                onNext={handleDateNext}
                onInquiry={handleInquiryFromDateStep}
              />
            )}
            {step === 1 && (
              <RoomStep
                rooms={rooms}
                roomLinks={roomLinks}
                checkIn={dates.checkIn}
                checkOut={dates.checkOut}
                onNext={(room) => { setSelectedRoom(room); setStep(2) }}
                onBack={() => setStep(0)}
                onInquiry={handleInquiryFromRoomStep}
              />
            )}
            {step === 2 && (
              <GuestStep
                room={selectedRoom}
                checkIn={dates.checkIn}
                checkOut={dates.checkOut}
                onNext={(info) => { setGuestInfo(info); setStep(3) }}
                onBack={() => setStep(1)}
              />
            )}
            {step === 3 && (
              <ReviewStep
                property={property}
                room={selectedRoom}
                dates={dates}
                guestInfo={guestInfo}
                settings={settings}
                onBook={handleBook}
                onBack={() => setStep(2)}
                isLoading={isBooking}
                error={bookingError}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
