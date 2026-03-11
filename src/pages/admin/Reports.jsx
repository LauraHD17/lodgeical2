// src/pages/admin/Reports.jsx
// Merged Reports & Financials page.
// Sections: Financial KPIs → Insights → Room Performance → Revenue/Occupancy charts

import { useState, useMemo } from 'react'
import {
  format, subMonths, addMonths, startOfMonth, endOfMonth,
  parseISO, eachMonthOfInterval, getYear, getDay, differenceInDays,
} from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  CaretDown, CaretUp, Lightbulb, TrendUp, TrendDown,
  DownloadSimple, ChartBar, ArrowsClockwise, CheckCircle,
  WarningCircle, SpinnerGap,
} from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DataTable } from '@/components/shared/DataTable'
import { CHART_COLORS, CHART_AXIS_TICK, CHART_AXIS_TICK_MONO, CHART_GRID_STROKE } from '@/config/chartTokens'
import { cn, fmtMoney } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useFinancialData() {
  const { propertyId } = useProperty()
  const now = new Date()
  const yearStart  = format(new Date(getYear(now), 0, 1),            'yyyy-MM-dd')
  const yearEnd    = format(endOfMonth(new Date(getYear(now), 11, 31)), 'yyyy-MM-dd')
  const chartFrom  = format(startOfMonth(subMonths(now, 11)),         'yyyy-MM-dd')
  const lastYStart = format(new Date(getYear(now) - 1, 0, 1),        'yyyy-MM-dd')
  const lastYEnd   = format(new Date(getYear(now) - 1, 11, 31),      'yyyy-MM-dd')

  return useQuery({
    queryKey: queryKeys.financials.monthly(propertyId, getYear(now)),
    queryFn: async () => {
      if (!propertyId) return null
      const [paymentsRes, reservationsRes, roomsRes, lastYearPayRes, lastYearResRes, cancelledRes] = await Promise.all([
        supabase.from('payments').select('id, amount_cents, status, created_at, type').eq('property_id', propertyId).gte('created_at', chartFrom).lte('created_at', yearEnd).in('status', ['succeeded', 'paid']).eq('type', 'charge'),
        supabase.from('reservations').select('id, room_ids, check_in, check_out, status, created_at, total_due_cents').eq('property_id', propertyId).gte('check_in', yearStart).lte('check_in', yearEnd).neq('status', 'cancelled'),
        supabase.from('rooms').select('id, name').eq('property_id', propertyId).eq('is_active', true),
        supabase.from('payments').select('id, amount_cents, status, created_at, type').eq('property_id', propertyId).gte('created_at', lastYStart).lte('created_at', lastYEnd).in('status', ['succeeded', 'paid']).eq('type', 'charge'),
        supabase.from('reservations').select('id, room_ids, check_in, check_out, status').eq('property_id', propertyId).gte('check_in', lastYStart).lte('check_in', lastYEnd).neq('status', 'cancelled'),
        supabase.from('reservations').select('id, status').eq('property_id', propertyId).gte('check_in', yearStart).lte('check_in', yearEnd),
      ])
      return {
        payments:         paymentsRes.data     ?? [],
        reservations:     reservationsRes.data  ?? [],
        rooms:            roomsRes.data         ?? [],
        lastYearPayments: lastYearPayRes.data   ?? [],
        lastYearRes:      lastYearResRes.data   ?? [],
        allResWithCancelled: cancelledRes.data   ?? [],
      }
    },
    enabled: !!propertyId,
  })
}

function useRangedData(dateFrom, dateTo) {
  const { propertyId } = useProperty()
  // Fetch reservations starting 60 days before dateFrom so stays that began before
  // the range window but overlap into it are included in per-month occupancy counts.
  const resFetchFrom = format(subMonths(new Date(dateFrom), 2), 'yyyy-MM-dd')
  return useQuery({
    queryKey: queryKeys.reports.ranged(propertyId, dateFrom, dateTo, resFetchFrom),
    queryFn: async () => {
      if (!propertyId) return { reservations: [], payments: [] }
      const [resResult, payResult] = await Promise.all([
        supabase.from('reservations').select('id, check_in, check_out, total_due_cents, status').eq('property_id', propertyId).gte('check_in', resFetchFrom).lte('check_in', dateTo).neq('status', 'cancelled'),
        supabase.from('payments').select('id, amount_cents, created_at, status').eq('property_id', propertyId).gte('created_at', dateFrom).lte('created_at', dateTo).in('status', ['paid', 'succeeded']),
      ])
      return { reservations: resResult.data ?? [], payments: payResult.data ?? [] }
    },
    enabled: !!propertyId,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------


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

function exportCSV(data, filename) {
  if (!data.length) return
  const keys = Object.keys(data[0])
  const rows = [keys.join(','), ...data.map(r => keys.map(k => r[k]).join(','))]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Metric card with "Show my math"
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
          <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 font-body text-[12px] text-info mt-1 hover:underline w-fit">
            {open ? <CaretUp size={11} /> : <CaretDown size={11} />} Show my math
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
// Insights panel
// ---------------------------------------------------------------------------

function InsightItem({ ins }) {
  const [open, setOpen] = useState(false)
  const Icon = ins.icon
  return (
    <li className="flex items-start gap-3">
      <Icon size={18} weight="fill" className={cn('mt-0.5 shrink-0', ins.color)} />
      <div className="flex-1 min-w-0">
        <p className="font-body text-[14px] text-text-primary leading-relaxed">{ins.text}</p>
        {ins.math && (
          <>
            <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 font-body text-[12px] text-info mt-1 hover:underline w-fit">
              {open ? <CaretUp size={11} /> : <CaretDown size={11} />} Show my math
            </button>
            {open && (
              <div className="mt-2 bg-surface border border-border rounded-[6px] p-3 text-[12px] font-body text-text-secondary leading-relaxed">
                {ins.math}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  )
}

function InsightsPanel({ metrics }) {
  const {
    adr, occupancyPct, thisYearEarnings, lastYearEarnings, bestMonth, roomPerf,
    avgLeadTime, avgStay, weekdayPct, weekendPct, cancellationRate, totalCheckins,
    thisYearLabel, totalNightsYTD,
  } = metrics

  const insights = (() => {
    const actionable = []
    const informational = []

    // YoY revenue
    if (lastYearEarnings > 0) {
      const diff = thisYearEarnings - lastYearEarnings
      const pct  = Math.abs(Math.round((diff / lastYearEarnings) * 100))
      if (diff > 0)      actionable.push({ icon: TrendUp,  color: 'text-success', text: `Revenue is up ${pct}% vs. the same time last year. Keep it up!` })
      else if (diff < 0) actionable.push({ icon: TrendDown, color: 'text-danger',  text: `Revenue is down ${pct}% vs. this time last year. Consider reviewing pricing or minimum stay settings.` })
    }

    // Occupancy
    if (occupancyPct >= 80) actionable.push({ icon: TrendUp, color: 'text-success', text: `Occupancy is ${occupancyPct}% — demand is strong. You may be able to raise nightly rates without losing bookings.` })
    else if (occupancyPct > 0 && occupancyPct < 35) actionable.push({ icon: TrendDown, color: 'text-warning', text: `Occupancy is ${occupancyPct}% so far this year. Consider dropping a 2-night minimum or running a weeknight promo.` })

    // ADR
    if (adr > 0 && adr < 10000) actionable.push({ icon: Lightbulb, color: 'text-info', text: `Average nightly rate is ${fmtMoney(adr)}. A small increase during high-demand periods can add up quickly.` })

    // Booking lead time
    if (avgLeadTime > 0) {
      if (avgLeadTime <= 7) actionable.push({ icon: Lightbulb, color: 'text-warning', text: `Most bookings come ${avgLeadTime} days in advance. Guests are booking last-minute — consider a small last-minute discount to fill gaps or early-bird pricing to lock in revenue sooner.` })
      else if (avgLeadTime >= 30) informational.push({ icon: TrendUp, color: 'text-success', text: `Average booking lead time is ${avgLeadTime} days. Guests plan ahead — you can confidently set rates further in advance.` })
      else informational.push({ icon: Lightbulb, color: 'text-info', text: `Average booking lead time is ${avgLeadTime} days. Consider offering an early-bird rate for bookings 30+ days out.` })
    }

    // Length of stay
    if (avgStay > 0) {
      if (avgStay < 2) actionable.push({ icon: Lightbulb, color: 'text-info', text: `Average stay is ${avgStay} nights. A 2-night minimum on weekends could increase revenue and reduce turnover costs.` })
      else if (avgStay >= 4) informational.push({ icon: TrendUp, color: 'text-success', text: `Average stay is ${avgStay} nights — guests are staying longer. Consider a weekly rate discount to encourage even more extended bookings.` })
    }

    // Day-of-week patterns
    if (totalCheckins >= 5 && weekdayPct > 0) {
      if (weekdayPct < 25) actionable.push({ icon: Lightbulb, color: 'text-info', text: `Only ${weekdayPct}% of check-ins are on weekdays vs. ${weekendPct}% on weekends. Try a weeknight rate reduction to fill midweek gaps.` })
      else if (weekendPct < 25) informational.push({ icon: Lightbulb, color: 'text-info', text: `${weekdayPct}% of check-ins are on weekdays. Your weekend rates may be too high — consider a small weekend promotion.` })
    }

    // Cancellation rate
    if (cancellationRate > 15) actionable.push({ icon: TrendDown, color: 'text-warning', text: `${cancellationRate}% of bookings have been cancelled. Consider requiring a deposit at booking or tightening your cancellation policy.` })
    else if (cancellationRate > 0 && cancellationRate <= 5) informational.push({ icon: TrendUp, color: 'text-success', text: `Only ${cancellationRate}% cancellation rate — your guests commit and follow through.` })

    // Room-level insights
    if (roomPerf) {
      const high = roomPerf.filter(r => r.occupancy >= 80)
      const low  = roomPerf.filter(r => r.occupancy < 30 && r.nights > 0)
      if (high.length > 0) actionable.push({ icon: TrendUp, color: 'text-success', text: `${high.map(r => r.name).join(', ')} ${high.length === 1 ? 'has' : 'have'} high occupancy and may support a rate increase.` })
      if (low.length > 0) actionable.push({ icon: Lightbulb, color: 'text-info', text: `${low.map(r => r.name).join(', ')} ${low.length === 1 ? 'has' : 'have'} low bookings this year. Adding photos or adjusting minimum stay might help.` })
    }

    // Best month
    if (bestMonth.total > 0) informational.push({ icon: Lightbulb, color: 'text-info', text: `${bestMonth.name} was your strongest month this year (${fmtMoney(bestMonth.total)}). Consider pricing that month higher next year.` })

    // Always-on plain-language summary when data exists
    if (thisYearEarnings > 0 && totalNightsYTD > 0) {
      informational.push({
        icon: Lightbulb, color: 'text-info',
        text: `You've earned ${fmtMoney(thisYearEarnings)} in ${thisYearLabel} across ${totalNightsYTD} nights booked.`,
        math: `Sum of all payments received in ${thisYearLabel}: ${fmtMoney(thisYearEarnings)} · Nights booked: ${totalNightsYTD}`,
      })
    }
    if (adr > 0) {
      informational.push({
        icon: Lightbulb, color: 'text-info',
        text: `Your average nightly rate is ${fmtMoney(adr)} — that's how much you earn per booked night.`,
        math: `${fmtMoney(thisYearEarnings)} total revenue ÷ ${totalNightsYTD} nights booked = ${fmtMoney(adr)} per night`,
      })
    }
    if (bestMonth.total > 0) {
      informational.push({
        icon: Lightbulb, color: 'text-info',
        text: `${bestMonth.name} is your top revenue month so far this year at ${fmtMoney(bestMonth.total)}.`,
        math: `Sum of all payments received in ${bestMonth.name}: ${fmtMoney(bestMonth.total)}`,
      })
    }

    // Not enough data
    if (actionable.length === 0 && informational.length === 0 && thisYearEarnings === 0) {
      return [{ icon: Lightbulb, color: 'text-text-muted', text: 'Not enough booking data yet. Check back once some reservations have been recorded.' }]
    }

    // Prioritize actionable, then informational, cap at 8
    return [...actionable, ...informational].slice(0, 8)
  })()

  return (
    <div className="bg-surface-raised border border-border rounded-[8px] p-6">
      <h2 className="font-heading text-[20px] text-text-primary mb-4">Insights & Recommendations</h2>
      {insights.length === 0 ? (
        <div className="flex items-start gap-3">
          <Lightbulb size={16} weight="fill" className="text-text-muted shrink-0 mt-0.5" />
          <p className="font-body text-[14px] text-text-muted">
            Insights will appear here once you have a few months of booking history.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {insights.map((ins, i) => <InsightItem key={i} ins={ins} />)}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Room performance table
// ---------------------------------------------------------------------------

function RoomPerformanceTable({ roomPerf, daysElapsed }) {
  if (!roomPerf?.length) return null
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
                <th key={col} className="px-4 py-3 text-left font-body text-[12px] uppercase tracking-[0.06em] text-text-muted font-semibold">{col}</th>
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
                      <div className={cn('h-full rounded-full', row.occupancy >= 70 ? 'bg-success' : row.occupancy >= 40 ? 'bg-info' : 'bg-warning')} style={{ width: `${Math.min(100, row.occupancy)}%` }} />
                    </div>
                    <span className="font-mono text-[13px] text-text-secondary">{row.occupancy}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[14px] text-text-secondary">{row.adr > 0 ? fmtMoney(row.adr) : '—'}</td>
                <td className="px-4 py-3 font-mono text-[14px] text-text-secondary">{row.revenue > 0 ? fmtMoney(row.revenue) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 bg-surface border-t border-border">
        <p className="font-body text-[12px] text-text-muted">ADR = revenue ÷ nights booked · Occupancy = nights booked ÷ days elapsed</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart tooltips
// ---------------------------------------------------------------------------

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-surface-raised border border-border rounded-[6px] p-3">
      <p className="font-body text-[13px] font-semibold text-text-primary mb-1">{item.payload?.yearMonth ?? label}</p>
      <p className="font-mono text-[13px] text-text-secondary">{fmtMoney(item.value * 100)}</p>
    </div>
  )
}

function RangeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const isOccupancy = item.dataKey === 'occupancy'
  return (
    <div className="bg-surface-raised border border-border rounded-[6px] p-3">
      <p className="font-body text-[13px] font-semibold text-text-primary mb-1">{label}</p>
      <p className="font-mono text-[13px] text-text-secondary">
        {isOccupancy ? `${item.value}%` : `$${item.value}`}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

const _now = new Date()
const MONTHS_12 = eachMonthOfInterval({
  start: startOfMonth(subMonths(_now, 11)),
  end:   startOfMonth(_now),
})

const RANGE_OPTIONS = [
  { value: 3,  label: 'Last 3 months' },
  { value: 6,  label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
]

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Reports() {
  const now = _now
  const [monthRange, setMonthRange] = useState(6)

  const { data: finData, isLoading: finLoading } = useFinancialData()

  const dateFrom = format(startOfMonth(subMonths(now, monthRange - 1)), 'yyyy-MM-dd')
  const dateTo   = format(endOfMonth(now), 'yyyy-MM-dd')
  const { data: rangedData, isLoading: rangedLoading } = useRangedData(dateFrom, dateTo)

  const rangedMonths = useMemo(() => {
    const from = startOfMonth(subMonths(now, monthRange - 1))
    return eachMonthOfInterval({ start: from, end: endOfMonth(now) })
  }, [monthRange, now])

  // KPI metrics
  const metrics = useMemo(() => {
    if (!finData) return null
    const payments     = finData.payments ?? []
    const reservations = finData.reservations ?? []
    const rooms        = finData.rooms ?? []

    const thisYearPayments  = payments.filter(p => parseISO(p.created_at).getFullYear() === now.getFullYear())
    const lastYearPayments  = finData.lastYearPayments ?? []
    const thisYearEarnings  = thisYearPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
    const lastYearEarnings  = lastYearPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
    const thisMonthPayments = paymentsInMonth(payments, now)
    const lastMonthPayments = paymentsInMonth(payments, subMonths(now, 1))
    const thisMonthEarnings = thisMonthPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
    const lastMonthEarnings = lastMonthPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)

    const yearRes        = reservations.filter(r => parseISO(r.check_in).getFullYear() === now.getFullYear())
    const totalNightsYTD = nightsOf(yearRes)
    const daysElapsed    = Math.max(1, differenceInDays(now, new Date(now.getFullYear(), 0, 1)) + 1)
    const roomCount      = Math.max(1, rooms.length)
    const totalAvail     = daysElapsed * roomCount
    const occupancyPct   = totalAvail > 0 ? Math.round((totalNightsYTD / totalAvail) * 100) : 0
    const adr            = totalNightsYTD > 0 ? Math.round(thisYearEarnings / totalNightsYTD) : 0
    const revpar         = Math.round((adr * occupancyPct) / 100)

    const monthTotals = MONTHS_12.filter(m => m.getFullYear() === now.getFullYear()).map(m => ({
      name: format(m, 'MMMM'),
      total: paymentsInMonth(payments, m).reduce((s, p) => s + (p.amount_cents ?? 0), 0),
    }))
    const bestMonth = monthTotals.reduce((best, m) => m.total > best.total ? m : best, { name: '—', total: 0 })

    const completedMonths = MONTHS_12.filter(m => m.getFullYear() === now.getFullYear() && m.getMonth() < now.getMonth())
    const avgPerMonth = completedMonths.length > 0
      ? completedMonths.reduce((s, m) => s + paymentsInMonth(payments, m).reduce((ss, p) => ss + (p.amount_cents ?? 0), 0), 0) / completedMonths.length
      : 0

    const roomPerf = rooms.map(room => {
      const roomRes     = yearRes.filter(r => (r.room_ids ?? []).includes(room.id))
      const roomNights  = nightsOf(roomRes)
      const occ         = daysElapsed > 0 ? Math.round((roomNights / daysElapsed) * 100) : 0
      // Allocate each reservation's total evenly across its rooms
      const roomRevenue = roomRes.reduce((sum, r) => {
        const share = Math.round((r.total_due_cents ?? 0) / Math.max(1, (r.room_ids ?? []).length))
        return sum + share
      }, 0)
      return { id: room.id, name: room.name, nights: roomNights, occupancy: Math.min(100, occ), adr: roomNights > 0 ? Math.round(roomRevenue / roomNights) : 0, revenue: roomRevenue }
    }).sort((a, b) => b.revenue - a.revenue)

    // Booking lead time: days between created_at and check_in
    const leadTimes = yearRes.filter(r => r.created_at && r.check_in).map(r => differenceInDays(parseISO(r.check_in), parseISO(r.created_at)))
    const avgLeadTime = leadTimes.length > 0 ? Math.round(leadTimes.reduce((s, d) => s + d, 0) / leadTimes.length) : 0

    // Average length of stay
    const stayLengths = yearRes.filter(r => r.check_in && r.check_out).map(r => differenceInDays(parseISO(r.check_out), parseISO(r.check_in)))
    const avgStay = stayLengths.length > 0 ? Math.round((stayLengths.reduce((s, d) => s + d, 0) / stayLengths.length) * 10) / 10 : 0

    // Day-of-week check-in distribution
    const weekdayCheckins = yearRes.filter(r => r.check_in).reduce((acc, r) => { const d = getDay(parseISO(r.check_in)); return d >= 1 && d <= 4 ? acc + 1 : acc }, 0)
    const weekendCheckins = yearRes.filter(r => r.check_in).length - weekdayCheckins
    const totalCheckins = weekdayCheckins + weekendCheckins
    const weekdayPct = totalCheckins > 0 ? Math.round((weekdayCheckins / totalCheckins) * 100) : 0
    const weekendPct = totalCheckins > 0 ? 100 - weekdayPct : 0

    // Cancellation rate
    const allRes = finData.allResWithCancelled ?? []
    const cancelledCount = allRes.filter(r => r.status === 'cancelled').length
    const cancellationRate = allRes.length > 0 ? Math.round((cancelledCount / allRes.length) * 100) : 0

    return { thisMonthEarnings, lastMonthEarnings, thisYearEarnings, lastYearEarnings, totalNightsYTD, occupancyPct, adr, revpar, bestMonth, avgPerMonth, roomPerf, daysElapsed, thisYearLabel: String(now.getFullYear()), thisMonthLabel: format(now, 'MMMM'), avgLeadTime, avgStay, weekdayPct, weekendPct, cancellationRate, totalCheckins }
  }, [finData, now])

  // 12-month earnings chart
  const earningsChartData = useMemo(() => {
    if (!finData?.payments) return []
    return MONTHS_12.map(month => {
      const mp         = paymentsInMonth(finData.payments, month)
      const totalCents = mp.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
      return { month: format(month, 'MMM'), yearMonth: format(month, 'MMM yyyy'), revenue: totalCents / 100, isCurrent: month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear() }
    })
  }, [finData, now])

  // Range revenue by month
  const revenueByMonth = useMemo(() => {
    if (!rangedData?.payments) return []
    return rangedMonths.map(month => {
      const label = format(month, 'MMM yyyy')
      const total = rangedData.payments.filter(p => {
        const d = parseISO(p.created_at)
        return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
      }).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)
      return { month: label, revenue: parseFloat((total / 100).toFixed(2)) }
    })
  }, [rangedData, rangedMonths])

  // Range occupancy by month — counts nights that fall within each month,
  // not just reservations whose check_in is in that month.
  const occupancyByMonth = useMemo(() => {
    if (!rangedData?.reservations) return []
    return rangedMonths.map(month => {
      const label        = format(month, 'MMM yyyy')
      const daysInMonth  = endOfMonth(month).getDate()
      const monthStart   = startOfMonth(month)
      const nextMonthStart = startOfMonth(addMonths(month, 1))

      const occupiedDays = rangedData.reservations.reduce((sum, r) => {
        if (!r.check_in || !r.check_out) return sum
        const ci = parseISO(r.check_in)
        const co = parseISO(r.check_out)
        if (ci >= nextMonthStart || co <= monthStart) return sum
        const effStart = ci > monthStart ? ci : monthStart
        const effEnd   = co < nextMonthStart ? co : nextMonthStart
        return sum + Math.max(0, Math.round((effEnd - effStart) / (1000 * 60 * 60 * 24)))
      }, 0)

      return { month: label, occupancy: daysInMonth > 0 ? Math.min(100, Math.round((occupiedDays / daysInMonth) * 100)) : 0 }
    })
  }, [rangedData, rangedMonths])

  return (
    <div className="flex flex-col gap-10">
      <h1 className="font-heading text-[24px] sm:text-[32px] text-text-primary uppercase">Reports & Financials</h1>

      {/* ── Financial KPI cards ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-[22px] text-text-primary">Financial Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {finLoading ? (
            Array.from({ length: 6 }).map((_, i) => <MetricSkeleton key={i} />)
          ) : metrics ? (
            <>
              <MetricCard
                abbr="Revenue"
                label={`earned this month (${metrics.thisMonthLabel})`}
                value={fmtMoney(metrics.thisMonthEarnings)}
                plain={metrics.lastMonthEarnings > 0
                  ? `${metrics.thisMonthEarnings >= metrics.lastMonthEarnings ? '↑' : '↓'} ${fmtMoney(Math.abs(metrics.thisMonthEarnings - metrics.lastMonthEarnings))} vs. last month`
                  : `${metrics.totalNightsYTD} nights booked so far this year`}
              />
              <MetricCard
                abbr="YTD"
                label={`Year to Date — total earned in ${metrics.thisYearLabel}`}
                value={fmtMoney(metrics.thisYearEarnings)}
                plain={metrics.lastYearEarnings > 0 ? `Last year same period: ${fmtMoney(metrics.lastYearEarnings)}` : `All payments received in ${metrics.thisYearLabel}`}
                math={metrics.lastYearEarnings > 0 ? `This year: ${fmtMoney(metrics.thisYearEarnings)} · Last year: ${fmtMoney(metrics.lastYearEarnings)} · Diff: ${metrics.thisYearEarnings >= metrics.lastYearEarnings ? '+' : ''}${fmtMoney(metrics.thisYearEarnings - metrics.lastYearEarnings)}` : null}
              />
              <MetricCard
                abbr="ADR"
                label="Average Daily Rate — what you earn per booked night"
                value={fmtMoney(metrics.adr)}
                plain="Revenue ÷ total nights booked."
                math={metrics.totalNightsYTD > 0 ? `${fmtMoney(metrics.thisYearEarnings)} ÷ ${metrics.totalNightsYTD} nights = ${fmtMoney(metrics.adr)}/night` : 'Not enough bookings yet.'}
              />
              <MetricCard
                abbr="Occupancy"
                label={`Occupancy Rate — how full you are in ${metrics.thisYearLabel}`}
                value={metrics.occupancyPct}
                unit="%"
                plain="Percentage of available room-nights that were booked."
                math={`${metrics.totalNightsYTD} nights ÷ (${metrics.daysElapsed} days × ${metrics.roomPerf.length || 1} room${metrics.roomPerf.length !== 1 ? 's' : ''}) = ${metrics.occupancyPct}%`}
              />
              <MetricCard
                abbr="RevPAR"
                label="Revenue Per Available Room"
                value={fmtMoney(metrics.revpar)}
                plain="ADR × occupancy rate. Best single number to track growth."
                math={`${fmtMoney(metrics.adr)} ADR × ${metrics.occupancyPct}% occupancy = ${fmtMoney(metrics.revpar)}`}
              />
              <MetricCard
                abbr="Avg/Mo"
                label="Average monthly revenue (completed months)"
                value={metrics.avgPerMonth > 0 ? fmtMoney(metrics.avgPerMonth) : '—'}
                plain={metrics.avgPerMonth > 0 ? 'Based on completed months this year' : 'Not enough months completed yet'}
              />
            </>
          ) : null}
        </div>
      </div>

      {/* ── Insights ─────────────────────────────────────────────────────── */}
      {!finLoading && metrics && <InsightsPanel metrics={metrics} />}

      {/* ── Room Performance ─────────────────────────────────────────────── */}
      {!finLoading && metrics?.roomPerf && metrics.roomPerf.length > 1 && (
        <RoomPerformanceTable roomPerf={metrics.roomPerf} daysElapsed={metrics.daysElapsed} />
      )}

      {/* ── 12-month Earnings Chart ───────────────────────────────────────── */}
      <div className="bg-surface-raised border border-border rounded-[8px] p-6">
        <h2 className="font-heading text-[20px] text-text-primary mb-1">Earnings by Month</h2>
        <p className="font-body text-[13px] text-text-muted mb-6">Last 12 months · current month shown lighter</p>
        {finLoading ? (
          <div className="animate-pulse bg-border rounded h-64 w-full" />
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 480 }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={earningsChartData} margin={{ top: 0, right: 0, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                  <XAxis dataKey="month" tick={CHART_AXIS_TICK} />
                  <YAxis tick={CHART_AXIS_TICK_MONO} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} width={48} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={48}>
                    {earningsChartData.map(entry => (
                      <Cell key={entry.month} fill={entry.isCurrent ? CHART_COLORS.infoBg : CHART_COLORS.info} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── Range-selectable Revenue & Occupancy Charts ───────────────────── */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-heading text-[22px] text-text-primary">Revenue & Occupancy Breakdown</h2>
          <div className="flex items-center gap-2">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setMonthRange(opt.value)}
                className={`font-body text-[13px] px-3 py-1.5 rounded-[6px] transition-colors ${monthRange === opt.value ? 'bg-text-primary text-white' : 'bg-surface border border-border text-text-secondary hover:bg-border'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {rangedLoading ? (
          <div className="flex flex-col gap-6">
            <div className="animate-pulse bg-border rounded-[8px] h-64 w-full" />
            <div className="animate-pulse bg-border rounded-[8px] h-64 w-full" />
          </div>
        ) : (
          <>
            <div className="bg-surface border border-border rounded-[8px] p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <ChartBar size={20} className="text-text-secondary" />
                  <h3 className="font-heading text-[18px] text-text-primary">Revenue by Month</h3>
                </div>
                <Button variant="secondary" size="sm" onClick={() => exportCSV(revenueByMonth, 'revenue-by-month.csv')}>
                  <DownloadSimple size={14} /> Export CSV
                </Button>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={revenueByMonth} margin={{ top: 0, right: 0, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                  <XAxis dataKey="month" tick={CHART_AXIS_TICK} />
                  <YAxis tick={CHART_AXIS_TICK_MONO} tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} width={48} />
                  <Tooltip content={<RangeTooltip />} />
                  <Bar dataKey="revenue" fill={CHART_COLORS.info} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-surface border border-border rounded-[8px] p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <ChartBar size={20} className="text-text-secondary" />
                  <h3 className="font-heading text-[18px] text-text-primary">Occupancy % by Month</h3>
                </div>
                <Button variant="secondary" size="sm" onClick={() => exportCSV(occupancyByMonth, 'occupancy-by-month.csv')}>
                  <DownloadSimple size={14} /> Export CSV
                </Button>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={occupancyByMonth} margin={{ top: 0, right: 0, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                  <XAxis dataKey="month" tick={CHART_AXIS_TICK} />
                  <YAxis tick={CHART_AXIS_TICK_MONO} tickFormatter={v => `${v}%`} domain={[0, 100]} width={48} />
                  <Tooltip content={<RangeTooltip />} />
                  <Bar dataKey="occupancy" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* Stripe Reconciliation */}
        <StripeReconciliation />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stripe Reconciliation Section
// ---------------------------------------------------------------------------

function StripeReconciliation() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const thirtyDaysAgo = format(subMonths(new Date(), 1), 'yyyy-MM-dd')

  const [open, setOpen] = useState(true)
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo)
  const [dateTo, setDateTo] = useState(today)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function runReconciliation() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-reconcile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ date_from: dateFrom, date_to: dateTo }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Reconciliation failed')
      setResult(json)
    } catch (err) {
      setError(err.message || 'Failed to run reconciliation')
    } finally {
      setLoading(false)
    }
  }

  const DISCREPANCY_COLUMNS = [
    {
      key: 'type',
      label: 'Type',
      render: (_, row) => {
        if (row._type === 'mismatch') return <span className="font-body text-[13px] text-warning font-semibold">Amount mismatch</span>
        if (row._type === 'stripeOnly') return <span className="font-body text-[13px] text-danger font-semibold">Not in Lodge-ical</span>
        return <span className="font-body text-[13px] text-info font-semibold">Not in Stripe</span>
      },
    },
    {
      key: 'id',
      label: 'ID',
      render: (_, row) => (
        <span className="font-mono text-[13px]">
          {row.stripeId || row.localId || '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (_, row) => {
        if (row._type === 'mismatch') {
          return (
            <span className="font-mono text-[13px]">
              Local: ${(row.localAmount / 100).toFixed(2)} / Stripe: ${(row.stripeAmount / 100).toFixed(2)}
            </span>
          )
        }
        return <span className="font-mono text-[13px]">${((row.amount ?? 0) / 100).toFixed(2)}</span>
      },
    },
  ]

  const isClean = result &&
    result.summary.mismatches === 0 &&
    result.summary.stripeOnly === 0 &&
    result.summary.localOnly === 0

  const issueCount = result
    ? result.summary.mismatches + result.summary.stripeOnly + result.summary.localOnly
    : 0

  return (
    <div className="bg-surface border border-border rounded-[8px] mt-6 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-6 py-4 text-left hover:bg-surface-raised transition-colors"
      >
        <ArrowsClockwise size={18} className="text-text-secondary shrink-0" />
        <span className="font-heading text-[20px] text-text-primary flex-1">Stripe Reconciliation</span>
        {result && !open && (
          isClean
            ? <span className="inline-flex items-center gap-1.5 font-body text-[13px] text-success mr-2">
                <CheckCircle size={13} weight="fill" /> All {result.summary.matched} matched
              </span>
            : <span className="inline-flex items-center gap-1.5 font-body text-[13px] text-warning mr-2">
                <WarningCircle size={13} weight="fill" /> {issueCount} issue{issueCount !== 1 ? 's' : ''} found
              </span>
        )}
        {open ? <CaretUp size={14} className="text-text-muted shrink-0" /> : <CaretDown size={14} className="text-text-muted shrink-0" />}
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-border">
          <p className="font-body text-[14px] text-text-secondary mt-4 mb-4">
            Compare local payment records with Stripe charges to find discrepancies.
          </p>

          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div className="min-w-[160px]">
              <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="min-w-[160px]">
              <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button variant="primary" size="md" loading={loading} onClick={runReconciliation}>
              <ArrowsClockwise size={14} weight="bold" /> Run Reconciliation
            </Button>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-danger-bg border border-danger rounded-[6px] mb-4">
              <WarningCircle size={16} weight="fill" className="text-danger shrink-0 mt-0.5" />
              <p className="font-body text-[14px] text-danger">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 py-8 justify-center">
              <SpinnerGap size={20} className="animate-spin text-info" />
              <span className="font-body text-[14px] text-text-muted">Fetching Stripe data and comparing...</span>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-4">
              {/* Compact chip summary row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-success-bg border border-success/40 rounded-[6px]">
                  <span className="font-mono text-[13px] font-semibold text-success">{result.summary.matched}</span>
                  <span className="font-body text-[12px] text-success">matched</span>
                </span>
                <span className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] border',
                  result.summary.mismatches > 0 ? 'bg-warning-bg border-warning/40' : 'bg-surface-raised border-border')}>
                  <span className={cn('font-mono text-[13px] font-semibold', result.summary.mismatches > 0 ? 'text-warning' : 'text-text-muted')}>{result.summary.mismatches}</span>
                  <span className={cn('font-body text-[12px]', result.summary.mismatches > 0 ? 'text-warning' : 'text-text-secondary')}>mismatches</span>
                </span>
                <span className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] border',
                  result.summary.stripeOnly > 0 ? 'bg-danger-bg border-danger/40' : 'bg-surface-raised border-border')}>
                  <span className={cn('font-mono text-[13px] font-semibold', result.summary.stripeOnly > 0 ? 'text-danger' : 'text-text-muted')}>{result.summary.stripeOnly}</span>
                  <span className={cn('font-body text-[12px]', result.summary.stripeOnly > 0 ? 'text-danger' : 'text-text-secondary')}>not in Lodge-ical</span>
                </span>
                <span className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-[6px] border',
                  result.summary.localOnly > 0 ? 'bg-info-bg border-info/40' : 'bg-surface-raised border-border')}>
                  <span className={cn('font-mono text-[13px] font-semibold', result.summary.localOnly > 0 ? 'text-info' : 'text-text-muted')}>{result.summary.localOnly}</span>
                  <span className={cn('font-body text-[12px]', result.summary.localOnly > 0 ? 'text-info' : 'text-text-secondary')}>not in Stripe</span>
                </span>
              </div>

              {/* All clean banner */}
              {isClean && (
                <div className="flex items-center gap-2 p-4 bg-success-bg border border-success rounded-[8px]">
                  <CheckCircle size={18} weight="fill" className="text-success" />
                  <p className="font-body text-[14px] text-success font-semibold">
                    All {result.summary.matched} transactions match. No discrepancies found.
                  </p>
                </div>
              )}

              {/* Discrepancy table */}
              {(result.mismatches?.length > 0 || result.stripeOnly?.length > 0 || result.localOnly?.length > 0) && (
                <div className="border border-border rounded-[8px] overflow-hidden">
                  <DataTable
                    columns={DISCREPANCY_COLUMNS}
                    data={[
                      ...(result.mismatches ?? []).map(r => ({ ...r, _type: 'mismatch' })),
                      ...(result.stripeOnly ?? []).map(r => ({ ...r, _type: 'stripeOnly' })),
                      ...(result.localOnly ?? []).map(r => ({ ...r, _type: 'localOnly' })),
                    ]}
                    emptyState={<p className="text-text-muted font-body text-[14px] py-4">No discrepancies</p>}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
