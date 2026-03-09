// src/components/widget/DateStep.jsx

import { useState, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { differenceInCalendarDays, format, addDays, subDays } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabaseClient'

export function DateStep({ settings, propertyId, rooms, initialDates, onNext }) {
  const [range, setRange] = useState(
    initialDates.checkIn
      ? { from: new Date(initialDates.checkIn + 'T12:00:00'), to: initialDates.checkOut ? new Date(initialDates.checkOut + 'T12:00:00') : undefined }
      : undefined
  )
  const [bookedRanges, setBookedRanges] = useState([])
  const minStay = settings?.min_stay_nights ?? 1

  // Fetch booked dates and expand with buffer days
  useEffect(() => {
    if (!propertyId) return
    supabase
      .from('reservations')
      .select('check_in, check_out, room_ids')
      .eq('property_id', propertyId)
      .neq('status', 'cancelled')
      .then(({ data }) => {
        if (!data) return
        // Build a map of room_id → buffer days from the rooms prop
        const bufferMap = new Map()
        for (const room of (rooms ?? [])) {
          bufferMap.set(room.id, {
            before: room.buffer_days_before ?? 0,
            after: room.buffer_days_after ?? 0,
          })
        }

        const ranges = data.map(r => {
          // Find the max buffer days across all rooms in this reservation
          let maxBefore = 0
          let maxAfter = 0
          for (const rid of (r.room_ids ?? [])) {
            const buf = bufferMap.get(rid)
            if (buf) {
              maxBefore = Math.max(maxBefore, buf.before)
              maxAfter = Math.max(maxAfter, buf.after)
            }
          }
          return {
            from: subDays(new Date(r.check_in + 'T12:00:00'), maxBefore),
            to: addDays(new Date(r.check_out + 'T12:00:00'), maxAfter),
          }
        })
        setBookedRanges(ranges)
      })
  }, [propertyId, rooms])

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
          disabled={[{ before: new Date() }, ...bookedRanges]}
          numberOfMonths={2}
          className="!font-body"
        />
      </div>

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
    </div>
  )
}
