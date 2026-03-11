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

      <div className="my-4 flex justify-center">
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
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded-[3px] bg-surface-raised border border-border" />
            <span className="font-body text-[12px] text-text-secondary">Available</span>
          </div>
          {limitedDates.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-[3px] bg-warning-bg border border-warning relative">
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-warning" />
              </span>
              <span className="font-body text-[12px] text-text-secondary">Limited availability</span>
            </div>
          )}
          {fullyBookedDates.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-[3px] bg-danger-bg border border-danger" style={{ backgroundImage: 'var(--stripe-diagonal)' }} />
              <span className="font-body text-[12px] text-text-secondary">Fully booked</span>
            </div>
          )}
        </div>
      )}

      {range?.from && range?.to && (
        <div className="grid grid-cols-3 gap-2 mb-6 p-3 bg-surface rounded-[6px] text-center">
          <div>
            <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em]">Check-in</p>
            <p className="font-mono text-[14px] text-text-primary">{format(range.from, 'MMM d, yyyy')}</p>
          </div>
          <div>
            <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em]">Check-out</p>
            <p className="font-mono text-[14px] text-text-primary">{format(range.to, 'MMM d, yyyy')}</p>
          </div>
          <div>
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
          className="group mt-8 w-full text-left cursor-pointer"
        >
          <div className="bg-surface border border-border border-l-[3px] border-l-warning rounded-[6px] p-5 group-hover:border-l-info transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-body text-[11px] uppercase tracking-[0.08em] font-semibold text-warning mb-1.5">
                  Inquiry — not a booking
                </p>
                <p className="font-heading text-[17px] text-text-primary mb-1">
                  Can&apos;t find your dates?
                </p>
                <p className="font-body text-[14px] text-text-secondary leading-relaxed">
                  Tell us when you&apos;d like to visit and we&apos;ll reach out if availability opens up.
                </p>
                <span className="inline-block mt-3 font-body text-[14px] font-semibold text-text-primary group-hover:text-info transition-colors">
                  Fill out an inquiry form &rarr;
                </span>
              </div>
            </div>
          </div>
        </button>
      )}

      {/* Inline styles for DayPicker branding + date modifiers */}
      <style>{`
        .rdp-months {
          flex-wrap: nowrap !important;
          gap: 1.5rem;
        }
        /* Month caption — Syne heading font */
        .rdp-caption_label {
          font-family: 'Syne', sans-serif !important;
          font-weight: 700 !important;
          font-size: 17px !important;
          letter-spacing: -0.02em !important;
          color: var(--color-text-primary) !important;
        }
        /* Nav buttons — square, matching Button component */
        .rdp-nav_button {
          width: 32px !important;
          height: 32px !important;
          border-radius: 0 !important;
          border: 1.5px solid var(--color-border) !important;
          background: var(--color-surface-raised) !important;
          color: var(--color-text-primary) !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          transition: opacity 0.15s !important;
        }
        .rdp-nav_button:hover {
          opacity: 0.75 !important;
        }
        .rdp-nav_button:active {
          transform: scale(0.98) !important;
        }
        /* Weekday headers — uppercase caption style */
        .rdp-head_cell {
          font-family: 'IBM Plex Sans', sans-serif !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.06em !important;
          color: var(--color-text-muted) !important;
        }
        /* Day cells — body font */
        .rdp-day {
          font-family: 'IBM Plex Mono', monospace !important;
          font-size: 13px !important;
          border-radius: 4px !important;
        }
        /* Selected range — info color */
        .rdp-day_selected:not(.rdp-day--fully-booked) {
          background-color: var(--color-info) !important;
          color: white !important;
        }
        .rdp-day_range_middle:not(.rdp-day--fully-booked) {
          background-color: var(--color-info-bg) !important;
          color: var(--color-info) !important;
        }
        .rdp-day--fully-booked:not(.rdp-day_selected) {
          background: var(--stripe-diagonal) !important;
          color: var(--color-danger) !important;
          opacity: 0.7;
          cursor: not-allowed;
          text-decoration: line-through;
          border-radius: 4px;
        }
        .rdp-day--limited:not(.rdp-day_selected) {
          background-color: var(--color-warning-bg) !important;
          color: var(--color-warning) !important;
          border-radius: 4px;
          font-weight: 600;
          position: relative;
        }
        .rdp-day--limited:not(.rdp-day_selected)::after {
          content: '';
          position: absolute;
          bottom: 2px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--color-warning);
        }
      `}</style>
    </div>
  )
}
