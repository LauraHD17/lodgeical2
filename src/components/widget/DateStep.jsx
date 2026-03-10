// src/components/widget/DateStep.jsx

import { useState, useEffect, useMemo } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { differenceInCalendarDays, format, addDays, subDays, eachDayOfInterval } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabaseClient'

export function DateStep({ settings, propertyId, rooms, initialDates, onNext, onInquiry }) {
  const [range, setRange] = useState(
    initialDates.checkIn
      ? { from: new Date(initialDates.checkIn + 'T12:00:00'), to: initialDates.checkOut ? new Date(initialDates.checkOut + 'T12:00:00') : undefined }
      : undefined
  )
  const [reservations, setReservations] = useState([])
  const minStay = settings?.min_stay_nights ?? 1

  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Fetch reservation data
  useEffect(() => {
    if (!propertyId) return
    supabase
      .from('reservations')
      .select('check_in, check_out, room_ids')
      .eq('property_id', propertyId)
      .neq('status', 'cancelled')
      .then(({ data }) => {
        if (data) setReservations(data)
      })
  }, [propertyId, rooms])

  // Build per-date availability: which rooms are booked on each date
  const { fullyBookedDates, limitedDates } = useMemo(() => {
    const totalRooms = (rooms ?? []).length
    if (!totalRooms || !reservations.length) return { fullyBookedDates: [], limitedDates: [] }

    // Buffer days per room
    const bufferMap = new Map()
    for (const room of rooms) {
      bufferMap.set(room.id, {
        before: room.buffer_days_before ?? 0,
        after: room.buffer_days_after ?? 0,
      })
    }

    // Map: dateKey → Set<roomId> booked on that date
    const dateRoomMap = new Map()

    for (const res of reservations) {
      for (const rid of (res.room_ids ?? [])) {
        const buf = bufferMap.get(rid) || { before: 0, after: 0 }
        const start = subDays(new Date(res.check_in + 'T12:00:00'), buf.before)
        const end = subDays(new Date(res.check_out + 'T12:00:00'), 1) // check_out day is departure, room free that night
        if (start > end) continue
        const days = eachDayOfInterval({ start, end })
        // Add buffer days after check-out too
        const afterEnd = addDays(new Date(res.check_out + 'T12:00:00'), buf.after - 1)
        const endDate = new Date(res.check_out + 'T12:00:00')
        if (buf.after > 0 && endDate <= afterEnd) {
          days.push(...eachDayOfInterval({ start: endDate, end: afterEnd }))
        }
        for (const d of days) {
          const key = format(d, 'yyyy-MM-dd')
          if (!dateRoomMap.has(key)) dateRoomMap.set(key, new Set())
          dateRoomMap.get(key).add(rid)
        }
      }
    }

    const fully = []
    const limited = []
    for (const [dateStr, roomSet] of dateRoomMap) {
      const d = new Date(dateStr + 'T12:00:00')
      if (roomSet.size >= totalRooms) {
        fully.push(d)
      } else {
        limited.push(d)
      }
    }

    return { fullyBookedDates: fully, limitedDates: limited }
  }, [rooms, reservations])

  const nights = range?.from && range?.to
    ? differenceInCalendarDays(range.to, range.from)
    : 0

  function handleNext() {
    if (!range?.from || !range?.to || nights < minStay) return
    onNext({
      checkIn: format(range.from, 'yyyy-MM-dd'),
      checkOut: format(range.to, 'yyyy-MM-dd'),
    })
  }

  const canProceed = range?.from && range?.to && nights >= minStay
  const hasAnyBookings = fullyBookedDates.length > 0 || limitedDates.length > 0

  return (
    <div>
      <h2 className="font-heading text-[24px] text-text-primary mb-1">Select your dates</h2>
      {minStay > 1 && (
        <p className="font-body text-[13px] text-text-muted mb-4">Minimum {minStay} night stay</p>
      )}

      <div className="flex justify-center my-4">
        <DayPicker
          mode="range"
          selected={range}
          onSelect={setRange}
          disabled={[{ before: new Date() }, ...fullyBookedDates]}
          modifiers={{
            fullyBooked: fullyBookedDates,
            limited: limitedDates,
          }}
          modifiersClassNames={{
            fullyBooked: 'rdp-day--fully-booked',
            limited: 'rdp-day--limited',
          }}
          numberOfMonths={isMobile ? 1 : 2}
          className="!font-body"
        />
      </div>

      {/* Legend */}
      {hasAnyBookings && (
        <div className="flex items-center justify-center gap-5 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-[3px] bg-surface-raised border border-border" />
            <span className="font-body text-[12px] text-text-secondary">Available</span>
          </div>
          {limitedDates.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-[3px] bg-warning-bg border border-warning" />
              <span className="font-body text-[12px] text-text-secondary">Limited</span>
            </div>
          )}
          {fullyBookedDates.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-[3px] bg-danger-bg border border-danger" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(190,18,60,0.15) 3px, rgba(190,18,60,0.15) 5px)' }} />
              <span className="font-body text-[12px] text-text-secondary">Fully booked</span>
            </div>
          )}
        </div>
      )}

      {range?.from && range?.to && (
        <div className="flex items-center justify-center gap-4 mb-6 p-3 bg-surface rounded-[6px]">
          <div className="text-center">
            <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em]">Check-in</p>
            <p className="font-mono text-[14px] text-text-primary">{format(range.from, 'MMM d, yyyy')}</p>
          </div>
          <div className="text-center font-mono text-[14px] text-text-muted">→</div>
          <div className="text-center">
            <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em]">Check-out</p>
            <p className="font-mono text-[14px] text-text-primary">{format(range.to, 'MMM d, yyyy')}</p>
          </div>
          <div className="text-center">
            <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em]">Nights</p>
            <p className="font-mono text-[14px] text-text-primary">{nights}</p>
          </div>
        </div>
      )}

      {range?.from && range?.to && nights < minStay && (
        <p className="text-warning text-[13px] font-body text-center mb-4">
          Minimum stay is {minStay} night{minStay > 1 ? 's' : ''}.
        </p>
      )}

      <Button variant="primary" size="lg" onClick={handleNext} disabled={!canProceed} className="w-full">
        Continue to room selection
      </Button>

      {/* Inquiry CTA for guests who want unavailable dates */}
      {onInquiry && hasAnyBookings && (
        <button
          type="button"
          onClick={onInquiry}
          className="mt-6 w-full bg-info-bg border-2 border-info rounded-[10px] p-5 text-center hover:bg-info/10 transition-colors cursor-pointer"
        >
          <p className="font-body text-[17px] font-semibold text-info mb-1">
            Want dates that are unavailable?
          </p>
          <p className="font-body text-[14px] text-info/80">
            Send us an inquiry and we&apos;ll reach out if availability opens up.
          </p>
          <span className="inline-block mt-3 font-body text-[14px] font-semibold text-info underline underline-offset-2">
            Send an inquiry &rarr;
          </span>
        </button>
      )}

      {/* Inline styles for date modifiers */}
      <style>{`
        .rdp-day--fully-booked:not(.rdp-day_selected) {
          background: repeating-linear-gradient(
            135deg,
            var(--color-danger-bg, #FFE4E6),
            var(--color-danger-bg, #FFE4E6) 3px,
            rgba(190, 18, 60, 0.12) 3px,
            rgba(190, 18, 60, 0.12) 5px
          ) !important;
          color: var(--color-danger, #BE123C) !important;
          opacity: 0.7;
          cursor: not-allowed;
          text-decoration: line-through;
          border-radius: 4px;
        }
        .rdp-day--limited:not(.rdp-day_selected) {
          background-color: var(--color-warning-bg, #FEF3C7) !important;
          color: var(--color-warning, #B45309) !important;
          border-radius: 4px;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}
