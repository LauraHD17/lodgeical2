// src/pages/admin/Calendar.jsx
// Month-view calendar with spanning Gantt bars per room.
// Bars show room name + guest. Click bar → detail popup.
// Click empty day → new reservation modal pre-filled with that date.

import { useState, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isToday, isSameMonth,
  parseISO, differenceInDays, addDays,
} from 'date-fns'
import { CaretLeft, CaretRight, X, User, CalendarBlank, Door, Plus } from '@phosphor-icons/react'

import { useReservations } from '@/hooks/useReservations'
import { useRooms } from '@/hooks/useRooms'
import { ReservationModal } from '@/components/reservations/ReservationModal'
import { cn } from '@/lib/utils'

// Room colour palette (12 slots)
const ROOM_COLORS_BG   = ['bg-blue-200','bg-green-200','bg-purple-200','bg-orange-200','bg-pink-200','bg-teal-200','bg-yellow-200','bg-red-200','bg-indigo-200','bg-cyan-200','bg-lime-200','bg-rose-200']
const ROOM_COLORS_TEXT = ['text-blue-900','text-green-900','text-purple-900','text-orange-900','text-pink-900','text-teal-900','text-yellow-900','text-red-900','text-indigo-900','text-cyan-900','text-lime-900','text-rose-900']
const ROOM_COLORS_PILL = ['bg-blue-100 text-blue-800 border-blue-200','bg-green-100 text-green-800 border-green-200','bg-purple-100 text-purple-800 border-purple-200','bg-orange-100 text-orange-800 border-orange-200','bg-pink-100 text-pink-800 border-pink-200','bg-teal-100 text-teal-800 border-teal-200','bg-yellow-100 text-yellow-800 border-yellow-200','bg-red-100 text-red-800 border-red-200','bg-indigo-100 text-indigo-800 border-indigo-200','bg-cyan-100 text-cyan-800 border-cyan-200','bg-lime-100 text-lime-800 border-lime-200','bg-rose-100 text-rose-800 border-rose-200']

function fmtMoney(cents) {
  if (!cents) return '$0.00'
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// ── Reservation detail popup ──────────────────────────────────────────────────

function ReservationPopup({ reservation, rooms, onClose }) {
  const colorIdx  = rooms.findIndex(r => (reservation.room_ids ?? []).includes(r.id))
  const ci        = colorIdx >= 0 ? colorIdx % ROOM_COLORS_PILL.length : 0
  const roomNames = (reservation.room_ids ?? []).map(id => rooms.find(r => r.id === id)?.name ?? id).join(', ')
  const guest     = reservation.guests ?? {}
  const nights    = reservation.check_in && reservation.check_out
    ? Math.max(0, differenceInDays(parseISO(reservation.check_out), parseISO(reservation.check_in)))
    : 0

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-[9999] bg-surface-raised border border-border rounded-[12px] p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-heading text-[18px] text-text-primary">{guest.first_name ?? ''} {guest.last_name ?? 'Guest'}</h3>
            <p className="font-body text-[12px] text-text-muted mt-0.5">{reservation.confirmation_number}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1"><X size={18} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <span className={cn('self-start text-[11px] font-semibold font-body px-2.5 py-1 rounded-full capitalize',
            reservation.status === 'confirmed' ? 'bg-success-bg text-success' :
            reservation.status === 'pending'   ? 'bg-warning-bg text-warning' :
            reservation.status === 'cancelled' ? 'bg-danger-bg text-danger' : 'bg-border text-text-muted'
          )}>{reservation.status}</span>
          <div className="flex items-start gap-2">
            <CalendarBlank size={15} className="text-text-muted shrink-0 mt-0.5" />
            <div>
              <p className="font-body text-[13px] text-text-primary">
                {reservation.check_in  ? format(parseISO(reservation.check_in),  'MMM d, yyyy') : '—'} → {reservation.check_out ? format(parseISO(reservation.check_out), 'MMM d, yyyy') : '—'}
              </p>
              <p className="font-body text-[12px] text-text-muted">{nights} night{nights !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Door size={15} className="text-text-muted shrink-0" />
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-body border', ROOM_COLORS_PILL[ci])}>{roomNames}</span>
          </div>
          {(guest.email || guest.phone) && (
            <div className="flex items-start gap-2">
              <User size={15} className="text-text-muted shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                {guest.email && <p className="font-body text-[13px] text-text-secondary">{guest.email}</p>}
                {guest.phone && <p className="font-body text-[13px] text-text-secondary">{guest.phone}</p>}
              </div>
            </div>
          )}
          {reservation.num_guests && <p className="font-body text-[13px] text-text-secondary">{reservation.num_guests} guest{reservation.num_guests !== 1 ? 's' : ''}</p>}
          {reservation.total_due_cents > 0 && (
            <p className="font-body text-[13px] text-text-secondary">Total: <span className="font-mono font-semibold text-text-primary">{fmtMoney(reservation.total_due_cents)}</span></p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedRes, setSelectedRes]   = useState(null)
  const [newResDate, setNewResDate]     = useState(null) // date clicked to create reservation

  const { data, isLoading } = useReservations()
  const { data: rooms = [] } = useRooms()

  const allReservations = useMemo(() => data?.pages?.flatMap(p => p.data) ?? [], [data])

  const roomColorMap = useMemo(() => {
    const map = {}
    rooms.forEach((room, i) => { map[room.id] = i % ROOM_COLORS_BG.length })
    return map
  }, [rooms])

  // Build week grid (nulls for padding)
  const weeks = useMemo(() => {
    const days  = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
    const grid  = [...Array(getDay(days[0])).fill(null), ...days]
    while (grid.length % 7 !== 0) grid.push(null)
    const wks = []
    for (let i = 0; i < grid.length; i += 7) wks.push(grid.slice(i, i + 7))
    return wks
  }, [currentMonth])

  // Default check-in/out times (hours) — drives time-of-day bar offset
  const CHECK_IN_HOUR  = 15  // 3 pm
  const CHECK_OUT_HOUR = 11  // 11 am

  // Compute spanning bars for each week row.
  // Uses YYYY-MM-DD string comparison throughout — avoids all timezone/DST issues.
  const barsByWeek = useMemo(() => {
    const viewStart = weeks[0]?.find(Boolean)
    const viewEnd   = [...(weeks[weeks.length - 1] ?? [])].reverse().find(Boolean)
    if (!viewStart || !viewEnd) return {}

    const viewFirstStr = format(viewStart, 'yyyy-MM-dd')
    const viewLastStr  = format(viewEnd,   'yyyy-MM-dd')

    // Add / subtract one day using local-midnight date (avoids parseISO UTC issues)
    const shiftDay = (str, delta) =>
      format(addDays(new Date(str + 'T00:00:00'), delta), 'yyyy-MM-dd')

    const map = {}
    for (const res of allReservations) {
      if (!res.check_in || !res.check_out) continue
      const ciStr = res.check_in   // YYYY-MM-DD
      const coStr = res.check_out  // YYYY-MM-DD (exclusive — guest leaves this morning)

      // Skip entirely outside view
      if (coStr <= viewFirstStr || ciStr > viewLastStr) continue

      weeks.forEach((week, wIdx) => {
        // Build a parallel array of YYYY-MM-DD strings (null for padding slots)
        const weekStrs = week.map(d => (d ? format(d, 'yyyy-MM-dd') : null))
        const realStrs = weekStrs.filter(Boolean)
        if (!realStrs.length) return

        const weekFirstStr = realStrs[0]
        const weekLastStr  = realStrs[realStrs.length - 1]
        const weekNextStr  = shiftDay(weekLastStr, 1)

        // Clamp bar to this week's date range
        const barStartStr = ciStr > weekFirstStr ? ciStr : weekFirstStr
        const barEndStr   = coStr <= weekNextStr  ? coStr : weekNextStr
        if (barEndStr <= barStartStr) return

        const colStart = weekStrs.indexOf(barStartStr)
        if (colStart === -1) return

        // Last day the guest occupies: one day before the exclusive checkout
        const barEndDayStr = shiftDay(barEndStr, -1)
        let colEnd = weekStrs.indexOf(barEndDayStr)
        if (colEnd === -1) {
          // Bar continues into next week — extend to last column of this week
          colEnd = weekStrs.reduce((last, s, i) => (s !== null ? i : last), colStart)
        }

        const colorIdx = roomColorMap[(res.room_ids ?? [])[0]] ?? 0
        const roomName = rooms.find(r => (res.room_ids ?? []).includes(r.id))?.name ?? ''
        ;(map[wIdx] ??= []).push({
          colStart, colEnd, reservation: res, colorIdx, roomName,
          isStart: ciStr === barStartStr,  // arrival day is visible in this week
          isEnd:   coStr === barEndStr,    // checkout day is visible in this week
        })
      })
    }
    return map
  }, [allReservations, weeks, roomColorMap, rooms])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">{format(currentMonth, 'MMMM yyyy')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="flex items-center justify-center w-9 h-9 rounded-[6px] border border-border text-text-secondary hover:bg-border transition-colors" aria-label="Previous month"><CaretLeft size={16} /></button>
          <button onClick={() => setCurrentMonth(new Date())} className="h-9 px-3 rounded-[6px] border border-border font-body text-[14px] text-text-secondary hover:bg-border transition-colors">Today</button>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="flex items-center justify-center w-9 h-9 rounded-[6px] border border-border text-text-secondary hover:bg-border transition-colors" aria-label="Next month"><CaretRight size={16} /></button>
        </div>
      </div>

      {/* Room legend */}
      {rooms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {rooms.map((room, i) => (
            <span key={room.id} className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-body border', ROOM_COLORS_PILL[i % ROOM_COLORS_PILL.length])}>{room.name}</span>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="border border-border rounded-[8px] overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-border bg-surface-raised">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="px-3 py-2 font-body text-[12px] font-semibold uppercase tracking-wider text-text-muted text-center">{d}</div>
          ))}
        </div>

        {isLoading ? (
          <div className="animate-pulse bg-border h-96 w-full" />
        ) : (
          <div>
            {weeks.map((week, wIdx) => {
              const weekBars = barsByWeek[wIdx] ?? []
              // How many bars stack in this week → drive cell min-height
              const barRows = weekBars.length
              const cellPb  = Math.max(2, barRows) * 26 + 8

              return (
                <div key={wIdx} className="relative border-b border-border last:border-b-0">
                  {/* Day cells */}
                  <div className="grid grid-cols-7">
                    {week.map((day, dIdx) => {
                      const inMonth    = day && isSameMonth(day, currentMonth)
                      const isTodayDay = day && isToday(day)
                      return (
                        <div
                          key={dIdx}
                          onClick={() => day && inMonth && setNewResDate(day)}
                          className={cn(
                            'pt-2 px-2 min-h-[90px] group cursor-pointer select-none',
                            dIdx < 6 && 'border-r border-border',
                            !inMonth && 'opacity-40 bg-background',
                            isTodayDay && 'bg-info-bg/20',
                            day && inMonth && 'hover:bg-info-bg/10',
                          )}
                          style={{ paddingBottom: cellPb }}
                        >
                          {day && (
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                'inline-flex items-center justify-center w-7 h-7 rounded-full font-mono text-[13px]',
                                isTodayDay ? 'bg-text-primary text-white font-semibold' : 'text-text-secondary'
                              )}>{format(day, 'd')}</span>
                              {inMonth && (
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Plus size={12} className="text-text-muted" />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Reservation bars (absolute over the cells) */}
                  <div className="absolute inset-0 top-[36px] pointer-events-none">
                    {weekBars.map((bar, bIdx) => {
                      const res       = bar.reservation
                      const guest     = res.guests ?? {}
                      const isPending = res.status === 'pending'
                      const multiCell = bar.colEnd > bar.colStart

                      // Time-of-day offsets: only when bar spans >1 column
                      // (prevents negative-width bars on single-night stays)
                      const cellPct        = 100 / 7
                      const arrivalOffset  = (bar.isStart && multiCell) ? (CHECK_IN_HOUR  / 24) * cellPct : 0
                      const departureOffset= (bar.isEnd   && multiCell) ? ((24 - CHECK_OUT_HOUR) / 24) * cellPct : 0

                      const leftPct  = (bar.colStart / 7) * 100 + arrivalOffset
                      const widthPct = ((bar.colEnd - bar.colStart + 1) / 7) * 100 - arrivalOffset - departureOffset

                      return (
                        <button
                          key={bIdx}
                          onClick={e => { e.stopPropagation(); setSelectedRes(res) }}
                          className={cn(
                            'absolute h-6 flex items-center gap-1 pointer-events-auto cursor-pointer transition-opacity hover:opacity-80 px-2',
                            ROOM_COLORS_BG[bar.colorIdx],
                            ROOM_COLORS_TEXT[bar.colorIdx],
                            isPending && 'border border-dashed border-current opacity-80',
                            // Rounded ends: arrival day = left rounded, departure day = right rounded
                            bar.isStart ? 'rounded-l-[4px]' : 'rounded-l-none',
                            bar.isEnd   ? 'rounded-r-[4px]' : 'rounded-r-none',
                          )}
                          style={{
                            left:  `calc(${leftPct}% + 1px)`,
                            width: `calc(${widthPct}% - 2px)`,
                            top:   `${bIdx * 26}px`,
                          }}
                          title={`${bar.roomName} · ${guest.first_name ?? ''} ${guest.last_name ?? ''} · Check-in ${CHECK_IN_HOUR}:00, Check-out ${CHECK_OUT_HOUR}:00`}
                        >
                          <span className="font-body text-[11px] font-semibold truncate leading-none">{bar.roomName}</span>
                          {guest.last_name && (
                            <span className="font-body text-[11px] opacity-70 truncate leading-none">· {guest.last_name}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="font-body text-[13px] text-text-muted">Click any bar to view details · Click any date to create a new reservation.</p>

      {/* Reservation detail popup */}
      {selectedRes && <ReservationPopup reservation={selectedRes} rooms={rooms} onClose={() => setSelectedRes(null)} />}

      {/* New reservation modal — date pre-filled from click */}
      {newResDate && (
        <ReservationModal
          open
          defaultCheckIn={format(newResDate, 'yyyy-MM-dd')}
          onClose={() => setNewResDate(null)}
        />
      )}
    </div>
  )
}
