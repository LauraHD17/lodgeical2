// src/pages/admin/Calendar.jsx
// Full month-view calendar showing all reservations color-coded by room.
// Navigate prev/next month. Click a day to filter reservations by that date.

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isToday,
  parseISO,
  isSameMonth,
} from 'date-fns'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'

import { useReservations } from '@/hooks/useReservations'
import { useRooms } from '@/hooks/useRooms'
import { cn } from '@/lib/utils'

// Stable palette for up to 12 rooms
const ROOM_COLORS = [
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

function getDayReservations(reservations, dateStr) {
  return reservations.filter(r => {
    if (!r.check_in || !r.check_out) return false
    return r.check_in <= dateStr && r.check_out > dateStr
  })
}

export default function Calendar() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const { data, isLoading } = useReservations()
  const { data: rooms = [] } = useRooms()

  const allReservations = useMemo(() => {
    return data?.pages?.flatMap((p) => p.data) ?? []
  }, [data])

  // Map roomId → color index
  const roomColorMap = useMemo(() => {
    const map = {}
    rooms.forEach((room, i) => {
      map[room.id] = i % ROOM_COLORS.length
    })
    return map
  }, [rooms])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPadding = getDay(monthStart) // Sunday = 0

  function getRoomColor(roomIds) {
    if (!roomIds?.length) return ROOM_COLORS[0]
    const idx = roomColorMap[roomIds[0]] ?? 0
    return ROOM_COLORS[idx]
  }

  function getRoomName(roomIds) {
    if (!roomIds?.length) return 'Unknown'
    const room = rooms.find(r => r.id === roomIds[0])
    return room?.name ?? 'Room'
  }

  function handleDayClick(dateStr) {
    navigate(`/reservations?date=${dateStr}`)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">
          {format(currentMonth, 'MMMM yyyy')}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="flex items-center justify-center w-9 h-9 rounded-[6px] border border-border text-text-secondary hover:bg-border hover:text-text-primary transition-colors"
            aria-label="Previous month"
          >
            <CaretLeft size={16} />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="h-9 px-3 rounded-[6px] border border-border font-body text-[14px] text-text-secondary hover:bg-border hover:text-text-primary transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="flex items-center justify-center w-9 h-9 rounded-[6px] border border-border text-text-secondary hover:bg-border hover:text-text-primary transition-colors"
            aria-label="Next month"
          >
            <CaretRight size={16} />
          </button>
        </div>
      </div>

      {/* Room legend */}
      {rooms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rooms.map((room, i) => (
            <span
              key={room.id}
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-body border',
                ROOM_COLORS[i % ROOM_COLORS.length]
              )}
            >
              {room.name}
            </span>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className="border border-border rounded-[8px] overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-border bg-surface-raised">
          {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => (
            <div key={d} className="px-3 py-2 font-body text-[12px] font-semibold uppercase tracking-wider text-text-muted text-center">
              <span className="hidden sm:block">{d}</span>
              <span className="sm:hidden">{d.slice(0, 2)}</span>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="animate-pulse bg-border h-96 w-full" />
        ) : (
          <div className="grid grid-cols-7">
            {/* Leading empty cells */}
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} className="border-b border-r border-border min-h-[100px] bg-background" />
            ))}

            {days.map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const dayReservations = getDayReservations(allReservations, dateStr)
              const isTodayDate = isToday(day)
              const isLastInRow = (startPadding + idx + 1) % 7 === 0

              return (
                <div
                  key={dateStr}
                  onClick={() => handleDayClick(dateStr)}
                  className={cn(
                    'border-b border-border min-h-[100px] p-2 cursor-pointer hover:bg-surface-raised transition-colors',
                    !isLastInRow && 'border-r',
                    !isSameMonth(day, currentMonth) && 'opacity-40'
                  )}
                >
                  {/* Day number */}
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-7 h-7 rounded-full font-mono text-[13px] mb-1',
                      isTodayDate
                        ? 'bg-text-primary text-white font-semibold'
                        : 'text-text-secondary'
                    )}
                  >
                    {format(day, 'd')}
                  </span>

                  {/* Reservation chips — show up to 3, then "+N more" */}
                  <div className="flex flex-col gap-0.5">
                    {dayReservations.slice(0, 3).map(r => (
                      <div
                        key={r.id}
                        className={cn(
                          'px-1.5 py-0.5 rounded-[3px] text-[11px] font-body truncate border',
                          getRoomColor(r.room_ids)
                        )}
                        title={`${r.guests?.first_name ?? ''} ${r.guests?.last_name ?? ''} — ${getRoomName(r.room_ids)}`}
                      >
                        {getRoomName(r.room_ids)}
                      </div>
                    ))}
                    {dayReservations.length > 3 && (
                      <span className="text-[11px] text-text-muted font-body pl-1">
                        +{dayReservations.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Trailing empty cells to complete the last row */}
            {(() => {
              const total = startPadding + days.length
              const remainder = total % 7
              if (remainder === 0) return null
              return Array.from({ length: 7 - remainder }).map((_, i) => (
                <div key={`trail-${i}`} className="border-b border-r border-border min-h-[100px] bg-background" />
              ))
            })()}
          </div>
        )}
      </div>

      <p className="font-body text-[13px] text-text-muted">
        Click any day to view its reservations.
      </p>
    </div>
  )
}
