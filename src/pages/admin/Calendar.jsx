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
import { CaretLeft, CaretRight, User, CalendarBlank, Door, Plus, FileText, EnvelopeSimple, PencilSimple, Wrench, Prohibit } from '@phosphor-icons/react'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useReservations } from '@/hooks/useReservations'
import { useRooms } from '@/hooks/useRooms'
import { useProperty } from '@/lib/property/PropertyContext'
import { useToast } from '@/components/ui/useToast'
import { ReservationModal } from '@/components/reservations/ReservationModal'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { StatusChip } from '@/components/shared/StatusChip'
import { getPaletteColor, getPaletteByIndex } from '@/config/roomPalette'
import { queryKeys } from '@/config/queryKeys'
import { cn, fmtMoney } from '@/lib/utils'

/** Resolve palette color for a room — uses room.color if set, falls back to index. */
function roomColor(room, index) {
  return room?.color ? getPaletteColor(room.color) : getPaletteByIndex(index)
}

// ── Field label helper ────────────────────────────────────────────────────────

function FieldLabel({ children }) {
  return (
    <span className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
      {children}
    </span>
  )
}

// ── Reservation detail drawer ────────────────────────────────────────────────

function CalendarReservationDrawer({ reservation, rooms, onClose, onEdit }) {
  const [sendingInvoice, setSendingInvoice] = useState(false)
  const { addToast } = useToast()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  if (!reservation) return null

  const guest     = reservation.guests ?? {}
  const nights    = reservation.check_in && reservation.check_out
    ? Math.max(0, differenceInDays(parseISO(reservation.check_out), parseISO(reservation.check_in)))
    : 0
  const roomNames = (reservation.room_ids ?? []).map(id => rooms.find(r => r.id === id)?.name ?? id)
  const roomIdx   = rooms.findIndex(r => (reservation.room_ids ?? []).includes(r.id))
  const pal       = roomColor(rooms[roomIdx] ?? null, Math.max(0, roomIdx))

  async function handleSendInvoice() {
    setSendingInvoice(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${supabaseUrl}/functions/v1/send-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ reservation_id: reservation.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to send invoice')
      }
      addToast({ message: 'Invoice emailed to guest', variant: 'success' })
    } catch (err) {
      addToast({ message: err.message || 'Failed to send invoice', variant: 'danger' })
    } finally {
      setSendingInvoice(false)
    }
  }

  return (
    <Drawer open onClose={onClose} title="Reservation Details" width={440}>
      <div className="flex flex-col gap-5">
        <div>
          <FieldLabel>Confirmation #</FieldLabel>
          <p className="font-mono text-[16px] text-text-primary mt-1">{reservation.confirmation_number ?? '—'}</p>
        </div>

        <div>
          <FieldLabel>Status</FieldLabel>
          <div className="mt-1"><StatusChip status={reservation.status} /></div>
        </div>

        {(guest.first_name || guest.last_name) && (
          <div>
            <FieldLabel>Guest</FieldLabel>
            <p className="font-body text-[15px] text-text-primary mt-1">{guest.first_name} {guest.last_name}</p>
            {guest.email && <p className="font-body text-[13px] text-text-secondary">{guest.email}</p>}
            {guest.phone && <p className="font-body text-[13px] text-text-secondary">{guest.phone}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Check-in</FieldLabel>
            <p className="font-mono text-[14px] text-text-primary mt-1">
              {reservation.check_in ? format(parseISO(reservation.check_in), 'MMM d, yyyy') : '—'}
            </p>
          </div>
          <div>
            <FieldLabel>Check-out</FieldLabel>
            <p className="font-mono text-[14px] text-text-primary mt-1">
              {reservation.check_out ? format(parseISO(reservation.check_out), 'MMM d, yyyy') : '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Nights</FieldLabel>
            <p className="font-mono text-[14px] text-text-primary mt-1">{nights}</p>
          </div>
          <div>
            <FieldLabel>Guests</FieldLabel>
            <p className="font-mono text-[14px] text-text-primary mt-1">{reservation.num_guests ?? '—'}</p>
          </div>
        </div>

        <div>
          <FieldLabel>Room</FieldLabel>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {roomNames.map((name, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-body font-medium"
                style={{ backgroundColor: pal.bg, color: pal.text, borderWidth: 1, borderColor: pal.border, borderStyle: 'solid' }}
              >{name}</span>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Total Due</FieldLabel>
          <p className="font-mono text-[20px] text-text-primary mt-1">
            {fmtMoney(reservation.total_due_cents ?? 0)}
          </p>
        </div>

        {reservation.notes && (
          <div>
            <FieldLabel>Notes</FieldLabel>
            <p className="font-body text-[14px] text-text-secondary mt-1">{reservation.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-border pt-4 mt-1 flex flex-col gap-2">
          <Button variant="primary" size="sm" onClick={() => { onClose(); onEdit(reservation) }}>
            <PencilSimple size={16} weight="bold" /> Edit Reservation
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => window.open(`/invoice/${reservation.id}`, '_blank')}>
              <FileText size={16} /> View Invoice
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" loading={sendingInvoice} onClick={handleSendInvoice}>
              <EnvelopeSimple size={16} /> Email Invoice
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

// ── Block detail drawer (maintenance / seasonal closure) ─────────────────────

function BlockDrawer({ block, onClose }) {
  if (!block) return null

  const isMaintenance = block.type === 'maintenance'
  const title = isMaintenance ? 'Maintenance Block' : 'Seasonal Closure'

  return (
    <Drawer open onClose={onClose} title={title} width={400}>
      <div className="flex flex-col gap-5">
        {isMaintenance ? (
          <>
            <div className="flex items-center gap-2">
              <Wrench size={18} weight="fill" className="text-warning" />
              <span className="font-body text-[15px] font-semibold text-text-primary">{block.title}</span>
            </div>
            <div>
              <FieldLabel>Room</FieldLabel>
              <p className="font-body text-[15px] text-text-primary mt-1">{block.roomName}</p>
            </div>
            <div>
              <FieldLabel>Priority</FieldLabel>
              <p className={cn(
                'font-body text-[14px] mt-1 capitalize font-medium',
                block.priority === 'urgent' ? 'text-danger' : block.priority === 'high' ? 'text-warning' : 'text-text-primary',
              )}>{block.priority}</p>
            </div>
            {block.description && (
              <div>
                <FieldLabel>Notes</FieldLabel>
                <p className="font-body text-[14px] text-text-secondary mt-1">{block.description}</p>
              </div>
            )}
            <div className="border-t border-border pt-4 mt-1">
              <p className="font-body text-[13px] text-text-muted">
                This room is blocked from booking until the ticket is resolved. Manage it on the Maintenance page.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Prohibit size={18} weight="fill" className="text-text-muted" />
              <span className="font-body text-[15px] font-semibold text-text-primary">Property Closed</span>
            </div>
            {block.start && block.end && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>From</FieldLabel>
                  <p className="font-mono text-[14px] text-text-primary mt-1">{format(parseISO(block.start), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <FieldLabel>Until</FieldLabel>
                  <p className="font-mono text-[14px] text-text-primary mt-1">{format(parseISO(block.end), 'MMM d, yyyy')}</p>
                </div>
              </div>
            )}
            {block.message && (
              <div>
                <FieldLabel>Message to Guests</FieldLabel>
                <p className="font-body text-[14px] text-text-secondary mt-1">{block.message}</p>
              </div>
            )}
            <div className="border-t border-border pt-4 mt-1">
              <p className="font-body text-[13px] text-text-muted">
                Seasonal closure dates can be changed in Settings → Booking Widget.
              </p>
            </div>
          </>
        )}
      </div>
    </Drawer>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedRes, setSelectedRes]   = useState(null)   // reservation drawer
  const [editingRes, setEditingRes]     = useState(null)    // reservation edit modal
  const [selectedBlock, setSelectedBlock] = useState(null)  // block detail drawer
  const [newResDate, setNewResDate]     = useState(null)    // date clicked to create reservation

  // Fetch only reservations that could be visible in the current calendar view.
  // dateFrom goes back 2 months so long stays that started before this month are included.
  // dateTo covers the end of the current month (+1 month to catch check-ins right after month end).
  const calDateFrom = useMemo(
    () => format(subMonths(startOfMonth(currentMonth), 2), 'yyyy-MM-dd'),
    [currentMonth],
  )
  const calDateTo = useMemo(
    () => format(endOfMonth(addMonths(currentMonth, 1)), 'yyyy-MM-dd'),
    [currentMonth],
  )
  const { data, isLoading } = useReservations({ dateFrom: calDateFrom, dateTo: calDateTo })
  const { data: rooms = [] } = useRooms()
  const { propertyId, property } = useProperty()

  // Fetch open maintenance tickets that block booking
  const { data: blockingTickets = [] } = useQuery({
    queryKey: queryKeys.maintenance.open(propertyId),
    queryFn: async () => {
      if (!propertyId) return []
      const { data: d } = await supabase
        .from('maintenance_tickets')
        .select('id, room_id, title, description, priority, status, category')
        .eq('property_id', propertyId)
        .eq('blocks_booking', true)
        .neq('status', 'resolved')
      return d ?? []
    },
    enabled: !!propertyId,
  })

  // Blocked room IDs from maintenance
  const blockedRoomIds = useMemo(() => new Set(blockingTickets.map(t => t.room_id)), [blockingTickets])

  // Seasonal closure date range
  const closureStart = property?.seasonal_closure_start ?? null
  const closureEnd = property?.seasonal_closure_end ?? null

  const allReservations = useMemo(() => data?.pages?.flatMap(p => p.data) ?? [], [data])

  // Map room id → palette entry (uses room.color with index fallback)
  const roomPalMap = useMemo(() => {
    const map = {}
    rooms.forEach((room, i) => { map[room.id] = roomColor(room, i) })
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

    // Build a room buffer map for buffer day bar generation
    const roomBufferMap = {}
    for (const r of rooms) {
      roomBufferMap[r.id] = { before: r.buffer_days_before ?? 0, after: r.buffer_days_after ?? 0 }
    }

    const map = {}
    for (const res of allReservations) {
      if (!res.check_in || !res.check_out) continue
      const ciStr = res.check_in   // YYYY-MM-DD
      const coStr = res.check_out  // YYYY-MM-DD (exclusive — guest leaves this morning)

      const firstRoomId = (res.room_ids ?? [])[0]
      const pal = roomPalMap[firstRoomId] ?? getPaletteByIndex(0)

      // Compute buffer days for this reservation (max across all rooms)
      let bufBefore = 0
      let bufAfter = 0
      for (const rid of (res.room_ids ?? [])) {
        const buf = roomBufferMap[rid]
        if (buf) {
          bufBefore = Math.max(bufBefore, buf.before)
          bufAfter = Math.max(bufAfter, buf.after)
        }
      }

      // Generate buffer bars BEFORE the reservation
      if (bufBefore > 0) {
        const bufStartStr = shiftDay(ciStr, -bufBefore)
        const bufEndStr = ciStr // exclusive end (buffer ends when check-in starts)
        if (bufEndStr > viewFirstStr && bufStartStr <= viewLastStr) {
          weeks.forEach((week, wIdx) => {
            const weekStrs = week.map(d => (d ? format(d, 'yyyy-MM-dd') : null))
            const realStrs = weekStrs.filter(Boolean)
            if (!realStrs.length) return
            const weekFirstStr = realStrs[0]
            const weekLastStr = realStrs[realStrs.length - 1]
            const weekNextStr = shiftDay(weekLastStr, 1)
            const barStartStr = bufStartStr > weekFirstStr ? bufStartStr : weekFirstStr
            const barEndStr2 = bufEndStr <= weekNextStr ? bufEndStr : weekNextStr
            if (barEndStr2 <= barStartStr) return
            const colStart = weekStrs.indexOf(barStartStr)
            if (colStart === -1) return
            const barEndDayStr = shiftDay(barEndStr2, -1)
            let colEnd = weekStrs.indexOf(barEndDayStr)
            if (colEnd === -1) colEnd = weekStrs.reduce((last, s, i) => (s !== null ? i : last), colStart)
            ;(map[wIdx] ??= []).push({
              colStart, colEnd, reservation: null, pal, roomName: '',
              isStart: bufStartStr === barStartStr, isEnd: bufEndStr === barEndStr2,
              isBuffer: true, resId: res.id,
            })
          })
        }
      }

      // Generate buffer bars AFTER the reservation
      if (bufAfter > 0) {
        const bufStartStr = coStr
        const bufEndStr = shiftDay(coStr, bufAfter) // exclusive end
        if (bufEndStr > viewFirstStr && bufStartStr <= viewLastStr) {
          weeks.forEach((week, wIdx) => {
            const weekStrs = week.map(d => (d ? format(d, 'yyyy-MM-dd') : null))
            const realStrs = weekStrs.filter(Boolean)
            if (!realStrs.length) return
            const weekFirstStr = realStrs[0]
            const weekLastStr = realStrs[realStrs.length - 1]
            const weekNextStr = shiftDay(weekLastStr, 1)
            const barStartStr = bufStartStr > weekFirstStr ? bufStartStr : weekFirstStr
            const barEndStr2 = bufEndStr <= weekNextStr ? bufEndStr : weekNextStr
            if (barEndStr2 <= barStartStr) return
            const colStart = weekStrs.indexOf(barStartStr)
            if (colStart === -1) return
            const barEndDayStr = shiftDay(barEndStr2, -1)
            let colEnd = weekStrs.indexOf(barEndDayStr)
            if (colEnd === -1) colEnd = weekStrs.reduce((last, s, i) => (s !== null ? i : last), colStart)
            ;(map[wIdx] ??= []).push({
              colStart, colEnd, reservation: null, pal, roomName: '',
              isStart: bufStartStr === barStartStr, isEnd: bufEndStr === barEndStr2,
              isBuffer: true, resId: res.id,
            })
          })
        }
      }

      // Skip reservation bar if entirely outside view
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

        const roomName = rooms.find(r => (res.room_ids ?? []).includes(r.id))?.name ?? ''
        ;(map[wIdx] ??= []).push({
          colStart, colEnd, reservation: res, pal, roomName,
          isStart: ciStr === barStartStr,  // arrival day is visible in this week
          isEnd:   coStr === barEndStr,    // checkout day is visible in this week
          isBuffer: false, resId: res.id,
        })
      })
    }

    // Add maintenance block bars — one per blocked room, spanning the full week
    for (const ticket of blockingTickets) {
      const room = rooms.find(r => r.id === ticket.room_id)
      if (!room) continue
      weeks.forEach((week, wIdx) => {
        const weekStrs = week.map(d => (d ? format(d, 'yyyy-MM-dd') : null))
        const firstIdx = weekStrs.findIndex(s => s !== null)
        const lastIdx = weekStrs.reduce((last, s, i) => (s !== null ? i : last), -1)
        if (firstIdx === -1) return
        ;(map[wIdx] ??= []).push({
          colStart: firstIdx, colEnd: lastIdx,
          reservation: null, pal: null, roomName: room.name,
          isStart: true, isEnd: true,
          isBuffer: false, isMaintenance: true, resId: `maint-${ticket.id}`,
          ticket,
        })
      })
    }

    return map
  }, [allReservations, weeks, roomPalMap, rooms, blockingTickets])

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary uppercase">{format(currentMonth, 'MMMM yyyy')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="flex items-center justify-center w-9 h-9 rounded-[6px] border border-border text-text-secondary hover:bg-border transition-colors" aria-label="Previous month"><CaretLeft size={16} /></button>
          <button onClick={() => setCurrentMonth(new Date())} className="h-9 px-3 rounded-[6px] border border-border font-body text-[14px] text-text-secondary hover:bg-border transition-colors">Today</button>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="flex items-center justify-center w-9 h-9 rounded-[6px] border border-border text-text-secondary hover:bg-border transition-colors" aria-label="Next month"><CaretRight size={16} /></button>
        </div>
      </div>

      {/* Room legend */}
      {rooms.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {rooms.map((room, i) => {
            const pal = roomColor(room, i)
            return (
              <span
                key={room.id}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-body font-medium"
                style={{ backgroundColor: pal.bg, color: pal.text, borderWidth: 1, borderColor: pal.border, borderStyle: 'solid' }}
              >{room.name}</span>
            )
          })}
          {rooms.some(r => (r.buffer_days_before ?? 0) > 0 || (r.buffer_days_after ?? 0) > 0) && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-body relative overflow-hidden">
              <span className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, #888 3px, #888 5px)', opacity: 0.25 }} />
              <span className="relative font-semibold text-text-secondary">Buffer</span>
            </span>
          )}
          {blockedRoomIds.size > 0 && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-body relative overflow-hidden">
              <span className="absolute inset-0" style={{ backgroundImage: 'var(--stripe-diagonal)' }} />
              <span className="relative font-semibold text-text-secondary">Maintenance</span>
            </span>
          )}
          {closureStart && closureEnd && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-body relative overflow-hidden">
              <span className="absolute inset-0 opacity-30" style={{ backgroundImage: 'var(--stripe-diagonal)' }} />
              <span className="relative font-semibold text-text-secondary">Seasonal Closure</span>
            </span>
          )}
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
                      // Check if this day falls in a seasonal closure
                      const dayStr = day ? format(day, 'yyyy-MM-dd') : null
                      const isClosed = dayStr && closureStart && closureEnd && dayStr >= closureStart && dayStr <= closureEnd
                      return (
                        <div
                          key={dIdx}
                          role="button"
                          tabIndex={day && inMonth ? 0 : -1}
                          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && day && inMonth) { e.preventDefault(); isClosed ? setSelectedBlock({ type: 'closure', start: closureStart, end: closureEnd, message: property?.seasonal_closure_message }) : setNewResDate(day) } }}
                          onClick={() => { if (day && inMonth) { isClosed ? setSelectedBlock({ type: 'closure', start: closureStart, end: closureEnd, message: property?.seasonal_closure_message }) : setNewResDate(day) } }}
                          className={cn(
                            'pt-2 px-2 min-h-[90px] group cursor-pointer select-none relative',
                            dIdx < 6 && 'border-r border-border',
                            !inMonth && 'opacity-40 bg-background',
                            isTodayDay && 'bg-info-bg/20',
                            day && inMonth && !isClosed && 'hover:bg-info-bg/10',
                          )}
                          style={{ paddingBottom: cellPb }}
                        >
                          {isClosed && inMonth && (
                            <div
                              className="absolute inset-0 opacity-30 pointer-events-none"
                              style={{ backgroundImage: 'var(--stripe-diagonal)' }}
                            />
                          )}
                          {day && (
                            <div className="flex items-center justify-between relative">
                              <span className={cn(
                                'inline-flex items-center justify-center w-7 h-7 rounded-full font-mono text-[13px]',
                                isTodayDay ? 'bg-text-primary text-white font-semibold' : 'text-text-secondary'
                              )}>{format(day, 'd')}</span>
                              {inMonth && !isClosed && (
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

                  {/* Reservation + buffer bars (absolute over the cells) */}
                  <div className="absolute inset-0 top-[36px] pointer-events-none">
                    {(() => {
                      // Allocate rows: bars with the same resId share a row (buffer + reservation inline)
                      const rows = [] // each row is an array of { colStart, colEnd } ranges
                      const resRowMap = {} // resId → allocated row index
                      const barRows = weekBars.map(bar => {
                        // If this resId already has a row, reuse it
                        if (bar.resId && resRowMap[bar.resId] !== undefined) {
                          const r = resRowMap[bar.resId]
                          rows[r].push({ colStart: bar.colStart, colEnd: bar.colEnd })
                          return r
                        }
                        // Otherwise find a row where this bar fits
                        for (let r = 0; r < rows.length; r++) {
                          if (rows[r].every(used => bar.colEnd < used.colStart || bar.colStart > used.colEnd)) {
                            rows[r].push({ colStart: bar.colStart, colEnd: bar.colEnd })
                            if (bar.resId) resRowMap[bar.resId] = r
                            return r
                          }
                        }
                        rows.push([{ colStart: bar.colStart, colEnd: bar.colEnd }])
                        const r = rows.length - 1
                        if (bar.resId) resRowMap[bar.resId] = r
                        return r
                      })
                      return weekBars.map((bar, bIdx) => {
                      const cellPct = 100 / 7
                      const pal = bar.pal
                      const rowIdx = barRows[bIdx]

                      if (bar.isMaintenance) {
                        // Maintenance block — full-width grey stripe bar with room name, clickable
                        return (
                          <button
                            key={bIdx}
                            className="absolute h-6 rounded-[4px] flex items-center px-2 pointer-events-auto cursor-pointer hover:opacity-70 transition-opacity"
                            onClick={e => { e.stopPropagation(); setSelectedBlock({ type: 'maintenance', title: bar.ticket.title, description: bar.ticket.description, priority: bar.ticket.priority, roomName: bar.roomName }) }}
                            style={{
                              left: '1px',
                              width: 'calc(100% - 2px)',
                              top: `${rowIdx * 26}px`,
                              backgroundImage: 'var(--stripe-diagonal)',
                            }}
                            title={`${bar.roomName} — Maintenance (blocks booking)`}
                          >
                            <span className="font-body text-[11px] font-semibold text-text-secondary truncate leading-none">
                              {bar.roomName} — Maintenance
                            </span>
                          </button>
                        )
                      }

                      if (bar.isBuffer) {
                        // Buffer day bar — diagonal stripe pattern, non-clickable
                        const leftPct = (bar.colStart / 7) * 100
                        const widthPct = ((bar.colEnd - bar.colStart + 1) / 7) * 100
                        return (
                          <div
                            key={bIdx}
                            className="absolute h-6 rounded-[4px]"
                            style={{
                              left: `calc(${leftPct}% + 1px)`,
                              width: `calc(${widthPct}% - 2px)`,
                              top: `${rowIdx * 26}px`,
                              backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, #888 3px, #888 5px)',
                              opacity: 0.4,
                            }}
                            title="Buffer days"
                          />
                        )
                      }

                      const res       = bar.reservation
                      const guest     = res.guests ?? {}
                      const isPending = res.status === 'pending'

                      // Time-of-day offsets: shift bar start/end to reflect check-in/check-out times.
                      const rawArrival   = bar.isStart ? (CHECK_IN_HOUR / 24) * cellPct : 0
                      const rawDeparture = bar.isEnd   ? ((24 - CHECK_OUT_HOUR) / 24) * cellPct : 0
                      const totalBarPct  = ((bar.colEnd - bar.colStart + 1) / 7) * 100
                      const minBarPct    = cellPct * 0.3
                      const shrink       = rawArrival + rawDeparture
                      const scale        = (totalBarPct - shrink) < minBarPct ? Math.max(0, (totalBarPct - minBarPct) / (shrink || 1)) : 1
                      const arrivalOffset   = rawArrival * scale
                      const departureOffset = rawDeparture * scale

                      const leftPct  = (bar.colStart / 7) * 100 + arrivalOffset
                      const widthPct = ((bar.colEnd - bar.colStart + 1) / 7) * 100 - arrivalOffset - departureOffset

                      return (
                        <button
                          key={bIdx}
                          onClick={e => { e.stopPropagation(); setSelectedRes(res) }}
                          className={cn(
                            'absolute h-6 flex items-center gap-1 pointer-events-auto cursor-pointer transition-opacity hover:opacity-80 px-2',
                            'border border-dashed',
                            isPending && 'opacity-80',
                            bar.isStart ? 'rounded-l-[4px]' : 'rounded-l-none',
                            bar.isEnd   ? 'rounded-r-[4px]' : 'rounded-r-none',
                          )}
                          style={{
                            left:  `calc(${leftPct}% + 1px)`,
                            width: `calc(${widthPct}% - 2px)`,
                            top:   `${rowIdx * 26}px`,
                            backgroundColor: pal.bg,
                            color: pal.text,
                            borderColor: pal.border,
                          }}
                          title={`${bar.roomName} · ${guest.first_name ?? ''} ${guest.last_name ?? ''} · Check-in ${CHECK_IN_HOUR}:00, Check-out ${CHECK_OUT_HOUR}:00`}
                        >
                          <span className="font-body text-[11px] font-semibold truncate leading-none">{bar.roomName}</span>
                          {guest.last_name && (
                            <span className="font-body text-[11px] opacity-70 truncate leading-none">· {guest.last_name}</span>
                          )}
                        </button>
                      )
                    })
                    })()}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="font-body text-[13px] text-text-muted">Click a reservation to view or edit · Click a date to create a new reservation · Click a block for details.</p>

      {/* Reservation detail popup */}
      {/* Reservation detail drawer */}
      <CalendarReservationDrawer
        reservation={selectedRes}
        rooms={rooms}
        onClose={() => setSelectedRes(null)}
        onEdit={(res) => setEditingRes(res)}
      />

      {/* Block detail drawer (maintenance / seasonal closure) */}
      <BlockDrawer block={selectedBlock} onClose={() => setSelectedBlock(null)} />

      {/* Edit reservation modal */}
      {editingRes && (
        <ReservationModal
          open
          reservationToEdit={editingRes}
          onClose={() => setEditingRes(null)}
        />
      )}

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
