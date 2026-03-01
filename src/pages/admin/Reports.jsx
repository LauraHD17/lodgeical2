// src/pages/admin/Reports.jsx
// Reports page with recharts bar charts for Revenue and Occupancy by month.

import { useState, useMemo } from 'react'
import { format, subMonths, startOfMonth, endOfMonth, parseISO, eachMonthOfInterval } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { DownloadSimple, ChartBar } from '@phosphor-icons/react'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { Button } from '@/components/ui/Button'

function useReportData(dateFrom, dateTo) {
  const { propertyId } = useProperty()

  return useQuery({
    queryKey: ['reports', propertyId, dateFrom, dateTo],
    queryFn: async () => {
      if (!propertyId) return { reservations: [], payments: [] }

      const [resResult, payResult] = await Promise.all([
        supabase
          .from('reservations')
          .select('id, check_in, check_out, total_due_cents, status')
          .eq('property_id', propertyId)
          .gte('check_in', dateFrom)
          .lte('check_in', dateTo)
          .neq('status', 'cancelled'),
        supabase
          .from('payments')
          .select('id, amount_cents, created_at, status')
          .eq('property_id', propertyId)
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .eq('status', 'paid'),
      ])

      return {
        reservations: resResult.data ?? [],
        payments: payResult.data ?? [],
      }
    },
    enabled: !!propertyId,
  })
}

function exportCSV(data, filename) {
  if (!data.length) return
  const keys = Object.keys(data[0])
  const rows = [keys.join(','), ...data.map((r) => keys.map((k) => r[k]).join(','))]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-raised border border-border rounded-[6px] p-3 shadow-md">
      <p className="font-body text-[13px] font-semibold text-text-primary mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="font-mono text-[13px] text-text-secondary">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

export default function Reports() {
  const [monthRange, setMonthRange] = useState(6)

  const dateFrom = format(startOfMonth(subMonths(new Date(), monthRange - 1)), 'yyyy-MM-dd')
  const dateTo = format(endOfMonth(new Date()), 'yyyy-MM-dd')

  const { data, isLoading } = useReportData(dateFrom, dateTo)

  const months = useMemo(() => {
    const from = startOfMonth(subMonths(new Date(), monthRange - 1))
    const to = endOfMonth(new Date())
    return eachMonthOfInterval({ start: from, end: to })
  }, [monthRange])

  const revenueByMonth = useMemo(() => {
    if (!data?.payments) return []
    return months.map((month) => {
      const label = format(month, 'MMM yyyy')
      const total = data.payments
        .filter((p) => {
          const d = parseISO(p.created_at)
          return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()
        })
        .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)
      return { month: label, revenue: parseFloat((total / 100).toFixed(2)) }
    })
  }, [data, months])

  const occupancyByMonth = useMemo(() => {
    if (!data?.reservations) return []
    return months.map((month) => {
      const label = format(month, 'MMM yyyy')
      const end = endOfMonth(month)
      const daysInMonth = end.getDate()

      const reservations = data.reservations.filter((r) => {
        if (!r.check_in) return false
        const ci = parseISO(r.check_in)
        return ci.getMonth() === month.getMonth() && ci.getFullYear() === month.getFullYear()
      })

      const occupiedDays = reservations.reduce((sum, r) => {
        if (!r.check_in || !r.check_out) return sum
        const nights = Math.max(
          0,
          Math.floor(
            (parseISO(r.check_out) - parseISO(r.check_in)) / (1000 * 60 * 60 * 24)
          )
        )
        return sum + nights
      }, 0)

      const pct = daysInMonth > 0 ? Math.min(100, Math.round((occupiedDays / daysInMonth) * 100)) : 0
      return { month: label, occupancy: pct }
    })
  }, [data, months])

  const RANGE_OPTIONS = [
    { value: 3, label: 'Last 3 months' },
    { value: 6, label: 'Last 6 months' },
    { value: 12, label: 'Last 12 months' },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary">Reports</h1>
        <div className="flex items-center gap-3">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMonthRange(opt.value)}
              className={`font-body text-[14px] px-3 py-1.5 rounded-[6px] transition-colors ${
                monthRange === opt.value
                  ? 'bg-text-primary text-white'
                  : 'bg-surface border border-border text-text-secondary hover:bg-border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-8">
          <div className="animate-pulse bg-border rounded-[8px] h-64 w-full" />
          <div className="animate-pulse bg-border rounded-[8px] h-64 w-full" />
        </div>
      ) : (
        <>
          {/* Revenue Chart */}
          <div className="bg-surface border border-border rounded-[8px] p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <ChartBar size={20} className="text-text-secondary" />
                <h2 className="font-heading text-[20px] text-text-primary">Revenue by Month</h2>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => exportCSV(revenueByMonth, 'revenue-by-month.csv')}
              >
                <DownloadSimple size={14} /> Export CSV
              </Button>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueByMonth} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontFamily: 'DM Sans', fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis
                  tick={{ fontFamily: 'IBM Plex Mono', fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" fill="#1D4ED8" radius={[4, 4, 0, 0]} name="Revenue ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Occupancy Chart */}
          <div className="bg-surface border border-border rounded-[8px] p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <ChartBar size={20} className="text-text-secondary" />
                <h2 className="font-heading text-[20px] text-text-primary">Occupancy % by Month</h2>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => exportCSV(occupancyByMonth, 'occupancy-by-month.csv')}
              >
                <DownloadSimple size={14} /> Export CSV
              </Button>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={occupancyByMonth} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontFamily: 'DM Sans', fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis
                  tick={{ fontFamily: 'IBM Plex Mono', fontSize: 12, fill: '#6b7280' }}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="occupancy" fill="#15803D" radius={[4, 4, 0, 0]} name="Occupancy (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
