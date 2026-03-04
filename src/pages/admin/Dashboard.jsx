// src/pages/admin/Dashboard.jsx
// Admin dashboard with desktop grid and mobile Apple Wallet-style card stack.

import { useState, useMemo } from 'react'
import { format, isToday, parseISO } from 'date-fns'
import {
  CalendarBlank, SignIn, SignOut, Buildings, Plus,
  CaretDown, CaretUp,
} from '@phosphor-icons/react'

import { useReservations } from '@/hooks/useReservations'
import { DataTable } from '@/components/shared/DataTable'
import { StatusChip } from '@/components/shared/StatusChip'
import { Button } from '@/components/ui/Button'
import { ReservationModal } from '@/components/reservations/ReservationModal'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Mobile Apple Wallet stack — each section becomes a swipeable card
// ---------------------------------------------------------------------------

function WalletCard({ title, color = 'bg-surface', children, index, isActive, totalCards, onClick }) {
  const stackOffset = isActive ? 0 : (totalCards - index - 1) * 8
  return (
    <div
      className={cn(
        'rounded-[16px] border border-border shadow-sm overflow-hidden transition-all duration-300 cursor-pointer',
        isActive ? color : 'bg-surface opacity-90',
        'md:hidden'
      )}
      style={{
        transform: isActive ? 'none' : `translateY(${stackOffset}px) scale(${1 - (totalCards - index - 1) * 0.02})`,
        zIndex: isActive ? 10 : index,
      }}
      onClick={onClick}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <span className="font-body font-semibold text-[15px] text-text-primary">{title}</span>
        {isActive ? <CaretUp size={16} className="text-text-muted" /> : <CaretDown size={16} className="text-text-muted" />}
      </div>
      {isActive && <div className="p-5">{children}</div>}
    </div>
  )
}

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

/** Arrival / departure counts — reused in both mobile wallet and desktop glance. */
function TodayArrivalsStats({ arrivals, departures, loading, compact = false }) {
  return (
    <div className={`grid grid-cols-2 gap-3`}>
      <div className="bg-success-bg rounded-[8px] p-4">
        <p className={`font-body text-[12px] uppercase tracking-wider font-semibold text-success`}>Check-ins</p>
        <p className={`font-mono ${compact ? 'text-[36px]' : 'text-[32px]'} text-success leading-none`}>
          {loading ? '—' : arrivals}
        </p>
      </div>
      <div className="bg-warning-bg rounded-[8px] p-4">
        <p className={`font-body text-[12px] uppercase tracking-wider font-semibold text-warning`}>Check-outs</p>
        <p className={`font-mono ${compact ? 'text-[36px]' : 'text-[32px]'} text-warning leading-none`}>
          {loading ? '—' : departures}
        </p>
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
  const [activeCard, setActiveCard] = useState(0)
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

  const walletCards = [
    {
      title: 'Today at a Glance',
      content: (
        <div className="flex flex-col gap-4">
          <WeatherWidget />
          <TodayArrivalsStats arrivals={todayArrivals} departures={todayDepartures} loading={isLoading} compact />
        </div>
      ),
    },
    {
      title: 'Occupancy',
      content: (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface rounded-[8px] border border-border p-4">
            <p className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-muted">Currently in</p>
            <p className="font-mono text-[32px] text-text-primary leading-none mt-1">{currentlyCheckedIn}</p>
          </div>
          <div className="bg-surface rounded-[8px] border border-border p-4">
            <p className="font-body text-[12px] uppercase tracking-wider font-semibold text-text-muted">This month</p>
            <p className="font-mono text-[32px] text-text-primary leading-none mt-1">{thisMonthReservations}</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Recent Reservations',
      content: (
        <div className="flex flex-col gap-3">
          {recentReservations.slice(0, 5).map(r => {
            const g = r.guests
            return (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                <div>
                  <p className="font-body text-[14px] text-text-primary">{g ? `${g.first_name} ${g.last_name}` : '—'}</p>
                  <p className="font-mono text-[12px] text-text-muted">{r.confirmation_number} · {r.check_in ? format(parseISO(r.check_in), 'MMM d') : '—'}</p>
                </div>
                <StatusChip status={r.status} />
              </div>
            )
          })}
          {recentReservations.length === 0 && !isLoading && (
            <p className="font-body text-[14px] text-text-muted text-center py-4">No reservations yet</p>
          )}
          <Button variant="primary" size="sm" onClick={() => setModalOpen(true)} className="mt-1">
            <Plus size={14} /> New Reservation
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">{greeting()}</h1>
        <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
          <Plus size={16} weight="bold" /> New Reservation
        </Button>
      </div>

      {/* ── MOBILE: Apple Wallet-style collapsible card stack ── */}
      <div className="md:hidden flex flex-col gap-3">
        {walletCards.map((card, i) => (
          <WalletCard
            key={card.title}
            title={card.title}
            index={i}
            isActive={activeCard === i}
            totalCards={walletCards.length}
            onClick={() => setActiveCard(activeCard === i ? -1 : i)}
          >
            {card.content}
          </WalletCard>
        ))}
      </div>

      {/* ── DESKTOP: standard layout ── */}

      {/* Stats Grid */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Today's Arrivals" value={todayArrivals} icon={SignIn} loading={isLoading} />
        <StatsCard label="Today's Departures" value={todayDepartures} icon={SignOut} loading={isLoading} />
        <StatsCard label="Current Occupancy" value={`${currentlyCheckedIn}`} icon={Buildings} trend="guests checked in" loading={isLoading} />
        <StatsCard label="This Month's Reservations" value={thisMonthReservations} icon={CalendarBlank} loading={isLoading} />
      </div>

      {/* Today at a Glance */}
      <div className="hidden md:block">
        <h2 className="font-heading text-[22px] text-text-primary mb-4">Today at a Glance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <WeatherWidget />
          <TodayArrivalsStats arrivals={todayArrivals} departures={todayDepartures} loading={isLoading} />
        </div>
      </div>

      {/* Recent Reservations */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-[22px] text-text-primary">Recent Reservations</h2>
          <Button variant="secondary" size="sm" onClick={() => setModalOpen(true)}>
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
