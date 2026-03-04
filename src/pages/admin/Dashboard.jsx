// src/pages/admin/Dashboard.jsx
// Dashboard with wallet-style folder stack for today's stats,
// 14-day room calendar, and new-reservation quick-action.

import { useState, useMemo, createElement } from 'react'
import { Link } from 'react-router-dom'
import {
  format, isToday, parseISO, addDays, startOfDay,
  subMonths, startOfMonth, subDays, formatDistanceToNow,
} from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import {
  Sun, CloudSun, Cloud, CloudFog, CloudRain, CloudSnow, CloudLightning,
  WarningCircle, Plus, ArrowRight, Bell, UserCircle,
} from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { ReservationModal } from '@/components/reservations/ReservationModal'
import { Button } from '@/components/ui/Button'
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

/** Returns true if hex color is perceptually light */
function isLightColor(hex) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140
}

// ---------------------------------------------------------------------------
// Weather Strip
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
        .select('id, name')
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
        .select('id, room_ids, check_in, check_out, status, guests(first_name, last_name)')
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

function useModifiedReservations() {
  const { propertyId } = useProperty()
  const since = format(subDays(new Date(), 7), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['modified-reservations', propertyId, since],
    queryFn: async () => {
      if (!propertyId) return []
      const { data } = await supabase
        .from('reservations')
        .select('id, confirmation_number, check_in, check_out, updated_at, created_at, room_ids, guests(first_name, last_name)')
        .eq('property_id', propertyId)
        .neq('status', 'cancelled')
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
      return (data ?? []).filter(r => {
        if (!r.updated_at || !r.created_at) return false
        return new Date(r.updated_at) - new Date(r.created_at) > 1000 * 60 * 5
      })
    },
    enabled: !!propertyId,
  })
}

// ---------------------------------------------------------------------------
// Folder stack
// ---------------------------------------------------------------------------

const FOLDERS = [
  { id: 'occupancy', label: 'OCCUPANCY',       bg: '#4B2A8A', fg: '#EDE5FF', badgeBg: '#7B5ABF' },
  { id: 'revenue',   label: 'MONTHLY REVENUE',  bg: '#C8D42A', fg: '#2D3000', badgeBg: '#A0AA1A' },
  { id: 'modified',  label: 'GUEST MODIFIED',   bg: '#E85028', fg: '#FFFFFF', badgeBg: '#BF3A1A' },
  { id: 'departing', label: 'DEPARTING',        bg: '#A8C4DC', fg: '#1A3A52', badgeBg: '#7AA0BC' },
  { id: 'arriving',  label: 'ARRIVING',         bg: '#D2E8A4', fg: '#1A4A1A', badgeBg: '#A2C87A' },
]

function GuestList({ reservations, rooms, emptyMessage }) {
  if (!reservations.length) {
    return <p className="font-body text-[14px] opacity-60">{emptyMessage}</p>
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {reservations.slice(0, 5).map(r => {
        const guest = r.guests ?? {}
        const roomName = rooms.find(rm => (r.room_ids ?? []).includes(rm.id))?.name ?? '—'
        return (
          <li key={r.id} className="flex items-center gap-2.5">
            <UserCircle size={16} className="shrink-0 opacity-50" />
            <span className="font-body text-[14px] font-semibold">
              {guest.first_name} {guest.last_name}
            </span>
            <span className="font-body text-[13px] opacity-60">· {roomName}</span>
          </li>
        )
      })}
      {reservations.length > 5 && (
        <li className="font-body text-[12px] opacity-50">+{reservations.length - 5} more</li>
      )}
    </ul>
  )
}

function ModifiedList({ reservations, rooms }) {
  if (!reservations.length) {
    return <p className="font-body text-[14px] opacity-80">No recent guest modifications.</p>
  }
  return (
    <ul className="flex flex-col gap-3">
      {reservations.slice(0, 5).map(r => {
        const guest = r.guests ?? {}
        const roomName = rooms.find(rm => (r.room_ids ?? []).includes(rm.id))?.name ?? '—'
        const ago = r.updated_at
          ? formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })
          : ''
        return (
          <li key={r.id} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Bell size={13} weight="fill" className="shrink-0 opacity-90" />
              <span className="font-body text-[14px] font-semibold">
                {guest.first_name} {guest.last_name}
              </span>
              <span className="font-body text-[12px] opacity-70">· {roomName}</span>
            </div>
            <span className="font-body text-[12px] opacity-70 pl-5">
              {r.confirmation_number} · modified {ago}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function FolderStack({ dayView, calReservations, rooms, payments, modifiedReservations, loading }) {
  const [activeId, setActiveId] = useState('arriving')

  const today   = startOfDay(new Date())
  const viewDate = dayView === 'today' ? today : addDays(today, 1)
  const dateStr  = format(viewDate, 'yyyy-MM-dd')
  const todayStr = format(today, 'yyyy-MM-dd')

  const arrivals  = calReservations.filter(r => r.check_in  === dateStr)
  const departures = calReservations.filter(r => r.check_out === dateStr)

  const inHouseToday = calReservations.filter(r =>
    r.check_in <= todayStr && r.check_out > todayStr
  )
  const occupancyPct = rooms.length > 0
    ? Math.round((inHouseToday.length / rooms.length) * 100)
    : 0

  const badges = {
    arriving:  arrivals.length,
    departing: departures.length,
    modified:  modifiedReservations.length,
    revenue:   null,
    occupancy: null,
  }

  const content = {
    arriving: (
      <div>
        <p className="font-mono text-[32px] font-bold leading-none mb-4">{arrivals.length}</p>
        <GuestList
          reservations={arrivals}
          rooms={rooms}
          emptyMessage={`No arrivals ${dayView === 'today' ? 'today' : 'tomorrow'}.`}
        />
      </div>
    ),
    departing: (
      <div>
        <p className="font-mono text-[32px] font-bold leading-none mb-4">{departures.length}</p>
        <GuestList
          reservations={departures}
          rooms={rooms}
          emptyMessage={`No departures ${dayView === 'today' ? 'today' : 'tomorrow'}.`}
        />
      </div>
    ),
    modified: (
      <div>
        {modifiedReservations.length > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} weight="fill" />
            <span className="font-body text-[13px] font-semibold">
              {modifiedReservations.length} recent modification{modifiedReservations.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        <ModifiedList reservations={modifiedReservations} rooms={rooms} />
      </div>
    ),
    revenue: (
      <div>
        <p className="font-body text-[12px] uppercase tracking-wider opacity-60 mb-1">This Month</p>
        <p className="font-mono text-[36px] font-bold leading-none">{dollars(payments?.thisMonth ?? 0)}</p>
        <p className="font-body text-[13px] opacity-60 mt-3">
          YTD: <span className="font-mono font-semibold">{dollars(payments?.ytd ?? 0)}</span>
        </p>
      </div>
    ),
    occupancy: (
      <div>
        <p className="font-body text-[12px] uppercase tracking-wider opacity-60 mb-1">Current Occupancy</p>
        <p className="font-mono text-[48px] font-bold leading-none">{occupancyPct}%</p>
        <p className="font-body text-[13px] opacity-60 mt-3">
          {inHouseToday.length} of {rooms.length} room{rooms.length !== 1 ? 's' : ''} occupied
        </p>
      </div>
    ),
  }

  const activeDef    = FOLDERS.find(f => f.id === activeId)
  const inactiveFolders = FOLDERS.filter(f => f.id !== activeId)
  const lightActive  = isLightColor(activeDef.bg)
  const contentColor = lightActive ? '#1a2a1a' : activeDef.fg

  return (
    <div className="flex flex-col gap-0">
      {/* Active folder — macOS shape: small tab top-left, full-width body */}
      <div>
        <div className="flex items-end">
          {/* Tab nub */}
          <div
            className="px-3 py-2 rounded-t-[8px] flex items-center gap-2 shrink-0"
            style={{ backgroundColor: activeDef.bg, color: contentColor }}
          >
            <span className="font-body font-bold text-[11px] uppercase tracking-[0.12em]">
              {activeDef.label}
            </span>
            {badges[activeId] != null && badges[activeId] > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full px-1 text-[10px] font-mono font-bold"
                style={{ backgroundColor: activeDef.badgeBg, color: activeDef.fg }}
              >
                {badges[activeId]}
              </span>
            )}
          </div>
          {/* Bridge line to right */}
          <div className="flex-1 h-[2px]" style={{ backgroundColor: activeDef.bg }} />
        </div>
        {/* Folder body */}
        <div
          className="rounded-b-[12px] rounded-tr-[12px] p-6 min-h-[160px]"
          style={{ backgroundColor: activeDef.bg, color: contentColor }}
        >
          {loading ? (
            <div className="animate-pulse bg-white/20 h-24 rounded-[6px]" />
          ) : (
            content[activeId]
          )}
        </div>
      </div>

      {/* Inactive folder strips */}
      <div className="flex flex-col gap-1.5 mt-2">
        {inactiveFolders.map(folder => {
          const badge = badges[folder.id]
          const light = isLightColor(folder.bg)
          return (
            <button
              key={folder.id}
              onClick={() => setActiveId(folder.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-[8px] text-left transition-all hover:opacity-90 active:scale-[0.998] focus:outline-none"
              style={{ backgroundColor: folder.bg, color: light ? '#1a2a1a' : folder.fg }}
            >
              <span className="font-body font-bold text-[12px] uppercase tracking-[0.10em] flex-1">
                {folder.label}
              </span>
              {badge != null && badge > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full px-1.5 text-[10px] font-mono font-bold"
                  style={{ backgroundColor: folder.badgeBg, color: folder.fg }}
                >
                  {badge}
                </span>
              )}
              <ArrowRight size={13} className="opacity-40 shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Room Calendar — 14-day horizontal Gantt-style table
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

function RoomRow({ room, days, reservations, tickets, isLast }) {
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
          const next = startOfDay(days[i + span])
          if (next >= co) break
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
              <WarningCircle
                size={13}
                weight="fill"
                className={hasUrgent ? 'text-danger' : 'text-warning'}
              />
            </span>
          )}
        </div>
      </td>

      {spans.map((span, idx) => {
        if (span.type === 'maintenance') {
          return (
            <td
              key={idx}
              colSpan={span.span}
              className="py-1 px-1"
              style={{ background: 'repeating-linear-gradient(135deg, #D4D4D4 0px, #D4D4D4 2px, #F4F4F4 2px, #F4F4F4 9px)' }}
            >
              <span className="font-body text-[11px] text-text-muted">Maintenance</span>
            </td>
          )
        }

        if (span.type === 'reservation') {
          const r = span.reservation
          const isPending = r.status === 'pending'
          return (
            <td key={idx} colSpan={span.span} className="py-1 px-0.5">
              <div className={cn(
                'rounded-[4px] px-2 py-1 h-8 flex items-center overflow-hidden',
                isPending
                  ? 'bg-warning-bg border border-dashed border-warning'
                  : 'bg-info-bg border-l-[3px] border-l-info border border-info/30'
              )}>
                <span className={cn('font-mono text-[11px] truncate', isPending ? 'text-warning italic' : 'text-info')}>
                  {r.guests?.last_name ?? '—'}
                </span>
              </div>
            </td>
          )
        }

        return (
          <td
            key={idx}
            className={cn('py-1 px-0.5 h-10', isToday(span.day) && 'bg-info-bg/30')}
          />
        )
      })}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main page export
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false)
  const [dayView, setDayView]     = useState('today')

  const { data: rooms = [] }                   = useRoomsForCalendar()
  const { data: calReservations = [],
          isLoading: calLoading }               = useCalendarReservations()
  const { data: maintenanceTickets = [] }       = useOpenMaintenanceTickets()
  const { data: payments }                      = usePaymentsSummary()
  const { data: modifiedReservations = [] }     = useModifiedReservations()

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-[32px] text-text-primary">{greeting()}</h1>
          <WeatherStrip />
        </div>
        <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
          <Plus size={16} weight="bold" /> New Reservation
        </Button>
      </div>

      {/* TODAY / TOMORROW toggle */}
      <div className="flex items-center gap-0 bg-surface-raised border border-border rounded-[8px] p-1 self-start">
        {['today', 'tomorrow'].map(d => (
          <button
            key={d}
            onClick={() => setDayView(d)}
            className={cn(
              'px-5 py-2 rounded-[6px] font-body font-semibold text-[13px] uppercase tracking-[0.08em] transition-all',
              dayView === d
                ? 'bg-text-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            )}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Wallet folder stack */}
      <FolderStack
        dayView={dayView}
        calReservations={calReservations}
        rooms={rooms}
        payments={payments}
        modifiedReservations={modifiedReservations}
        loading={calLoading}
      />

      {/* 14-day room calendar */}
      <RoomCalendar
        rooms={rooms}
        reservations={calReservations}
        maintenanceTickets={maintenanceTickets}
      />

      <ReservationModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
