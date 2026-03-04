// src/pages/admin/Dashboard.jsx
// Admin dashboard: stats, today at a glance, calendar preview, recent reservations.

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, isToday, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'
import {
  CalendarBlank,
  SignIn,
  SignOut,
  Buildings,
  Plus,
  ArrowRight,
} from '@phosphor-icons/react'

import { useReservations } from '@/hooks/useReservations'
import { DataTable } from '@/components/shared/DataTable'
import { StatusChip } from '@/components/shared/StatusChip'
import { Button } from '@/components/ui/Button'
import { ReservationModal } from '@/components/reservations/ReservationModal'
import { cn } from '@/lib/utils'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function StatsCard({ label, value, icon: Icon, trend, loading }) {
  return (
    <div className="bg-surface border border-border rounded-[8px] p-6 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
          {label}
        </h4>
        {Icon && <Icon size={20} className="text-text-muted" />}
      </div>
      {loading ? (
        <div className="animate-pulse bg-border rounded h-10 w-20" />
      ) : (
        <p className="font-mono text-[32px] text-text-primary leading-none">{value}</p>
      )}
      {trend && !loading && (
        <p className="font-body text-[13px] text-text-secondary">{trend}</p>
      )}
    </div>
  )
}

function WeatherWidget() {
  const now = new Date()
  return (
    <div className="bg-surface border border-border rounded-[8px] p-4 flex flex-col gap-1">
      <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
        Today
      </p>
      <p className="font-mono text-[14px] text-text-primary">{format(now, 'EEEE, MMMM d, yyyy')}</p>
      <p className="font-mono text-[14px] text-text-muted">{format(now, 'h:mm a')}</p>
    </div>
  )
}

// Mini month-view calendar with occupied days highlighted
function MiniCalendar({ reservations }) {
  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPadding = getDay(monthStart) // 0=Sun

  // Build a set of dates that have check-ins or check-outs
  const occupiedDates = useMemo(() => {
    const set = new Set()
    reservations.forEach(r => {
      if (r.check_in)  set.add(r.check_in.slice(0, 10))
      if (r.check_out) set.add(r.check_out.slice(0, 10))
    })
    return set
  }, [reservations])

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center font-body text-[11px] font-semibold text-text-muted py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: startPadding }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const isOccupied = occupiedDates.has(dateStr)
          const isTodayDate = isToday(day)
          return (
            <div
              key={dateStr}
              className={cn(
                'text-center font-mono text-[12px] py-1 rounded-[4px]',
                isTodayDate && 'bg-text-primary text-white font-semibold',
                !isTodayDate && isOccupied && 'bg-info-bg text-info font-semibold',
                !isTodayDate && !isOccupied && 'text-text-secondary'
              )}
            >
              {format(day, 'd')}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const COLUMNS = [
  {
    key: 'confirmation_number',
    label: 'Confirmation #',
    render: (val) => (
      <span className="font-mono text-[14px]">{val ?? '—'}</span>
    ),
  },
  {
    key: 'guest',
    label: 'Guest',
    render: (_, row) => {
      const g = row.guests
      if (!g) return <span className="text-text-muted">—</span>
      return (
        <span className="font-body text-[14px]">
          {g.first_name} {g.last_name}
        </span>
      )
    },
  },
  {
    key: 'room',
    label: 'Room',
    render: (_, row) => (
      <span className="font-body text-[14px] text-text-secondary">
        {row.room_ids?.length ? `${row.room_ids.length} room(s)` : '—'}
      </span>
    ),
  },
  {
    key: 'check_in',
    label: 'Check-in',
    render: (val) => (
      <span className="font-mono text-[14px]">
        {val ? format(parseISO(val), 'MMM d, yyyy') : '—'}
      </span>
    ),
  },
  {
    key: 'check_out',
    label: 'Check-out',
    render: (val) => (
      <span className="font-mono text-[14px]">
        {val ? format(parseISO(val), 'MMM d, yyyy') : '—'}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (val) => <StatusChip status={val} />,
  },
  {
    key: 'total_due_cents',
    label: 'Total',
    numeric: true,
    render: (val) => (
      <span className="font-mono text-[14px]">
        ${val != null ? (val / 100).toFixed(2) : '0.00'}
      </span>
    ),
  },
]

export default function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false)
  const { data, isLoading } = useReservations()

  const allReservations = useMemo(() => {
    return data?.pages?.flatMap((p) => p.data) ?? []
  }, [data])

  const todayArrivals = useMemo(
    () => allReservations.filter((r) => r.check_in && isToday(parseISO(r.check_in))).length,
    [allReservations]
  )

  const todayDepartures = useMemo(
    () => allReservations.filter((r) => r.check_out && isToday(parseISO(r.check_out))).length,
    [allReservations]
  )

  const currentlyCheckedIn = useMemo(() => {
    const now = new Date()
    return allReservations.filter((r) => {
      if (!r.check_in || !r.check_out) return false
      return (
        r.status === 'confirmed' &&
        parseISO(r.check_in) <= now &&
        parseISO(r.check_out) >= now
      )
    }).length
  }, [allReservations])

  const thisMonthReservations = useMemo(() => {
    const now = new Date()
    return allReservations.filter((r) => {
      if (!r.check_in) return false
      const d = parseISO(r.check_in)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  }, [allReservations])

  const recentReservations = useMemo(() => allReservations.slice(0, 10), [allReservations])

  return (
    <div className="flex flex-col gap-8">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">{greeting()}</h1>
        <Button
          variant="primary"
          size="md"
          onClick={() => setModalOpen(true)}
        >
          <Plus size={16} weight="bold" /> New Reservation
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Today's Arrivals"
          value={todayArrivals}
          icon={SignIn}
          loading={isLoading}
        />
        <StatsCard
          label="Today's Departures"
          value={todayDepartures}
          icon={SignOut}
          loading={isLoading}
        />
        <StatsCard
          label="Current Occupancy"
          value={`${currentlyCheckedIn}`}
          icon={Buildings}
          trend="guests checked in"
          loading={isLoading}
        />
        <StatsCard
          label="This Month's Reservations"
          value={thisMonthReservations}
          icon={CalendarBlank}
          loading={isLoading}
        />
      </div>

      {/* Today at a Glance */}
      <div>
        <h2 className="font-heading text-[22px] text-text-primary mb-4">Today at a Glance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <WeatherWidget />
          <div className="bg-surface border border-border rounded-[8px] p-4 flex flex-col gap-1">
            <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
              Check-ins Today
            </p>
            <p className="font-mono text-[32px] text-success leading-none">{isLoading ? '—' : todayArrivals}</p>
          </div>
          <div className="bg-surface border border-border rounded-[8px] p-4 flex flex-col gap-1">
            <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
              Check-outs Today
            </p>
            <p className="font-mono text-[32px] text-warning leading-none">{isLoading ? '—' : todayDepartures}</p>
          </div>
        </div>
      </div>

      {/* Calendar Preview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-[22px] text-text-primary">
            {format(new Date(), 'MMMM yyyy')}
          </h2>
          <Link
            to="/reservations/calendar"
            className="flex items-center gap-1.5 font-body text-[14px] text-info hover:underline"
          >
            View full calendar <ArrowRight size={14} />
          </Link>
        </div>
        <div className="bg-surface border border-border rounded-[8px] p-5">
          {isLoading ? (
            <div className="animate-pulse bg-border rounded h-40 w-full" />
          ) : (
            <MiniCalendar reservations={allReservations} />
          )}
          <p className="mt-3 font-body text-[12px] text-text-muted">
            Blue = check-in or check-out date
          </p>
        </div>
      </div>

      {/* Recent Reservations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-[22px] text-text-primary">Recent Reservations</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={14} weight="bold" /> New Reservation
          </Button>
        </div>
        <div className={cn('border border-border rounded-[8px] overflow-hidden')}>
          <DataTable
            columns={COLUMNS}
            data={recentReservations}
            loading={isLoading}
            emptyState={
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="font-body text-[15px] text-text-muted">No reservations yet</p>
                <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
                  <Plus size={14} weight="bold" /> Create first reservation
                </Button>
              </div>
            }
          />
        </div>
      </div>

      <ReservationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
