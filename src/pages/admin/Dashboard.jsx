// src/pages/admin/Dashboard.jsx
// Dashboard: greeting + weather, TODAY/TOMORROW toggle,
// expandable magazine-grid stat cards, 14-day room calendar.

import { useState, useMemo, createElement } from 'react'
import { Link } from 'react-router-dom'
import {
  format, isToday, parseISO, addDays, startOfDay,
  subMonths, startOfMonth, formatDistanceToNow,
} from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import {
  Sun, CloudSun, Cloud, CloudFog, CloudRain, CloudSnow, CloudLightning,
  WarningCircle, Plus, ArrowRight, Bell, UserCircle, CaretDown, CaretUp,
  Door, Printer,
} from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { getPaletteColor, getPaletteByIndex } from '@/config/roomPalette'
import { ReservationModal } from '@/components/reservations/ReservationModal'
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist'
import { Button } from '@/components/ui/Button'
import { FolderCard } from '@/components/shared/FolderCard'
import { cn, dollars } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

function wmoToIcon(code) {
  if (code === 0)                                                        return Sun
  if (code <= 2)                                                         return CloudSun
  if (code <= 3 || code === 45 || code === 48)                           return Cloud
  if (code >= 51 && code <= 57)                                          return CloudFog
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))         return CloudRain
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)         return CloudSnow
  if (code >= 95)                                                        return CloudLightning
  return Cloud
}

function useWeather(lat, lon) {
  return useQuery({
    queryKey: queryKeys.weather.current(lat, lon),
    queryFn: async () => {
      const url = new URL('https://api.open-meteo.com/v1/forecast')
      url.searchParams.set('latitude', lat)
      url.searchParams.set('longitude', lon)
      url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min')
      url.searchParams.set('current_weather', 'true')
      url.searchParams.set('temperature_unit', 'fahrenheit')
      url.searchParams.set('forecast_days', '1')
      url.searchParams.set('timezone', 'auto')
      const res = await fetch(url.toString())
      if (!res.ok) return null
      return res.json()
    },
    enabled: lat != null && lon != null,
    staleTime: 1000 * 60 * 30,
    retry: false,
  })
}

function WeatherStrip() {
  const { property } = useProperty()
  const lat = property?.lat != null ? Number(property.lat) : null
  const lon = property?.lon != null ? Number(property.lon) : null
  const { data } = useWeather(lat, lon)
  if (lat == null || lon == null || !data?.current_weather) return null
  const code = data.current_weather.weathercode ?? 0
  const temp = Math.round(data.current_weather.temperature ?? 0)
  const high = Math.round(data.daily?.temperature_2m_max?.[0] ?? 0)
  const low  = Math.round(data.daily?.temperature_2m_min?.[0] ?? 0)
  return (
    <div className="flex items-center gap-1.5 select-none" aria-hidden="true">
      {createElement(wmoToIcon(code), { size: 14, weight: 'thin', className: 'text-text-muted shrink-0' })}
      <span className="font-mono text-[13px] text-text-secondary">{temp}°</span>
      <span className="font-mono text-[11px] text-text-muted">H:{high} L:{low}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useRoomsForCalendar() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: queryKeys.rooms.list(),
    queryFn: async () => {
      if (!propertyId) return []
      const { data } = await supabase
        .from('rooms')
        .select('id, name, color')
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .order('name')
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function useCalendarReservations() {
  const { propertyId } = useProperty()
  const today = startOfDay(new Date())
  const end   = addDays(today, 14)
  return useQuery({
    queryKey: ['calendar-reservations', propertyId, format(today, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!propertyId) return []
      const { data } = await supabase
        .from('reservations')
        .select('id, room_ids, check_in, check_out, status, num_guests, confirmation_number, guests(first_name, last_name)')
        .eq('property_id', propertyId)
        .lt('check_in', format(end, 'yyyy-MM-dd'))
        .gte('check_out', format(today, 'yyyy-MM-dd'))
        .neq('status', 'cancelled')
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function useOpenMaintenanceTickets() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: queryKeys.maintenance.open(propertyId),
    queryFn: async () => {
      if (!propertyId) return []
      const { data } = await supabase
        .from('maintenance_tickets')
        .select('id, room_id, priority, blocks_booking, status')
        .eq('property_id', propertyId)
        .neq('status', 'resolved')
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function usePaymentsSummary() {
  const { propertyId } = useProperty()
  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  return useQuery({
    queryKey: ['dashboard-payments', propertyId, monthStart],
    queryFn: async () => {
      if (!propertyId) return { thisMonth: 0, ytd: 0 }
      const yearStart = format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd')
      const { data } = await supabase
        .from('payments')
        .select('amount_cents, created_at, status, type')
        .eq('property_id', propertyId)
        .in('status', ['succeeded', 'paid'])
        .eq('type', 'charge')
        .gte('created_at', yearStart)
      const payments = data ?? []
      const thisMonth = payments
        .filter(p => p.created_at.startsWith(monthStart.slice(0, 7)))
        .reduce((s, p) => s + (p.amount_cents ?? 0), 0)
      const ytd = payments
        .filter(p => p.created_at.startsWith(String(now.getFullYear())))
        .reduce((s, p) => s + (p.amount_cents ?? 0), 0)
      return { thisMonth, ytd }
    },
    enabled: !!propertyId,
  })
}

function useGuestActivity() {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: queryKeys.guestActivity.list(propertyId),
    queryFn: async () => {
      if (!propertyId) return []
      const { data } = await supabase
        .from('guest_portal_activity')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(10)
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

// ---------------------------------------------------------------------------
// Shared card shell — left accent bar + collapsible body
// ---------------------------------------------------------------------------

const ACCENT = {
  arriving:  '#D2E8A4',
  departing: '#A8C4DC',
  modified:  '#E85028',
  occupancy: '#5C2D6E',   // deep plum
  revenue:   '#C8D42A',
}

function StatCard({ id, label, count, icon: Icon, children, loading, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const accent = ACCENT[id] ?? '#888'
  const hasDetail = !!children

  return (
    <FolderCard tabColor={accent} tabLabel={label} bodyClassName="p-0">
      <div className="flex flex-col">
        {/* Header row — always visible */}
        <button
          onClick={() => hasDetail && setOpen(o => !o)}
          className={cn(
            'flex items-center gap-3 px-5 py-4 w-full text-left transition-colors',
            hasDetail ? 'hover:bg-black/[0.025] cursor-pointer' : 'cursor-default',
          )}
        >
          {/* Count / primary stat */}
          {count != null && (
            <span className="font-mono text-[26px] font-bold text-text-primary leading-none">
              {count}
            </span>
          )}

          <span className="flex-1" />

          {/* Optional icon */}
          {Icon && !hasDetail && <Icon size={16} className="text-text-muted" />}

          {/* Expand caret */}
          {hasDetail && (
            open
              ? <CaretUp size={13} className="text-text-muted shrink-0" />
              : <CaretDown size={13} className="text-text-muted shrink-0" />
          )}
        </button>

        {/* Skeleton while loading */}
        {loading && (
          <div className="px-5 pb-5">
            <div className="animate-pulse bg-border h-12 rounded-[6px]" />
          </div>
        )}

        {/* Expandable detail */}
        {!loading && open && children && (
          <div className="px-5 pb-5 border-t border-border/50">
            {children}
          </div>
        )}
      </div>
    </FolderCard>
  )
}

// ---------------------------------------------------------------------------
// Guest row — shared by arriving + departing
// ---------------------------------------------------------------------------

function GuestRow({ reservation, rooms }) {
  const g = reservation.guests ?? {}
  const roomName = rooms.find(r => (reservation.room_ids ?? []).includes(r.id))?.name ?? '—'
  return (
    <li className="flex items-center gap-2.5 py-2 border-b border-border/40 last:border-b-0">
      <UserCircle size={15} className="text-text-muted shrink-0" />
      <span className="font-body text-[14px] font-medium text-text-primary">
        {g.first_name} {g.last_name}
      </span>
      <span className="font-body text-[13px] text-text-muted shrink-0">· {roomName}</span>
    </li>
  )
}

// ---------------------------------------------------------------------------
// Individual cards
// ---------------------------------------------------------------------------

function ArrivingCard({ reservations, rooms, dayView, loading }) {
  const empty = dayView === 'today' ? 'No arrivals today.' : 'No arrivals tomorrow.'
  return (
    <StatCard id="arriving" label="Arriving" count={reservations.length} loading={loading} defaultOpen>
      {reservations.length === 0
        ? <p className="font-body text-[13px] text-text-muted pt-3">{empty}</p>
        : (
          <ul className="mt-1">
            {reservations.map(r => <GuestRow key={r.id} reservation={r} rooms={rooms} />)}
          </ul>
        )
      }
    </StatCard>
  )
}

function DepartingCard({ reservations, rooms, dayView, loading }) {
  const empty = dayView === 'today' ? 'No departures today.' : 'No departures tomorrow.'
  return (
    <StatCard id="departing" label="Departing" count={reservations.length} loading={loading} defaultOpen>
      {reservations.length === 0
        ? <p className="font-body text-[13px] text-text-muted pt-3">{empty}</p>
        : (
          <ul className="mt-1">
            {reservations.map(r => <GuestRow key={r.id} reservation={r} rooms={rooms} />)}
          </ul>
        )
      }
    </StatCard>
  )
}

const ACTIVITY_LABELS = {
  modification_confirmed: 'Modified reservation',
  contact_updated: 'Updated contact info',
  booker_attached: 'Attached as booker',
}

function activityDetail(action, details) {
  if (action === 'modification_confirmed' && details) {
    const oldIn = details.old_check_in ? format(parseISO(details.old_check_in), 'MMM d') : ''
    const newIn = details.new_check_in ? format(parseISO(details.new_check_in), 'MMM d') : ''
    const oldOut = details.old_check_out ? format(parseISO(details.old_check_out), 'MMM d') : ''
    const newOut = details.new_check_out ? format(parseISO(details.new_check_out), 'MMM d') : ''
    return `${oldIn}–${oldOut} → ${newIn}–${newOut}`
  }
  if (action === 'contact_updated' && details) {
    const parts = []
    if (details.new_email) parts.push(`email → ${details.new_email}`)
    if (details.new_phone) parts.push(`phone → ${details.new_phone}`)
    return parts.join(', ')
  }
  if (action === 'booker_attached' && details) {
    return `on ${details.confirmation_number ?? 'reservation'}`
  }
  return ''
}

function GuestActivityCard({ activities, loading }) {
  return (
    <StatCard
      id="modified"
      label="Guest Modified"
      count={activities.length}
      loading={loading}
      defaultOpen={activities.length > 0}
    >
      {activities.length === 0
        ? <p className="font-body text-[13px] text-text-muted pt-3">No recent guest activity.</p>
        : (
          <ul className="mt-1">
            {activities.map(a => {
              const g = a.guests ?? {}
              const ago = a.created_at
                ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true })
                : ''
              const detail = activityDetail(a.action, a.details)
              return (
                <li key={a.id} className="flex flex-col gap-0.5 py-2.5 border-b border-border/40 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Bell size={13} weight="fill" className="text-warning shrink-0" />
                    <span className="font-body text-[14px] font-semibold text-text-primary">
                      {g.first_name} {g.last_name}
                    </span>
                  </div>
                  <span className="font-body text-[12px] text-text-secondary pl-5">
                    {ACTIVITY_LABELS[a.action] ?? a.action}
                    {detail && <span className="text-text-muted"> · {detail}</span>}
                  </span>
                  <span className="font-mono text-[11px] text-text-muted pl-5">{ago}</span>
                </li>
              )
            })}
          </ul>
        )
      }
    </StatCard>
  )
}

function OccupancyCardWrapper({ pct, inHouse, total, rooms, calReservations, loading }) {
  const [open, setOpen] = useState(false)
  const accent = ACCENT.occupancy
  const todayStr = format(startOfDay(new Date()), 'yyyy-MM-dd')

  const occupiedRoomIds = new Set(
    calReservations
      .filter(r => r.check_in <= todayStr && r.check_out > todayStr)
      .flatMap(r => r.room_ids ?? [])
  )

  return (
    <FolderCard tabColor={accent} tabLabel="Occupancy" bodyClassName="p-0">
      <div className="flex flex-col">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-start gap-3 px-5 pt-4 pb-4 w-full text-left hover:bg-black/[0.025] transition-colors"
        >
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[36px] font-bold text-text-primary leading-none">{pct}%</span>
              <span className="font-body text-[12px] text-text-muted">{inHouse}/{total}</span>
            </div>
          </div>
          {open ? <CaretUp size={13} className="text-text-muted shrink-0 mt-1" />
                : <CaretDown size={13} className="text-text-muted shrink-0 mt-1" />}
        </button>

        {loading && <div className="px-5 pb-4"><div className="animate-pulse bg-border h-8 rounded-[6px]" /></div>}

        {!loading && open && (
          <div className="px-5 pb-4 border-t border-border/50">
            <ul className="mt-2">
              {rooms.map(room => {
                const occupied = occupiedRoomIds.has(room.id)
                return (
                  <li key={room.id} className="flex items-center gap-2.5 py-1.5 border-b border-border/40 last:border-b-0">
                    <Door size={13} className={occupied ? 'text-danger' : 'text-success'} weight="bold" />
                    <span className="font-body text-[13px] text-text-primary">{room.name}</span>
                    <span className={cn(
                      'ml-auto font-body text-[11px] font-semibold uppercase tracking-wide',
                      occupied ? 'text-danger' : 'text-success'
                    )}>
                      {occupied ? 'Occupied' : 'Available'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </FolderCard>
  )
}

function RevenueCardWrapper({ thisMonth, ytd, loading }) {
  const [open, setOpen] = useState(false)
  const accent = ACCENT.revenue

  return (
    <FolderCard tabColor={accent} tabLabel="Monthly Revenue" bodyClassName="p-0">
      <div className="flex flex-col">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-start gap-3 px-5 pt-4 pb-4 w-full text-left hover:bg-black/[0.025] transition-colors"
        >
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[32px] font-bold text-text-primary leading-none">{dollars(thisMonth)}</span>
            </div>
          </div>
          {open ? <CaretUp size={13} className="text-text-muted shrink-0 mt-1" />
                : <CaretDown size={13} className="text-text-muted shrink-0 mt-1" />}
        </button>

        {loading && <div className="px-5 pb-4"><div className="animate-pulse bg-border h-8 rounded-[6px]" /></div>}

        {!loading && open && (
          <div className="px-5 pb-4 border-t border-border/50">
            <p className="font-body text-[13px] text-text-muted mt-3">
              Year to date: <span className="font-mono font-semibold text-text-secondary">{dollars(ytd)}</span>
            </p>
            <Link to="/reports" className="inline-flex items-center gap-1 mt-3 font-body text-[13px] text-info hover:underline">
              View full report <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </div>
    </FolderCard>
  )
}

// ---------------------------------------------------------------------------
// DayCards — magazine grid layout
// ---------------------------------------------------------------------------

function DayCards({ dayView, calReservations, rooms, payments, guestActivities, loading }) {
  const today    = startOfDay(new Date())
  const viewDate = dayView === 'today' ? today : addDays(today, 1)
  const dateStr  = format(viewDate, 'yyyy-MM-dd')
  const todayStr = format(today, 'yyyy-MM-dd')

  const arrivals   = calReservations.filter(r => r.check_in  === dateStr)
  const departures = calReservations.filter(r => r.check_out === dateStr)

  const inHouseToday = calReservations.filter(
    r => r.check_in <= todayStr && r.check_out > todayStr
  )
  const occupancyPct = rooms.length > 0
    ? Math.round((inHouseToday.length / rooms.length) * 100)
    : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: Arrivals + Departures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ArrivingCard
          reservations={arrivals}
          rooms={rooms}
          dayView={dayView}
          loading={loading}
        />
        <DepartingCard
          reservations={departures}
          rooms={rooms}
          dayView={dayView}
          loading={loading}
        />
      </div>

      {/* Row 2: Guest Modified + Occupancy + Revenue */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GuestActivityCard activities={guestActivities} loading={loading} />
        <OccupancyCardWrapper
          pct={occupancyPct}
          inHouse={inHouseToday.length}
          total={rooms.length}
          rooms={rooms}
          calReservations={calReservations}
          loading={loading}
        />
        <RevenueCardWrapper
          thisMonth={payments?.thisMonth ?? 0}
          ytd={payments?.ytd ?? 0}
          loading={loading}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Daily Checklist — printable arrivals / departures summary
// ---------------------------------------------------------------------------

function DailyChecklist({ arriving, departing, rooms, viewDate }) {
  const roomMap = Object.fromEntries(rooms.map(r => [r.id, r.name]))

  function getRoomNames(roomIds) {
    return (roomIds ?? []).map(id => roomMap[id] ?? '?').join(', ')
  }

  return (
    <div className="print-checklist bg-surface border border-border rounded-[8px] p-5">
      <h3 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-4">
        Daily Checklist — {format(viewDate, 'EEEE, MMM d')}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Check-ins */}
        <div>
          <h4 className="font-body text-[13px] font-semibold text-success mb-2 uppercase tracking-[0.06em]">
            Checking In ({arriving.length})
          </h4>
          {arriving.length === 0 ? (
            <p className="font-body text-[13px] text-text-muted">No arrivals</p>
          ) : (
            <div className="flex flex-col gap-2">
              {arriving.map(r => (
                <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div>
                    <p className="font-body text-[14px] text-text-primary">
                      {r.guests?.first_name} {r.guests?.last_name}
                    </p>
                    <p className="font-body text-[12px] text-text-secondary">
                      {getRoomNames(r.room_ids)} · {r.num_guests} guest{r.num_guests !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="font-mono text-[12px] text-text-muted">{r.confirmation_number}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Check-outs */}
        <div>
          <h4 className="font-body text-[13px] font-semibold text-info mb-2 uppercase tracking-[0.06em]">
            Checking Out ({departing.length})
          </h4>
          {departing.length === 0 ? (
            <p className="font-body text-[13px] text-text-muted">No departures</p>
          ) : (
            <div className="flex flex-col gap-2">
              {departing.map(r => (
                <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div>
                    <p className="font-body text-[14px] text-text-primary">
                      {r.guests?.first_name} {r.guests?.last_name}
                    </p>
                    <p className="font-body text-[12px] text-text-secondary">
                      {getRoomNames(r.room_ids)}
                    </p>
                  </div>
                  <span className="font-mono text-[12px] text-text-muted">{r.confirmation_number}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Room Calendar — 14-day horizontal Gantt
// ---------------------------------------------------------------------------

function RoomCalendar({ rooms, reservations, maintenanceTickets }) {
  const today = startOfDay(new Date())
  const days  = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today])

  const ressByRoom = useMemo(() => {
    const map = {}
    for (const r of reservations) {
      for (const rid of (r.room_ids ?? [])) {
        ;(map[rid] ??= []).push(r)
      }
    }
    return map
  }, [reservations])

  const ticketsByRoom = useMemo(() => {
    const map = {}
    for (const t of maintenanceTickets) {
      ;(map[t.room_id] ??= []).push(t)
    }
    return map
  }, [maintenanceTickets])

  if (rooms.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-[18px] text-text-primary">Room Calendar</h2>
        <Link to="/calendar" className="flex items-center gap-1 font-body text-[13px] text-info hover:underline">
          Full calendar <ArrowRight size={13} />
        </Link>
      </div>
      <div className="overflow-x-auto rounded-[8px] border border-border">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-surface border-b border-border">
              <th className="w-32 min-w-[128px] px-4 py-2 text-left font-body text-[12px] uppercase tracking-[0.06em] text-text-muted font-semibold border-r border-border">
                Room
              </th>
              {days.map(d => (
                <th
                  key={d.toISOString()}
                  className={cn(
                    'min-w-[52px] px-1 py-2 font-mono text-[11px] text-text-muted text-center',
                    isToday(d) && 'text-info font-semibold'
                  )}
                >
                  <div>{format(d, 'EEE')}</div>
                  <div>{format(d, 'd')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room, ri) => (
              <RoomRow
                key={room.id}
                room={room}
                roomIndex={ri}
                days={days}
                reservations={ressByRoom[room.id] ?? []}
                tickets={ticketsByRoom[room.id] ?? []}
                isLast={ri === rooms.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RoomRow({ room, roomIndex, days, reservations, tickets, isLast }) {
  const pal = room.color ? getPaletteColor(room.color) : getPaletteByIndex(roomIndex)
  const openTickets    = tickets.filter(t => t.status !== 'resolved')
  const blockingTicket = tickets.find(t => t.blocks_booking && t.status !== 'resolved')

  const spans = useMemo(() => {
    const result = []
    let i = 0
    while (i < days.length) {
      const dayStart = startOfDay(days[i])

      if (blockingTicket) {
        result.push({ type: 'maintenance', span: days.length - i })
        break
      }

      const res = reservations.find(r => {
        if (!r.check_in || !r.check_out) return false
        const ci = startOfDay(parseISO(r.check_in))
        const co = startOfDay(parseISO(r.check_out))
        return dayStart >= ci && dayStart < co
      })

      if (res) {
        let span = 1
        const co = startOfDay(parseISO(res.check_out))
        while (i + span < days.length) {
          if (startOfDay(days[i + span]) >= co) break
          span++
        }
        result.push({ type: 'reservation', reservation: res, span })
        i += span
      } else {
        result.push({ type: 'empty', day: days[i], span: 1 })
        i++
      }
    }
    return result
  }, [days, reservations, blockingTicket])

  const hasUrgent = openTickets.some(t => t.priority === 'urgent')

  return (
    <tr className={cn(!isLast && 'border-b border-border', 'hover:bg-tableAlt transition-colors')}>
      <td className="px-4 py-2 border-r border-border align-middle min-w-[128px]">
        <div className="flex items-center gap-1.5">
          <span className="font-body text-[13px] text-text-primary font-medium truncate">{room.name}</span>
          {openTickets.length > 0 && (
            <span title={`${openTickets.length} open maintenance issue${openTickets.length !== 1 ? 's' : ''}`}>
              <WarningCircle size={13} weight="fill" className={hasUrgent ? 'text-danger' : 'text-warning'} />
            </span>
          )}
        </div>
      </td>

      {spans.map((span, idx) => {
        if (span.type === 'maintenance') {
          return (
            <td key={idx} colSpan={span.span} className="py-1 px-1"
              style={{ background: 'var(--stripe-diagonal-wide)' }}>
              <span className="font-body text-[11px] text-text-muted">Maintenance</span>
            </td>
          )
        }
        if (span.type === 'reservation') {
          const r = span.reservation
          const isPending = r.status === 'pending'
          return (
            <td key={idx} colSpan={span.span} className="py-1 px-0.5">
              <Link to="/reservations" className={cn(
                'rounded-[4px] px-2 py-1 h-8 flex items-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity block',
                isPending && 'border border-dashed border-warning'
              )}
                style={isPending
                  ? { backgroundColor: 'var(--color-warning-bg)' }
                  : { backgroundColor: pal.bg + '22', border: `1px solid ${pal.bg}40`, borderLeft: `3px solid ${pal.bg}` }
                }
              >
                <span className="font-mono text-[11px] truncate" style={{ color: isPending ? undefined : pal.border ?? pal.bg }} >
                  {r.guests?.last_name ?? '—'}
                </span>
              </Link>
            </td>
          )
        }
        return (
          <td key={idx} className={cn('py-1 px-0.5 h-10', isToday(span.day) && 'bg-info-bg/30')} />
        )
      })}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false)
  const [dayView, setDayView]     = useState('today')

  const { data: rooms = [] }               = useRoomsForCalendar()
  const { data: calReservations = [],
          isLoading: calLoading }           = useCalendarReservations()
  const { data: maintenanceTickets = [] }   = useOpenMaintenanceTickets()
  const { data: payments }                  = usePaymentsSummary()
  const { data: guestActivities = [] }     = useGuestActivity()

  const today    = startOfDay(new Date())
  const viewDate = dayView === 'today' ? today : addDays(today, 1)
  const dateStr  = format(viewDate, 'yyyy-MM-dd')
  const arriving   = calReservations.filter(r => r.check_in  === dateStr)
  const departing  = calReservations.filter(r => r.check_out === dateStr)

  return (
    <div className="flex flex-col gap-8">
      <div className="print:hidden">
        <OnboardingChecklist />
      </div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-[32px] text-text-primary uppercase">{greeting()}</h1>
          <WeatherStrip />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* TODAY / TOMORROW toggle */}
          <div className="flex items-center gap-0 bg-surface-raised border border-border rounded-[8px] p-1">
            {['today', 'tomorrow'].map(d => (
              <button
                key={d}
                onClick={() => setDayView(d)}
                className={cn(
                  'px-4 py-1.5 rounded-[6px] font-body font-semibold text-[12px] uppercase tracking-[0.08em] transition-all',
                  dayView === d
                    ? 'bg-text-primary text-white'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {d}
              </button>
            ))}
          </div>

          <Button variant="secondary" size="sm" onClick={() => window.print()} className="no-print">
            <Printer size={14} weight="bold" /> Print Checklist
          </Button>
          <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
            <Plus size={16} weight="bold" /> New Reservation
          </Button>
        </div>
      </div>

      {/* Magazine grid stat cards */}
      <div className="print:hidden">
        <DayCards
          dayView={dayView}
          calReservations={calReservations}
          rooms={rooms}
          payments={payments}
          guestActivities={guestActivities}
          loading={calLoading}
        />
      </div>

      {/* Printable daily checklist — hidden on screen, visible only when printing */}
      <div className="hidden print:block">
        <DailyChecklist
          arriving={arriving}
          departing={departing}
          rooms={rooms}
          viewDate={viewDate}
        />
      </div>

      {/* 14-day room calendar */}
      <div className="print:hidden">
        <RoomCalendar
          rooms={rooms}
          reservations={calReservations}
          maintenanceTickets={maintenanceTickets}
        />
      </div>

      <ReservationModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
