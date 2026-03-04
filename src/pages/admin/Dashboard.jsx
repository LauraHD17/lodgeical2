// src/pages/admin/Dashboard.jsx
// Dashboard layout:
//   1. Header — greeting, weather, New Reservation button
//   2. KPI stat cards — today's arrivals/departures/in-house, month earnings
//   3. Quick-nav tile grid — icon + label link to every section
//   4. RoomCalendar — 14-day horizontal timeline

import { useState, useMemo, createElement } from 'react'
import { Link } from 'react-router-dom'
import {
  format, isToday, parseISO, addDays, startOfDay,
  subMonths, startOfMonth,
} from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import {
  Sun, CloudSun, Cloud, CloudFog, CloudRain, CloudSnow, CloudLightning,
  WarningCircle, Plus, ArrowRight,
  CalendarBlank, Door, Tag, CreditCard, ChatCircle,
  TrendUp, Wrench, Gear, CalendarDots,
} from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { useReservations } from '@/hooks/useReservations'
import { ReservationModal } from '@/components/reservations/ReservationModal'
import { Button } from '@/components/ui/Button'
import { cn, dollars } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Greeting
// ---------------------------------------------------------------------------

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ---------------------------------------------------------------------------
// Weather Strip
// ---------------------------------------------------------------------------

function wmoToIcon(code) {
  if (code === 0)                                                              return Sun
  if (code <= 2)                                                               return CloudSun
  if (code <= 3 || code === 45 || code === 48)                                 return Cloud
  if (code >= 51 && code <= 57)                                                return CloudFog
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))               return CloudRain
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)               return CloudSnow
  if (code >= 95)                                                              return CloudLightning
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
        .gt('check_out', format(today, 'yyyy-MM-dd'))
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

// ---------------------------------------------------------------------------
// KPI stat cards
// ---------------------------------------------------------------------------

function StatCard({ label, value, loading }) {
  return (
    <div className="bg-surface-raised border border-border rounded-[8px] px-4 py-4 flex flex-col gap-1">
      <p className="font-body text-[12px] uppercase tracking-[0.06em] font-semibold text-text-muted">{label}</p>
      {loading
        ? <div className="animate-pulse bg-border h-8 w-16 rounded-[4px]" />
        : <p className="font-mono text-[28px] text-text-primary leading-none">{value}</p>
      }
    </div>
  )
}

function KpiRow({ reservations, loading }) {
  const { data: payments, isLoading: payLoading } = usePaymentsSummary()
  const now = new Date()

  const arrivals   = useMemo(() => reservations.filter(r => r.check_in  && isToday(parseISO(r.check_in))).length,  [reservations])
  const departures = useMemo(() => reservations.filter(r => r.check_out && isToday(parseISO(r.check_out))).length, [reservations])
  const inHouse    = useMemo(() => reservations.filter(r => {
    if (!r.check_in || !r.check_out || r.status !== 'confirmed') return false
    return parseISO(r.check_in) <= now && parseISO(r.check_out) >= now
  }).length, [reservations]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard label="Arrivals today"   value={arrivals}                          loading={loading} />
      <StatCard label="Departures today" value={departures}                        loading={loading} />
      <StatCard label="In-house"         value={inHouse}                           loading={loading} />
      <StatCard label="This month"       value={dollars(payments?.thisMonth ?? 0)} loading={loading || payLoading} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick-nav tile grid
// ---------------------------------------------------------------------------

const NAV_TILES = [
  { path: '/reservations', label: 'Reservations',   icon: CalendarBlank },
  { path: '/calendar',     label: 'Calendar',        icon: CalendarDots  },
  { path: '/rooms',        label: 'Rooms',           icon: Door          },
  { path: '/rates',        label: 'Rates',           icon: Tag           },
  { path: '/payments',     label: 'Payments',        icon: CreditCard    },
  { path: '/messaging',    label: 'Messaging',       icon: ChatCircle    },
  { path: '/reports',      label: 'Reports',         icon: TrendUp       },
  { path: '/maintenance',  label: 'Maintenance',     icon: Wrench        },
  { path: '/settings',     label: 'Settings',        icon: Gear          },
]

function QuickNavGrid() {
  return (
    <div>
      <h2 className="font-heading text-[18px] text-text-primary mb-3">Navigate</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {NAV_TILES.map(({ path, label, icon }) => (
          <Link
            key={path}
            to={path}
            className="flex flex-col items-center gap-2 py-4 px-2 rounded-[8px] border border-border bg-surface-raised hover:border-info hover:bg-info-bg transition-colors text-center group"
          >
            {createElement(icon, { size: 22, weight: 'light', className: 'text-text-secondary group-hover:text-info transition-colors' })}
            <span className="font-body text-[12px] text-text-secondary group-hover:text-text-primary transition-colors leading-tight">{label}</span>
          </Link>
        ))}
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
  const { data, isLoading } = useReservations()

  const allReservations = useMemo(() => data?.pages?.flatMap(p => p.data) ?? [], [data])

  const { data: rooms = [] }              = useRoomsForCalendar()
  const { data: calReservations = [] }    = useCalendarReservations()
  const { data: maintenanceTickets = [] } = useOpenMaintenanceTickets()

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-[32px] text-text-primary">{greeting()}</h1>
        <div className="flex items-center gap-4 shrink-0">
          <WeatherStrip />
          <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
            <Plus size={16} weight="bold" /> New Reservation
          </Button>
        </div>
      </div>

      {/* KPI stat cards */}
      <KpiRow reservations={allReservations} loading={isLoading} />

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
