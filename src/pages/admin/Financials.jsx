// src/pages/admin/Financials.jsx
// Business analytics with plain-language explanations and "Show my math" disclosures.
// Metrics: Occupancy %, ADR, RevPAR, Total Revenue, YoY comparison.
// Room Performance table + actionable insights.
// "Check back in X days" when insufficient data.

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, subMonths, subYears } from 'date-fns'
import { CaretDown, CaretUp, TrendUp, TrendDown, Minus } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { useRooms } from '@/hooks/useRooms'
import { cn } from '@/lib/utils'

// ─── Data hooks ──────────────────────────────────────────────────────────────

function usePayments(startDate, endDate) {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['financials-payments', propertyId, startDate, endDate],
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('payments')
        .select('amount_cents, created_at, reservation_id, reservations(check_in, check_out, room_ids, status)')
        .eq('property_id', propertyId)
        .eq('status', 'paid')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
      if (error) return []
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

function useAllReservationsForPeriod(startDate, endDate) {
  const { propertyId } = useProperty()
  return useQuery({
    queryKey: ['financials-reservations', propertyId, startDate, endDate],
    queryFn: async () => {
      if (!propertyId) return []
      const { data, error } = await supabase
        .from('reservations')
        .select('id, check_in, check_out, room_ids, status, total_due_cents')
        .eq('property_id', propertyId)
        .not('status', 'eq', 'cancelled')
        .gte('check_in', startDate.slice(0, 10))
        .lte('check_in', endDate.slice(0, 10))
      if (error) return []
      return data ?? []
    },
    enabled: !!propertyId,
  })
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function fmt(cents) {
  if (cents == null) return '$0'
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtFull(cents) {
  if (cents == null) return '$0.00'
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtPct(n) {
  return `${(n * 100).toFixed(1)}%`
}

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0
  const diff = differenceInDays(parseISO(checkOut), parseISO(checkIn))
  return Math.max(0, diff)
}

function computeMetrics(reservations, payments, roomCount, periodDays) {
  const totalRevenue = payments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
  const nightsBooked = reservations.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0)
  const totalAvailableNights = roomCount * periodDays

  const occupancy = totalAvailableNights > 0 ? nightsBooked / totalAvailableNights : 0
  const adr = nightsBooked > 0 ? totalRevenue / nightsBooked : 0
  const revpar = totalAvailableNights > 0 ? totalRevenue / totalAvailableNights : 0

  return { totalRevenue, nightsBooked, occupancy, adr, revpar, totalAvailableNights }
}

// Per-room stats
function computeRoomMetrics(reservations, payments, rooms, periodDays) {
  return rooms.map(room => {
    const roomRes = reservations.filter(r => r.room_ids?.includes(room.id))
    const roomPayments = payments.filter(p =>
      p.reservations?.room_ids?.includes(room.id)
    )
    const nightsBooked = roomRes.reduce((s, r) => s + nightsBetween(r.check_in, r.check_out), 0)
    const revenue = roomPayments.reduce((s, p) => s + (p.amount_cents ?? 0), 0)
    const occupancy = periodDays > 0 ? nightsBooked / periodDays : 0
    const adr = nightsBooked > 0 ? revenue / nightsBooked : 0
    return { room, nightsBooked, revenue, occupancy, adr }
  })
}

// ─── Components ──────────────────────────────────────────────────────────────

function MetricCard({ title, abbr, value, description, math, yoy }) {
  const [showMath, setShowMath] = useState(false)

  return (
    <div className="bg-surface border border-border rounded-[8px] p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-body text-[11px] uppercase tracking-[0.08em] font-semibold text-text-muted">
            {abbr}
          </p>
          <p className="font-body text-[13px] text-text-secondary">{title}</p>
        </div>
        {yoy != null && (
          <span className={cn(
            'flex items-center gap-0.5 text-[12px] font-body font-semibold px-2 py-0.5 rounded-full',
            yoy > 0 ? 'bg-success-bg text-success' : yoy < 0 ? 'bg-danger-bg text-danger' : 'bg-border text-text-muted'
          )}>
            {yoy > 0 ? <TrendUp size={12} /> : yoy < 0 ? <TrendDown size={12} /> : <Minus size={12} />}
            {Math.abs(yoy).toFixed(1)}%
          </span>
        )}
      </div>

      <p className="font-mono text-[28px] text-text-primary leading-none">{value}</p>

      <p className="font-body text-[13px] text-text-secondary">{description}</p>

      {math && (
        <div>
          <button
            onClick={() => setShowMath(s => !s)}
            className="flex items-center gap-1 font-body text-[12px] text-text-muted hover:text-info transition-colors"
          >
            {showMath ? <CaretUp size={12} /> : <CaretDown size={12} />}
            Show my math
          </button>
          {showMath && (
            <div className="mt-2 p-3 bg-surface-raised border border-border rounded-[6px] font-body text-[12px] text-text-secondary space-y-1">
              {math.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const PERIOD_OPTIONS = [
  { value: 'this_month',  label: 'This Month' },
  { value: 'last_month',  label: 'Last Month' },
  { value: 'last_90',     label: 'Last 90 Days' },
  { value: 'this_year',   label: 'This Year (YTD)' },
]

function getPeriodDates(period) {
  const now = new Date()
  switch (period) {
    case 'this_month': {
      const s = startOfMonth(now)
      const e = endOfMonth(now)
      return { start: format(s, "yyyy-MM-dd'T'00:00:00"), end: format(e, "yyyy-MM-dd'T'23:59:59"), days: differenceInDays(e, s) + 1 }
    }
    case 'last_month': {
      const s = startOfMonth(subMonths(now, 1))
      const e = endOfMonth(subMonths(now, 1))
      return { start: format(s, "yyyy-MM-dd'T'00:00:00"), end: format(e, "yyyy-MM-dd'T'23:59:59"), days: differenceInDays(e, s) + 1 }
    }
    case 'last_90': {
      const s = new Date(now); s.setDate(s.getDate() - 90)
      return { start: format(s, "yyyy-MM-dd'T'00:00:00"), end: format(now, "yyyy-MM-dd'T'23:59:59"), days: 90 }
    }
    case 'this_year': {
      const s = new Date(now.getFullYear(), 0, 1)
      return { start: format(s, "yyyy-MM-dd'T'00:00:00"), end: format(now, "yyyy-MM-dd'T'23:59:59"), days: differenceInDays(now, s) + 1 }
    }
    default:
      return getPeriodDates('this_month')
  }
}

function InsightsSection({ metrics, priorMetrics, rooms, hasEnoughData, daysUntilEnough }) {
  if (!hasEnoughData) {
    return (
      <div className="bg-info-bg border border-info rounded-[8px] p-5">
        <p className="font-body text-[15px] text-info font-semibold mb-1">Not enough data yet</p>
        <p className="font-body text-[14px] text-text-secondary">
          Check back in about <span className="font-semibold">{daysUntilEnough} days</span> once you have more reservations.
          Insights become meaningful once you have at least 30 days of booking history.
        </p>
      </div>
    )
  }

  const insights = []

  if (metrics.occupancy < 0.4) {
    insights.push({
      emoji: '📉',
      text: `Your occupancy is ${fmtPct(metrics.occupancy)}, which is below 40%. Consider lowering your rate slightly or adding promotions for off-peak dates.`,
    })
  } else if (metrics.occupancy > 0.8) {
    insights.push({
      emoji: '🔥',
      text: `Great news — your occupancy is ${fmtPct(metrics.occupancy)}. You may be able to charge more per night since demand is high.`,
    })
  } else {
    insights.push({
      emoji: '✅',
      text: `Occupancy is at ${fmtPct(metrics.occupancy)}, which is solid. Keep monitoring and adjust pricing seasonally.`,
    })
  }

  if (metrics.adr > 0 && priorMetrics?.adr > 0) {
    const adrChange = (metrics.adr - priorMetrics.adr) / priorMetrics.adr
    if (adrChange > 0.05) {
      insights.push({
        emoji: '💰',
        text: `Your average daily rate is up ${fmtPct(adrChange)} compared to the prior period. That's ${fmtFull(metrics.adr)} per night, versus ${fmtFull(priorMetrics.adr)} before.`,
      })
    } else if (adrChange < -0.05) {
      insights.push({
        emoji: '⚠️',
        text: `Your average daily rate dropped ${fmtPct(Math.abs(adrChange))} compared to the prior period. Consider reviewing your pricing strategy.`,
      })
    }
  }

  if (rooms.length > 1) {
    const sorted = [...rooms].sort((a, b) => b.adr - a.adr)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    if (best.adr > 0 && worst.adr > 0 && best.room.id !== worst.room.id) {
      insights.push({
        emoji: '🏆',
        text: `${best.room.name} is your top earner at ${fmtFull(best.adr)}/night average. ${worst.room.name} lags at ${fmtFull(worst.adr)}/night — it may benefit from better photos or a rate adjustment.`,
      })
    }
  }

  if (metrics.revpar < 50) {
    insights.push({
      emoji: '📊',
      text: `RevPAR (revenue per available room night) is ${fmtFull(metrics.revpar * 100)}. This factors in empty nights. A higher RevPAR means you're filling rooms at good rates.`,
    })
  }

  if (insights.length === 0) {
    insights.push({
      emoji: '📈',
      text: `Things look stable this period. Keep collecting data for more detailed insights.`,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {insights.map((insight, i) => (
        <div key={i} className="flex items-start gap-3 bg-surface border border-border rounded-[8px] p-4">
          <span className="text-[20px] leading-none mt-0.5">{insight.emoji}</span>
          <p className="font-body text-[14px] text-text-secondary">{insight.text}</p>
        </div>
      ))}
    </div>
  )
}

export default function Financials() {
  const [period, setPeriod] = useState('this_month')
  const { data: rooms = [] } = useRooms()

  const { start, end, days } = getPeriodDates(period)

  // Prior period (same length, one period back) for YoY / comparison
  const priorEnd = new Date(start); priorEnd.setSeconds(priorEnd.getSeconds() - 1)
  const priorStart = new Date(priorEnd); priorStart.setDate(priorStart.getDate() - days)
  const priorStartStr = format(priorStart, "yyyy-MM-dd'T'HH:mm:ss")
  const priorEndStr = format(priorEnd, "yyyy-MM-dd'T'HH:mm:ss")

  const { data: payments = [], isLoading: pLoading } = usePayments(start, end)
  const { data: reservations = [], isLoading: rLoading } = useAllReservationsForPeriod(start, end)
  const { data: priorPayments = [] } = usePayments(priorStartStr, priorEndStr)
  const { data: priorReservations = [] } = useAllReservationsForPeriod(priorStartStr, priorEndStr)

  const isLoading = pLoading || rLoading
  const roomCount = rooms.length || 1

  const metrics = useMemo(
    () => computeMetrics(reservations, payments, roomCount, days),
    [reservations, payments, roomCount, days]
  )
  const priorMetrics = useMemo(
    () => computeMetrics(priorReservations, priorPayments, roomCount, days),
    [priorReservations, priorPayments, roomCount, days]
  )
  const roomMetrics = useMemo(
    () => computeRoomMetrics(reservations, payments, rooms, days),
    [reservations, payments, rooms, days]
  )

  // Need at least 30 days of data (at least 5 paid reservations) to show insights
  const hasEnoughData = payments.length >= 5 && days >= 14
  const daysUntilEnough = Math.max(0, 30 - days)

  function yoyChange(current, prior) {
    if (!prior || prior === 0) return null
    return ((current - prior) / prior) * 100
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="font-heading text-[32px] text-text-primary">Financials</h1>
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={cn(
                'px-4 py-2 rounded-[6px] font-body text-[14px] border transition-colors',
                period === opt.value
                  ? 'bg-text-primary text-white border-text-primary'
                  : 'border-border text-text-secondary hover:bg-border hover:text-text-primary'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="animate-pulse bg-border rounded-[8px] h-40" />
          ))}
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              abbr="Revenue"
              title="Total Revenue"
              value={fmt(metrics.totalRevenue)}
              description="Sum of all paid payments during this period."
              yoy={yoyChange(metrics.totalRevenue, priorMetrics.totalRevenue)}
              math={[
                `All paid payment amounts added together`,
                `= ${fmtFull(metrics.totalRevenue)}`,
              ]}
            />
            <MetricCard
              abbr="Occupancy %"
              title="Occupancy Rate"
              value={fmtPct(metrics.occupancy)}
              description="How many of your available room nights were actually booked. 70%+ is generally strong."
              yoy={yoyChange(metrics.occupancy * 100, priorMetrics.occupancy * 100)}
              math={[
                `Formula: Nights Booked ÷ Total Available Room Nights`,
                `= ${metrics.nightsBooked} nights booked ÷ (${roomCount} room${roomCount !== 1 ? 's' : ''} × ${days} days)`,
                `= ${metrics.nightsBooked} ÷ ${metrics.totalAvailableNights}`,
                `= ${fmtPct(metrics.occupancy)}`,
              ]}
            />
            <MetricCard
              abbr="ADR"
              title="Average Daily Rate"
              value={fmtFull(metrics.adr)}
              description="On average, how much you earned per booked night. Higher is better, but keep occupancy in mind."
              yoy={yoyChange(metrics.adr, priorMetrics.adr)}
              math={[
                `Formula: Total Revenue ÷ Nights Booked`,
                `= ${fmtFull(metrics.totalRevenue)} ÷ ${metrics.nightsBooked} nights`,
                `= ${fmtFull(metrics.adr)} per night`,
              ]}
            />
            <MetricCard
              abbr="RevPAR"
              title="Revenue Per Available Room Night"
              value={fmtFull(metrics.revpar)}
              description="The gold standard metric — combines rate AND occupancy. Tells you how much revenue each room slot generated, including empty nights."
              yoy={yoyChange(metrics.revpar, priorMetrics.revpar)}
              math={[
                `Formula: Total Revenue ÷ Total Available Room Nights`,
                `= ${fmtFull(metrics.totalRevenue)} ÷ ${metrics.totalAvailableNights} available nights`,
                `= ${fmtFull(metrics.revpar)} per available night`,
                `(RevPAR = ADR × Occupancy Rate)`,
                `= ${fmtFull(metrics.adr)} × ${fmtPct(metrics.occupancy)} = ${fmtFull(metrics.revpar)}`,
              ]}
            />
          </div>

          {/* Room Performance Table */}
          {rooms.length > 1 && (
            <div>
              <h2 className="font-heading text-[22px] text-text-primary mb-4">Room Performance</h2>
              <div className="border border-border rounded-[8px] overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-text-primary">
                      {['Room', 'Nights Booked', 'Occupancy', 'ADR', 'Revenue'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-body text-[13px] uppercase tracking-wider text-white font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roomMetrics.map(({ room, nightsBooked, revenue, occupancy, adr }) => (
                      <tr key={room.id} className="border-b border-border hover:bg-surface-raised transition-colors">
                        <td className="px-4 py-3 font-body text-[14px] text-text-primary">{room.name}</td>
                        <td className="px-4 py-3 font-mono text-[14px] text-text-secondary">{nightsBooked}</td>
                        <td className="px-4 py-3 font-mono text-[14px] text-text-secondary">{fmtPct(occupancy)}</td>
                        <td className="px-4 py-3 font-mono text-[14px] text-text-secondary">{fmtFull(adr)}</td>
                        <td className="px-4 py-3 font-mono text-[14px] text-text-primary">{fmt(revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Insights */}
          <div>
            <h2 className="font-heading text-[22px] text-text-primary mb-4">Insights</h2>
            <InsightsSection
              metrics={metrics}
              priorMetrics={priorMetrics}
              rooms={roomMetrics}
              hasEnoughData={hasEnoughData}
              daysUntilEnough={daysUntilEnough}
            />
          </div>
        </>
      )}
    </div>
  )
}
