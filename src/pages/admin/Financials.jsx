// src/pages/admin/Financials.jsx
// Financial Insights page — plain-language summary, metric cards, 12-month bar chart.

import { useMemo } from 'react'
import {
  format, subMonths, startOfMonth, endOfMonth,
  parseISO, eachMonthOfInterval, getYear,
} from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

function useFinancialData() {
  const { propertyId } = useProperty()
  const now = new Date()
  const yearStart = format(new Date(getYear(now), 0, 1), 'yyyy-MM-dd')
  const yearEnd   = format(endOfMonth(new Date(getYear(now), 11, 31)), 'yyyy-MM-dd')
  const chartFrom = format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd')

  return useQuery({
    queryKey: queryKeys.financials.monthly(propertyId, getYear(now)),
    queryFn: async () => {
      if (!propertyId) return null

      const [paymentsRes, reservationsRes] = await Promise.all([
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
          .select('id, check_in, check_out, status')
          .eq('property_id', propertyId)
          .gte('check_in', yearStart)
          .lte('check_in', yearEnd)
          .neq('status', 'cancelled'),
      ])

      return {
        payments: paymentsRes.data ?? [],
        reservations: reservationsRes.data ?? [],
      }
    },
    enabled: !!propertyId,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dollars(cents) {
  if (!cents) return '$0'
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function dollarsWithCents(cents) {
  if (!cents) return '$0'
  const v = cents / 100
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return '$' + v.toFixed(2)
}

function paymentsForMonth(payments, month) {
  return payments.filter(p => {
    const d = parseISO(p.created_at)
    return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
  })
}

function nightsForReservations(reservations) {
  return reservations.reduce((sum, r) => {
    if (!r.check_in || !r.check_out) return sum
    const nights = Math.max(
      0,
      Math.floor((parseISO(r.check_out) - parseISO(r.check_in)) / (1000 * 60 * 60 * 24))
    )
    return sum + nights
  }, 0)
}

function generateSummary({ thisMonthEarnings, lastMonthEarnings, thisYearEarnings, nightsThisMonth, occupancyPct, monthName }) {
  const earned = dollars(thisMonthEarnings)
  const nights = nightsThisMonth

  let trendStr = ''
  if (lastMonthEarnings > 0 && thisMonthEarnings !== lastMonthEarnings) {
    const diff = thisMonthEarnings - lastMonthEarnings
    const pct = Math.round(Math.abs(diff / lastMonthEarnings) * 100)
    trendStr = diff > 0 ? ` — up ${pct}% from last month` : ` — down ${pct}% from last month`
  }

  const sentence1 = `You've earned ${earned} in ${monthName} across ${nights} night${nights !== 1 ? 's' : ''} booked${trendStr}.`

  let sentence2 = ''
  if (thisYearEarnings > 0) {
    const ytd = dollars(thisYearEarnings)
    const occ = occupancyPct > 0 ? ` Your occupancy rate this year is ${occupancyPct}%.` : ''
    sentence2 = `Year to date, you've brought in ${ytd}.${occ}`
  }

  return [sentence1, sentence2].filter(Boolean).join(' ')
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({ label, value, hint }) {
  return (
    <div className="bg-surface border border-border rounded-[8px] p-5 flex flex-col gap-2">
      <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
        {label}
      </p>
      <p className="font-mono text-[28px] text-text-primary leading-none">{value}</p>
      {hint && (
        <p className="font-body text-[12px] text-text-muted">{hint}</p>
      )}
    </div>
  )
}

function MetricSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-[8px] p-5 animate-pulse">
      <div className="h-3 bg-border rounded w-24 mb-3" />
      <div className="h-8 bg-border rounded w-20" />
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const earned = item.value
  const nights = item.payload.nights ?? 0
  return (
    <div className="bg-surface-raised border border-border rounded-[6px] p-3 shadow-md">
      <p className="font-body text-[13px] font-semibold text-text-primary mb-1">{label}</p>
      <p className="font-mono text-[13px] text-text-secondary">
        {dollars(earned * 100)} earned across {nights} night{nights !== 1 ? 's' : ''} booked
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Financials() {
  const { data, isLoading } = useFinancialData()
  const now = new Date()

  const months12 = useMemo(() => {
    return eachMonthOfInterval({
      start: startOfMonth(subMonths(now, 11)),
      end: startOfMonth(now),
    })
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Build chart data — 12 months
  const chartData = useMemo(() => {
    if (!data?.payments) return []
    return months12.map(month => {
      const monthPayments = paymentsForMonth(data.payments, month)
      const totalCents = monthPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
      const monthReservations = (data.reservations ?? []).filter(r => {
        const ci = parseISO(r.check_in)
        return ci.getMonth() === month.getMonth() && ci.getFullYear() === month.getFullYear()
      })
      return {
        month: format(month, 'MMM'),
        yearMonth: format(month, 'MMM yyyy'),
        revenue: totalCents / 100,        // recharts works in dollars
        nights: nightsForReservations(monthReservations),
        isCurrent: month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear(),
      }
    })
  }, [data, months12])  // eslint-disable-line react-hooks/exhaustive-deps

  // Derived metrics
  const metrics = useMemo(() => {
    if (!data) return null

    const currentMonthPayments = paymentsForMonth(data.payments, now)
    const lastMonthPayments    = paymentsForMonth(data.payments, subMonths(now, 1))

    const thisMonthEarnings = currentMonthPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
    const lastMonthEarnings = lastMonthPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
    const thisYearEarnings  = data.payments.filter(p => {
      const d = parseISO(p.created_at)
      return d.getFullYear() === now.getFullYear()
    }).reduce((s, p) => s + (p.amount_cents ?? 0), 0)

    const thisMonthReservations = (data.reservations ?? []).filter(r => {
      const ci = parseISO(r.check_in)
      return ci.getMonth() === now.getMonth() && ci.getFullYear() === now.getFullYear()
    })
    const nightsThisMonth = nightsForReservations(thisMonthReservations)

    // Occupancy: nights booked vs total available nights in the year so far
    const daysInYearSoFar = Math.min(
      Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24)) + 1,
      365
    )
    const totalYearNights = nightsForReservations(data.reservations ?? [])
    const occupancyPct = daysInYearSoFar > 0
      ? Math.round((totalYearNights / daysInYearSoFar) * 100)
      : 0

    // Best month this year
    const monthTotals = months12
      .filter(m => m.getFullYear() === now.getFullYear())
      .map(m => ({
        name: format(m, 'MMMM'),
        total: paymentsForMonth(data.payments, m).reduce((s, p) => s + (p.amount_cents ?? 0), 0),
      }))
    const bestMonth = monthTotals.reduce((best, m) => m.total > best.total ? m : best, { name: '—', total: 0 })

    // Completed months for average (exclude current partial month)
    const completedMonths = months12.filter(m => {
      if (m.getFullYear() !== now.getFullYear()) return false
      return m.getMonth() < now.getMonth()
    })
    const avgPerMonth = completedMonths.length > 0
      ? completedMonths.reduce((s, m) => s + paymentsForMonth(data.payments, m).reduce((ss, p) => ss + (p.amount_cents ?? 0), 0), 0) / completedMonths.length
      : 0

    return {
      thisMonthEarnings, lastMonthEarnings, thisYearEarnings,
      nightsThisMonth, occupancyPct,
      bestMonth, avgPerMonth,
      monthName: format(now, 'MMMM'),
    }
  }, [data])  // eslint-disable-line react-hooks/exhaustive-deps

  const summary = metrics ? generateSummary(metrics) : null

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <h1 className="font-heading text-[32px] text-text-primary">Financial Insights</h1>

      {/* Summary Paragraph */}
      {isLoading ? (
        <div className="bg-surface-raised border border-border border-l-4 border-l-info rounded-[8px] p-6 animate-pulse">
          <div className="h-5 bg-border rounded w-full mb-2" />
          <div className="h-5 bg-border rounded w-3/4" />
        </div>
      ) : summary ? (
        <div className="bg-surface-raised border border-border rounded-[8px] p-6"
          style={{ borderLeft: '4px solid #1D4ED8' }}>
          <p className="font-body text-[17px] text-text-primary leading-relaxed">{summary}</p>
        </div>
      ) : null}

      {/* Metric Cards — 3-column grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <MetricSkeleton key={i} />)
        ) : metrics ? (
          <>
            <MetricCard
              label="Earned This Month"
              value={dollars(metrics.thisMonthEarnings)}
              hint={`${metrics.nightsThisMonth} night${metrics.nightsThisMonth !== 1 ? 's' : ''} booked`}
            />
            <MetricCard
              label="Earned This Year"
              value={dollars(metrics.thisYearEarnings)}
              hint={`${format(now, 'yyyy')} year to date`}
            />
            <MetricCard
              label="Nights Booked This Month"
              value={String(metrics.nightsThisMonth)}
              hint={format(now, 'MMMM yyyy')}
            />
            <MetricCard
              label="Occupancy This Year"
              value={`${metrics.occupancyPct}%`}
              hint="nights booked vs. days elapsed"
            />
            <MetricCard
              label="Best Month This Year"
              value={metrics.bestMonth.total > 0 ? metrics.bestMonth.name : '—'}
              hint={metrics.bestMonth.total > 0 ? dollars(metrics.bestMonth.total) : 'No data yet'}
            />
            <MetricCard
              label="Average Per Month"
              value={metrics.avgPerMonth > 0 ? dollarsWithCents(metrics.avgPerMonth) : '—'}
              hint="completed months only"
            />
          </>
        ) : null}
      </div>

      {/* Earnings Chart */}
      <div className="bg-surface border border-border rounded-[8px] p-6">
        <h2 className="font-heading text-[20px] text-text-primary mb-6">Your Earnings by Month</h2>
        {isLoading ? (
          <div className="animate-pulse bg-border rounded h-64 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 480 }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D4D4D4" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontFamily: 'DM Sans', fontSize: 12, fill: '#555555' }}
                  />
                  <YAxis
                    tick={{ fontFamily: 'IBM Plex Mono', fontSize: 11, fill: '#888888' }}
                    tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                    width={48}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={48}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.month}
                        fill={entry.isCurrent ? '#DBEAFE' : '#1D4ED8'}
                      />
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
