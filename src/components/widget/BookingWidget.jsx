// src/components/widget/BookingWidget.jsx
// 4-step public booking flow. No auth required.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { DateStep } from './DateStep'
import { RoomStep } from './RoomStep'
import { GuestStep } from './GuestStep'
import { ReviewStep } from './ReviewStep'

const STEPS = ['Dates', 'Room', 'Your Info', 'Review & Pay']

export function BookingWidget({ property, rooms, roomLinks = [], settings }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [dates, setDates] = useState({ checkIn: null, checkOut: null })
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [guestInfo, setGuestInfo] = useState(null)
  const [isBooking, setIsBooking] = useState(false)
  const [bookingError, setBookingError] = useState(null)

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

      {/* Progress bar */}
      <div className="flex items-center justify-between mb-8 px-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold font-body transition-colors',
                i < step ? 'bg-success text-white' :
                i === step ? 'bg-text-primary text-white' :
                'bg-border text-text-muted'
              )}>
                {i < step ? <CheckCircle size={16} weight="bold" /> : i + 1}
              </div>
              <span className={cn(
                'mt-1 text-[11px] font-body whitespace-nowrap',
                i === step ? 'text-info font-semibold underline' :
                i < step ? 'text-success' : 'text-text-muted'
              )}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-[1px] mx-2 mt-[-12px]', i < step ? 'bg-success' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-surface-raised border border-border rounded-[12px] p-6 md:p-8">
        {step === 0 && (
          <DateStep
            settings={settings}
            propertyId={property.id}
            initialDates={dates}
            onNext={(d) => { setDates(d); setStep(1) }}
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
      </div>
    </div>
  )
}
