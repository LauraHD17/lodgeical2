// src/pages/admin/Financials.jsx
// Financial Insights — KPIs with plain-language labels, "Show my math" disclosures,
// actionable insights, room performance table, and 12-month revenue chart.

import { useState, useMemo } from 'react'
import {
  format, subMonths, startOfMonth, endOfMonth,
  parseISO, eachMonthOfInterval, getYear, differenceInDays,
} from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { CaretDown, CaretUp, Lightbulb, TrendUp, TrendDown } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

function useFinancialData() {
  const { propertyId } = useProperty()
  const now = new Date()
  const yearStart  = format(new Date(getYear(now), 0, 1),        'yyyy-MM-dd')
  const yearEnd    = format(endOfMonth(new Date(getYear(now), 11, 31)), 'yyyy-MM-dd')
  const chartFrom  = format(startOfMonth(subMonths(now, 11)),    'yyyy-MM-dd')
  const lastYStart = format(new Date(getYear(now) - 1, 0, 1),   'yyyy-MM-dd')
  const lastYEnd   = format(new Date(getYear(now) - 1, 11, 31), 'yyyy-MM-dd')

  return useQuery({
    queryKey: queryKeys.financials.monthly(propertyId, getYear(now)),
    queryFn: async () => {
      if (!propertyId) return null

      const [paymentsRes, reservationsRes, roomsRes, lastYearPayRes, lastYearResRes] = await Promise.all([
        supabase
          .from('payments')
          .select('id, amount_cents, status, created_at, type')
          .eq('property_id', propertyId)
          .gte('created_at', chartFrom)
          .lte('created_at', yearEnd)
          .in('status', ['succeeded', 'paid'])
          .eq('type', 'charge'),

        supabase
          .from('reservations')
          .select('id, room_ids, check_in, check_out, status')
          .eq('property_id', propertyId)
          .gte('check_in', yearStart)
          .lte('check_in', yearEnd)
          .neq('status', 'cancelled'),

        supabase
          .from('rooms')
          .select('id, name')
          .eq('property_id', propertyId)
          .eq('is_active', true),

        supabase
          .from('payments')
          .select('id, amount_cents, status, created_at, type')
          .eq('property_id', propertyId)
          .gte('created_at', lastYStart)
          .lte('created_at', lastYEnd)
          .in('status', ['succeeded', 'paid'])
          .eq('type', 'charge'),

        supabase
          .from('reservations')
          .select('id, room_ids, check_in, check_out, status')
          .eq('property_id', propertyId)
          .gte('check_in', lastYStart)
          .lte('check_in', lastYEnd)
          .neq('status', 'cancelled'),
      ])

      return {
        payments:        paymentsRes.data     ?? [],
        reservations:    reservationsRes.data  ?? [],
        rooms:           roomsRes.data         ?? [],
        lastYearPayments: lastYearPayRes.data  ?? [],
        lastYearRes:     lastYearResRes.data   ?? [],
      }
    },
    enabled: !!propertyId,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt$(cents) {
  if (!cents) return '$0'
  const v = cents / 100
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return '$' + v.toFixed(2)
}

function nightsOf(reservations) {
  return reservations.reduce((sum, r) => {
    if (!r.check_in || !r.check_out) return sum
    return sum + Math.max(0, differenceInDays(parseISO(r.check_out), parseISO(r.check_in)))
  }, 0)
}

function paymentsInMonth(payments, month) {
  return payments.filter(p => {
    const d = parseISO(p.created_at)
    return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
  })
}

// ---------------------------------------------------------------------------
// "Show my math" metric card
// ---------------------------------------------------------------------------

function MetricCard({ abbr, label, value, unit, plain, math }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-surface-raised border border-border rounded-[8px] p-5 flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <p className="font-body text-[13px] font-bold text-text-primary uppercase tracking-[0.06em]">{abbr}</p>
        <p className="font-body text-[12px] text-text-muted">{label}</p>
      </div>
      <p className="font-mono text-[28px] text-text-primary leading-none mt-1">
        {value}{unit && <span className="text-[16px] text-text-muted ml-0.5">{unit}</span>}
      </p>
      <p className="font-body text-[12px] text-text-secondary mt-0.5">{plain}</p>
      {math && (
        <>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 font-body text-[12px] text-info mt-1 hover:underline w-fit"
          >
            {open ? <CaretUp size={11} /> : <CaretDown size={11} />}
            Show my math
          </button>
          {open && (
            <div className="mt-2 bg-surface border border-border rounded-[6px] p-3 text-[12px] font-body text-text-secondary leading-relaxed">
              {math}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MetricSkeleton() {
  return (
    <div className="bg-surface-raised border border-border rounded-[8px] p-5 animate-pulse">
      <div className="h-3 bg-border rounded w-24 mb-2" />
      <div className="h-8 bg-border rounded w-20 mb-2" />
      <div className="h-3 bg-border rounded w-40" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

function InsightsPanel({ metrics }) {
  const { adr, occupancyPct, thisYearEarnings, lastYearEarnings, bestMonth, daysElapsed, roomPerf } = metrics

  const buildInsights = () => {
    const out = []

    // YoY revenue
    if (lastYearEarnings > 0) {
      const diff = thisYearEarnings - lastYearEarnings
      const pct  = Math.abs(Math.round((diff / lastYearEarnings) * 100))
      if (diff > 0) {
        out.push({
          icon: TrendUp,
          color: 'text-success',
          text: `Revenue is up ${pct}% compared to the same time last year — your pricing or demand is working in your favor.`,
        })
      } else if (diff < 0) {
        out.push({
          icon: TrendDown,
          color: 'text-danger',
          text: `Revenue is down ${pct}% compared to this time last year. Consider reviewing your pricing or minimum stay settings.`,
        })
      }
    }

    // Occupancy
    if (occupancyPct >= 80) {
      out.push({
        icon: TrendUp,
        color: 'text-success',
        text: `Your occupancy is ${occupancyPct}% — demand is strong. You might be able to raise your nightly rates slightly without losing bookings.`,
      })
    } else if (occupancyPct > 0 && occupancyPct < 35) {
      out.push({
        icon: TrendDown,
        color: 'text-warning',
        text: `Your occupancy is ${occupancyPct}% so far this year. Consider dropping a 2-night minimum or running a weeknight promotion to fill gaps.`,
      })
    }

    // ADR
    if (adr > 0) {
      if (adr < 10000) {  // under $100/night in cents comparison
        out.push({
          icon: Lightbulb,
          color: 'text-info',
          text: `Your average nightly rate is ${fmt$(adr)}. If you haven't reviewed rates recently, a small increase during high-demand periods can add up quickly.`,
        })
      }
    }

    // Room-level insights
    if (roomPerf) {
      const lowRooms = roomPerf.filter(r => r.occupancy < 30 && r.nights > 0)
      const highRooms = roomPerf.filter(r => r.occupancy >= 80)
      if (highRooms.length > 0) {
        out.push({
          icon: TrendUp,
          color: 'text-success',
          text: `${highRooms.map(r => r.name).join(', ')} ${highRooms.length === 1 ? 'has' : 'have'} high occupancy — ${highRooms.length === 1 ? 'it may' : 'they may'} support a rate increase.`,
        })
      }
      if (lowRooms.length > 0) {
        out.push({
          icon: Lightbulb,
          color: 'text-info',
          text: `${lowRooms.map(r => r.name).join(', ')} ${lowRooms.length === 1 ? 'has' : 'have'} low bookings this year. Adding photos or adjusting the minimum stay might help.`,
        })
      }
    }

    // Not enough data
    if (out.length === 0 && thisYearEarnings === 0) {
      const daysUntilData = Math.max(7, 30 - daysElapsed)
      out.push({
        icon: Lightbulb,
        color: 'text-text-muted',
        text: `Not enough booking data yet to generate insights. Check back in ${daysUntilData} day${daysUntilData !== 1 ? 's' : ''} once some reservations have been recorded.`,
      })
    }

    if (bestMonth.total > 0) {
      out.push({
        icon: Lightbulb,
        color: 'text-info',
        text: `${bestMonth.name} was your strongest month so far this year (${fmt$(bestMonth.total)}). Consider pricing that month slightly higher next year.`,
      })
    }

    return out.slice(0, 4)
  }

  const insights = buildInsights()
  if (insights.length === 0) return null

  return (
    <div className="bg-surface-raised border border-border rounded-[8px] p-6">
      <h2 className="font-heading text-[20px] text-text-primary mb-4">Insights & Recommendations</h2>
      <ul className="flex flex-col gap-4">
        {insights.map((ins, i) => {
          const Icon = ins.icon
          return (
            <li key={i} className="flex items-start gap-3">
              <Icon size={18} weight="fill" className={cn('mt-0.5 shrink-0', ins.color)} />
              <p className="font-body text-[14px] text-text-primary leading-relaxed">{ins.text}</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Room performance table
// ---------------------------------------------------------------------------

function RoomPerformanceTable({ roomPerf, daysElapsed }) {
  if (!roomPerf || roomPerf.length === 0) return null
  return (
    <div className="bg-surface-raised border border-border rounded-[8px] overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-heading text-[20px] text-text-primary">Room Performance</h2>
        <p className="font-body text-[13px] text-text-muted mt-0.5">Year to date · based on {daysElapsed} days elapsed</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface border-b border-border">
              {['Room', 'Nights Booked', 'Occupancy %', 'ADR', 'Revenue'].map(col => (
                <th key={col} className="px-4 py-3 text-left font-body text-[12px] uppercase tracking-[0.06em] text-text-muted font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roomPerf.map((row, i) => (
              <tr key={row.id} className={cn('border-b border-border last:border-0', i % 2 === 1 && 'bg-surface')}>
                <td className="px-4 py-3 font-body text-[14px] text-text-primary font-medium">{row.name}</td>
                <td className="px-4 py-3 font-mono text-[14px] text-text-secondary">{row.nights}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', row.occupancy >= 70 ? 'bg-success' : row.occupancy >= 40 ? 'bg-info' : 'bg-warning')}
                        style={{ width: `${Math.min(100, row.occupancy)}%` }}
                      />
                    </div>
                    <span className="font-mono text-[13px] text-text-secondary">{row.occupancy}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[14px] text-text-secondary">
                  {row.adr > 0 ? fmt$(row.adr) : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-[14px] text-text-secondary">
                  {row.revenue > 0 ? fmt$(row.revenue) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 bg-surface border-t border-border">
        <p className="font-body text-[12px] text-text-muted">
          ADR = revenue ÷ nights booked for that room · Occupancy = nights booked ÷ days elapsed
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-surface-raised border border-border rounded-[6px] p-3 shadow-md">
      <p className="font-body text-[13px] font-semibold text-text-primary mb-1">{item.payload?.yearMonth ?? label}</p>
      <p className="font-mono text-[13px] text-text-secondary">
        {fmt$(item.value * 100)} earned · {item.payload?.nights ?? 0} nights
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

// Computed once at module level — months don't change within a session
const _now = new Date()
const MONTHS_12 = eachMonthOfInterval({
  start: startOfMonth(subMonths(_now, 11)),
  end:   startOfMonth(_now),
})

export default function Financials() {
  const { data, isLoading } = useFinancialData()
  const now = _now

  const chartData = useMemo(() => {
    if (!data?.payments) return []
    return MONTHS_12.map(month => {
      const monthPayments = paymentsInMonth(data.payments, month)
      const totalCents = monthPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
      const monthRes   = (data.reservations ?? []).filter(r => {
        const ci = parseISO(r.check_in)
        return ci.getMonth() === month.getMonth() && ci.getFullYear() === month.getFullYear()
      })
      return {
        month:     format(month, 'MMM'),
        yearMonth: format(month, 'MMM yyyy'),
        revenue:   totalCents / 100,
        nights:    nightsOf(monthRes),
        isCurrent: month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear(),
      }
    })
  }, [data, now])

  const metrics = useMemo(() => {
    if (!data) return null

    const payments = data.payments ?? []
    const reservations = data.reservations ?? []
    const rooms = data.rooms ?? []

    const thisYearPayments = payments.filter(p => parseISO(p.created_at).getFullYear() === now.getFullYear())
    const lastYearPayments = data.lastYearPayments ?? []

    const thisYearEarnings = thisYearPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
    const lastYearEarnings = lastYearPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)

    const thisMonthPayments = paymentsInMonth(payments, now)
    const lastMonthPayments = paymentsInMonth(payments, subMonths(now, 1))
    const thisMonthEarnings = thisMonthPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
    const lastMonthEarnings = lastMonthPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)

    const yearRes = reservations.filter(r => parseISO(r.check_in).getFullYear() === now.getFullYear())
    const totalNightsYTD = nightsOf(yearRes)

    // Occupancy: total nights booked ÷ (rooms × days elapsed)
    const daysElapsed = Math.max(1, differenceInDays(now, new Date(now.getFullYear(), 0, 1)) + 1)
    const roomCount   = Math.max(1, rooms.length)
    const totalAvailableNights = daysElapsed * roomCount
    const occupancyPct = totalAvailableNights > 0
      ? Math.round((totalNightsYTD / totalAvailableNights) * 100)
      : 0

    // ADR (Average Daily Rate) — total revenue ÷ nights booked
    const adr = totalNightsYTD > 0 ? Math.round(thisYearEarnings / totalNightsYTD) : 0

    // RevPAR — ADR × occupancy rate (revenue per available room night)
    const _revpar = Math.round((adr * occupancyPct) / 100)

    // Best month this year
    const monthTotals = MONTHS_12
      .filter(m => m.getFullYear() === now.getFullYear())
      .map(m => ({
        name:  format(m, 'MMMM'),
        total: paymentsInMonth(payments, m).reduce((s, p) => s + (p.amount_cents ?? 0), 0),
      }))
    const bestMonth = monthTotals.reduce((best, m) => m.total > best.total ? m : best, { name: '—', total: 0 })

    // Completed months average
    const completedMonths = MONTHS_12.filter(m => m.getFullYear() === now.getFullYear() && m.getMonth() < now.getMonth())
    const avgPerMonth = completedMonths.length > 0
      ? completedMonths.reduce((s, m) => s + paymentsInMonth(payments, m).reduce((ss, p) => ss + (p.amount_cents ?? 0), 0), 0) / completedMonths.length
      : 0

    // Per-room performance
    const roomPerf = rooms.map(room => {
      const roomRes = yearRes.filter(r => (r.room_ids ?? []).includes(room.id))
      const roomNights = nightsOf(roomRes)
      // Revenue approximation: not split by room if multi-room, but still useful as a booking indicator
      const occ = totalAvailableNights / roomCount > 0
        ? Math.round((roomNights / daysElapsed) * 100)
        : 0
      const roomRevenue = roomNights > 0 && adr > 0 ? roomNights * adr : 0
      return {
        id:        room.id,
        name:      room.name,
        nights:    roomNights,
        occupancy: Math.min(100, occ),
        adr:       roomNights > 0 ? Math.round(roomRevenue / roomNights) : 0,
        revenue:   roomRevenue,
      }
    }).sort((a, b) => b.revenue - a.revenue)

    return {
      thisMonthEarnings, lastMonthEarnings, thisYearEarnings, lastYearEarnings,
      totalNightsYTD, occupancyPct, adr,
      bestMonth, avgPerMonth, roomPerf, daysElapsed,
      thisYearLabel: String(now.getFullYear()),
      thisMonthLabel: format(now, 'MMMM'),
    }
  }, [data, now])

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-heading text-[32px] text-text-primary">Financial Insights</h1>

      {/* KPI metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <MetricSkeleton key={i} />)
        ) : metrics ? (
          <>
            <MetricCard
              abbr="Revenue"
              label={`earned this month (${metrics.thisMonthLabel})`}
              value={fmt$(metrics.thisMonthEarnings)}
              plain={
                metrics.lastMonthEarnings > 0
                  ? `${metrics.thisMonthEarnings >= metrics.lastMonthEarnings ? '↑' : '↓'} ${fmt$(Math.abs(metrics.thisMonthEarnings - metrics.lastMonthEarnings))} vs. last month`
                  : `${metrics.totalNightsYTD} nights booked so far this year`
              }
            />

            <MetricCard
              abbr="YTD"
              label={`Year to Date — total earned in ${metrics.thisYearLabel}`}
              value={fmt$(metrics.thisYearEarnings)}
              plain={
                metrics.lastYearEarnings > 0
                  ? `Last year same period: ${fmt$(metrics.lastYearEarnings)}`
                  : `All payments received in ${metrics.thisYearLabel}`
              }
              math={
                metrics.lastYearEarnings > 0
                  ? `This year: ${fmt$(metrics.thisYearEarnings)} · Last year: ${fmt$(metrics.lastYearEarnings)} · Difference: ${metrics.thisYearEarnings >= metrics.lastYearEarnings ? '+' : ''}${fmt$(metrics.thisYearEarnings - metrics.lastYearEarnings)}`
                  : null
              }
            />

            <MetricCard
              abbr="ADR"
              label="Average Daily Rate — what you earn per booked night"
              value={fmt$(metrics.adr)}
              plain="Revenue ÷ total nights booked. The higher your ADR, the more each booked night is worth."
              math={
                metrics.totalNightsYTD > 0
                  ? `${fmt$(metrics.thisYearEarnings)} revenue ÷ ${metrics.totalNightsYTD} nights booked = ${fmt$(metrics.adr)}/night`
                  : 'Not enough bookings to calculate yet.'
              }
            />

            <MetricCard
              abbr="Occupancy"
              label={`Occupancy Rate — how full you are in ${metrics.thisYearLabel}`}
              value={metrics.occupancyPct}
              unit="%"
              plain="Percentage of available room-nights that were booked. 100% = fully booked every night."
              math={`${metrics.totalNightsYTD} nights booked ÷ (${Math.max(1, metrics.daysElapsed)} days × ${metrics.roomPerf.length || 1} room${metrics.roomPerf.length !== 1 ? 's' : ''}) = ${metrics.occupancyPct}%`}
            />

            <MetricCard
              abbr="RevPAR"
              label="Revenue Per Available Room — your real earning power"
              value={fmt$(metrics.revpar)}
              plain="ADR × occupancy rate. Combines how often rooms are booked AND what you charge. The best single number to track growth."
              math={`${fmt$(metrics.adr)} ADR × ${metrics.occupancyPct}% occupancy = ${fmt$(metrics.revpar)} RevPAR`}
            />

            <MetricCard
              abbr="Avg"
              label="Average monthly revenue (completed months)"
              value={metrics.avgPerMonth > 0 ? fmt$(metrics.avgPerMonth) : '—'}
              plain={metrics.avgPerMonth > 0 ? `Based on completed months this year` : 'Not enough months completed yet'}
            />
          </>
        ) : null}
      </div>

      {/* Insights */}
      {!isLoading && metrics && <InsightsPanel metrics={metrics} />}

      {/* Room performance */}
      {!isLoading && metrics?.roomPerf && metrics.roomPerf.length > 1 && (
        <RoomPerformanceTable roomPerf={metrics.roomPerf} daysElapsed={metrics.daysElapsed} />
      )}

      {/* 12-month chart */}
      <div className="bg-surface-raised border border-border rounded-[8px] p-6">
        <h2 className="font-heading text-[20px] text-text-primary mb-1">Earnings by Month</h2>
        <p className="font-body text-[13px] text-text-muted mb-6">Last 12 months · current month shown lighter</p>
        {isLoading ? (
          <div className="animate-pulse bg-border rounded h-64 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 480 }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D4D4D4" />
                  <XAxis dataKey="month" tick={{ fontFamily: 'DM Sans', fontSize: 12, fill: '#555555' }} />
                  <YAxis
                    tick={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fill: '#888888' }}
                    tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                    width={48}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={48}>
                    {chartData.map(entry => (
                      <Cell key={entry.month} fill={entry.isCurrent ? '#DBEAFE' : '#1D4ED8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
