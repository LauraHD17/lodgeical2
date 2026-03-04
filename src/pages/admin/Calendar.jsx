// src/pages/admin/Calendar.jsx
// Full month-view calendar with spanning reservation bars (like a Gantt).
// Bars continue across day-column boundaries within each week row.
// Click a bar → reservation/guest detail popup.

import { useState, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
  isSameMonth,
  parseISO,
  startOfDay,
  differenceInDays,
  addDays,
} from 'date-fns'
import { CaretLeft, CaretRight, X, User, CalendarBlank, Door } from '@phosphor-icons/react'

import { useReservations } from '@/hooks/useReservations'
import { useRooms } from '@/hooks/useRooms'
import { cn } from '@/lib/utils'

// Stable palette for up to 12 rooms
const ROOM_COLORS_BG   = ['bg-blue-200',   'bg-green-200',   'bg-purple-200',  'bg-orange-200',  'bg-pink-200',   'bg-teal-200',   'bg-yellow-200',  'bg-red-200',   'bg-indigo-200',  'bg-cyan-200',   'bg-lime-200',   'bg-rose-200'  ]
const ROOM_COLORS_TEXT = ['text-blue-900',  'text-green-900', 'text-purple-900','text-orange-900','text-pink-900', 'text-teal-900', 'text-yellow-900','text-red-900', 'text-indigo-900','text-cyan-900', 'text-lime-900', 'text-rose-900']
const ROOM_COLORS_PILL = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-orange-100 text-orange-800 border-orange-200',
  'bg-pink-100 text-pink-800 border-pink-200',
  'bg-teal-100 text-teal-800 border-teal-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-red-100 text-red-800 border-red-200',
  'bg-indigo-100 text-indigo-800 border-indigo-200',
  'bg-cyan-100 text-cyan-800 border-cyan-200',
  'bg-lime-100 text-lime-800 border-lime-200',
  'bg-rose-100 text-rose-800 border-rose-200',
]

function dollars(cents) {
  if (!cents) return '$0.00'
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// ── Reservation detail popup ─────────────────────────────────────────────────

function ReservationPopup({ reservation, rooms, onClose }) {
  if (!reservation) return null
  const roomColorIdx = rooms.findIndex(r => (reservation.room_ids ?? []).includes(r.id))
  const colorIdx     = roomColorIdx >= 0 ? roomColorIdx % ROOM_COLORS_PILL.length : 0
  const roomNames    = (reservation.room_ids ?? []).map(id => rooms.find(r => r.id === id)?.name ?? id).join(', ')
  const guest        = reservation.guests ?? {}
  const nights       = reservation.check_in && reservation.check_out
    ? Math.max(0, differenceInDays(parseISO(reservation.check_out), parseISO(reservation.check_in)))
    : 0

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black opacity-30" />
      <div
        className="relative z-[9999] bg-surface-raised border border-border rounded-[12px] p-6 w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-heading text-[18px] text-text-primary">
              {guest.first_name ?? ''} {guest.last_name ?? 'Guest'}
            </h3>
            <p className="font-body text-[12px] text-text-muted mt-0.5">{reservation.confirmation_number}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Status chip */}
          <span className={cn(
            'self-start text-[11px] font-semibold font-body px-2.5 py-1 rounded-full capitalize',
            reservation.status === 'confirmed' ? 'bg-success-bg text-success' :
            reservation.status === 'pending'   ? 'bg-warning-bg text-warning' :
            reservation.status === 'cancelled' ? 'bg-danger-bg text-danger'   :
            'bg-border text-text-muted'
          )}>
            {reservation.status}
          </span>

          {/* Dates */}
          <div className="flex items-start gap-2">
            <CalendarBlank size={15} className="text-text-muted shrink-0 mt-0.5" />
            <div>
              <p className="font-body text-[13px] text-text-primary">
                {reservation.check_in ? format(parseISO(reservation.check_in), 'MMM d, yyyy') : '—'}
                {' → '}
                {reservation.check_out ? format(parseISO(reservation.check_out), 'MMM d, yyyy') : '—'}
              </p>
              <p className="font-body text-[12px] text-text-muted">{nights} night{nights !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Room */}
          <div className="flex items-center gap-2">
            <Door size={15} className="text-text-muted shrink-0" />
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-body border', ROOM_COLORS_PILL[colorIdx])}>
              {roomNames}
            </span>
          </div>

          {/* Guest info */}
          {(guest.email || guest.phone) && (
            <div className="flex items-start gap-2">
              <User size={15} className="text-text-muted shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                {guest.email && <p className="font-body text-[13px] text-text-secondary">{guest.email}</p>}
                {guest.phone && <p className="font-body text-[13px] text-text-secondary">{guest.phone}</p>}
              </div>
            </div>
          )}

          {/* Guests count + total */}
          {reservation.num_guests && (
            <p className="font-body text-[13px] text-text-secondary">
              {reservation.num_guests} guest{reservation.num_guests !== 1 ? 's' : ''}
            </p>
          )}
          {reservation.total_due_cents > 0 && (
            <p className="font-body text-[13px] text-text-secondary">
              Total: <span className="font-mono font-semibold text-text-primary">{dollars(reservation.total_due_cents)}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Calendar ─────────────────────────────────────────────────────────────────

export default function Calendar() {
  const [currentMonth, setCurrentMonth]     = useState(new Date())
  const [selectedRes, setSelectedRes]       = useState(null)

  const { data, isLoading } = useReservations()
  const { data: rooms = [] } = useRooms()

  const allReservations = useMemo(() => data?.pages?.flatMap(p => p.data) ?? [], [data])

  // roomId → stable color index
  const roomColorMap = useMemo(() => {
    const map = {}
    rooms.forEach((room, i) => { map[room.id] = i % ROOM_COLORS_BG.length })
    return map
  }, [rooms])

  // Group days into weeks (arrays of up to 7 Date objects)
  const { weeks, startPadding } = useMemo(() => {
    const monthStart   = startOfMonth(currentMonth)
    const monthEnd     = endOfMonth(currentMonth)
    const days         = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const startPad     = getDay(monthStart) // 0 = Sunday

    // Build full grid including padding nulls
    const grid = [
      ...Array(startPad).fill(null),
      ...days,
    ]
    // Pad end to fill last row
    while (grid.length % 7 !== 0) grid.push(null)

    // Chunk into weeks
    const wks = []
    for (let i = 0; i < grid.length; i += 7) wks.push(grid.slice(i, i + 7))
    return { weeks: wks, startPadding: startPad }
  }, [currentMonth])

  // For each week row and each active reservation, compute which columns it spans
  // Returns: { weekIndex, colStart (0-6), colEnd (0-6 inclusive), reservation }[]
  const bars = useMemo(() => {
    const result = []
    const viewStart = weeks[0]?.[0]
    const viewEnd   = weeks[weeks.length - 1]?.[6]
    if (!viewStart || !viewEnd) return result

    for (const res of allReservations) {
      if (!res.check_in || !res.check_out) continue
      const ci = startOfDay(parseISO(res.check_in))
      const co = startOfDay(parseISO(res.check_out))
      if (co <= viewStart || ci >= addDays(viewEnd, 1)) continue

      weeks.forEach((week, wIdx) => {
        const weekDays = week.filter(Boolean)
        if (!weekDays.length) return
        const weekFirst = startOfDay(weekDays[0])
        const weekLast  = startOfDay(weekDays[weekDays.length - 1])

        // Clamp bar to this week
        const barStart = ci > weekFirst ? ci : weekFirst
        const barEnd   = co <= addDays(weekLast, 1) ? co : addDays(weekLast, 1)
        if (barEnd <= barStart) return

        // Find col indices within the week array
        const colStart = week.findIndex(d => d && startOfDay(d).getTime() === barStart.getTime())
        const barEndDay = addDays(barEnd, -1)
        let colEnd = week.findIndex(d => d && startOfDay(d).getTime() === barEndDay.getTime())
        if (colEnd === -1) colEnd = week.findLastIndex(d => d !== null)
        if (colStart === -1) return

        const colorIdx = roomColorMap[(res.room_ids ?? [])[0]] ?? 0
        result.push({ weekIndex: wIdx, colStart, colEnd, reservation: res, colorIdx, isStart: ci.getTime() === barStart.getTime(), isEnd: co.getTime() === addDays(barEnd, 0).getTime() })
      })
    }
    return result
  }, [allReservations, weeks, roomColorMap])

  // Group bars by week for rendering
  const barsByWeek = useMemo(() => {
    const map = {}
    for (const bar of bars) {
      ;(map[bar.weekIndex] ??= []).push(bar)
    }
    return map
  }, [bars])

  function getRoomColorIdx(roomIds) {
    if (!roomIds?.length) return 0
    return roomColorMap[roomIds[0]] ?? 0
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">
          {format(currentMonth, 'MMMM yyyy')}
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="flex items-center justify-center w-9 h-9 rounded-[6px] border border-border text-text-secondary hover:bg-border hover:text-text-primary transition-colors" aria-label="Previous month">
            <CaretLeft size={16} />
          </button>
          <button onClick={() => setCurrentMonth(new Date())} className="h-9 px-3 rounded-[6px] border border-border font-body text-[14px] text-text-secondary hover:bg-border hover:text-text-primary transition-colors">
            Today
          </button>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="flex items-center justify-center w-9 h-9 rounded-[6px] border border-border text-text-secondary hover:bg-border hover:text-text-primary transition-colors" aria-label="Next month">
            <CaretRight size={16} />
          </button>
        </div>
      </div>

      {/* Room legend */}
      {rooms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rooms.map((room, i) => (
            <span key={room.id} className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-body border', ROOM_COLORS_PILL[i % ROOM_COLORS_PILL.length])}>
              {room.name}
            </span>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className="border border-border rounded-[8px] overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-border bg-surface-raised">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
            <div key={d} className="px-3 py-2 font-body text-[12px] font-semibold uppercase tracking-wider text-text-muted text-center">
              <span className="hidden sm:block">{d}</span>
              <span className="sm:hidden">{d.slice(0, 2)}</span>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="animate-pulse bg-border h-96 w-full" />
        ) : (
          <div>
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="relative border-b border-border last:border-b-0">
                {/* Day number row */}
                <div className="grid grid-cols-7">
                  {week.map((day, dIdx) => {
                    const isCurrentMonth = day && isSameMonth(day, currentMonth)
                    const isTodayDate    = day && isToday(day)
                    return (
                      <div
                        key={dIdx}
                        className={cn(
                          'min-h-[90px] pt-2 px-2 pb-8',
                          dIdx < 6 && 'border-r border-border',
                          !isCurrentMonth && 'opacity-40 bg-background',
                          isTodayDate && 'bg-info-bg/20'
                        )}
                      >
                        {day && (
                          <span className={cn(
                            'inline-flex items-center justify-center w-7 h-7 rounded-full font-mono text-[13px]',
                            isTodayDate ? 'bg-text-primary text-white font-semibold' : 'text-text-secondary'
                          )}>
                            {format(day, 'd')}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Reservation bars overlay — absolutely positioned within this week row */}
                <div className="absolute bottom-1 left-0 right-0 px-0 pointer-events-none">
                  {(barsByWeek[wIdx] ?? []).map((bar, bIdx) => {
                    const totalCols = 7
                    const leftPct   = (bar.colStart / totalCols) * 100
                    const widthPct  = ((bar.colEnd - bar.colStart + 1) / totalCols) * 100
                    const res       = bar.reservation
                    const guest     = res.guests ?? {}
                    const isPending = res.status === 'pending'

                    return (
                      <button
                        key={bIdx}
                        onClick={() => setSelectedRes(res)}
                        className={cn(
                          'absolute h-6 flex items-center pointer-events-auto cursor-pointer transition-opacity hover:opacity-80',
                          'bottom-0',
                          ROOM_COLORS_BG[bar.colorIdx],
                          ROOM_COLORS_TEXT[bar.colorIdx],
                          isPending && 'border border-dashed border-current opacity-80',
                          bar.isStart  ? 'rounded-l-[3px] pl-2' : 'pl-1',
                          bar.isEnd    ? 'rounded-r-[3px] pr-2' : 'pr-0',
                        )}
                        style={{
                          left:  `calc(${leftPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                          bottom: `${bIdx * 26 + 2}px`,
                        }}
                        title={`${guest.first_name ?? ''} ${guest.last_name ?? ''} — ${res.check_in} → ${res.check_out}`}
                        aria-label={`${guest.first_name ?? ''} ${guest.last_name ?? ''} reservation`}
                      >
                        <span className="font-body text-[11px] font-medium truncate leading-none">
                          {guest.last_name ?? res.confirmation_number ?? ''}
                          {isPending && ' (pending)'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="font-body text-[13px] text-text-muted">
        Click any reservation bar to view details.
      </p>

      {/* Reservation detail popup */}
      {selectedRes && (
        <ReservationPopup
          reservation={selectedRes}
          rooms={rooms}
          onClose={() => setSelectedRes(null)}
        />
      )}
    </div>
  )
}
