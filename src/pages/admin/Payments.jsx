// src/pages/admin/Payments.jsx
// Payments management page.
// NEVER calculates per-reservation payment balances locally — those always come from usePaymentSummary.
// Page-level aggregate totals (collected, refunded, pending) summarize the raw payments list for display only.

import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { CurrencyDollar, Plus } from '@phosphor-icons/react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import { useProperty } from '@/lib/property/useProperty'
import { queryKeys } from '@/config/queryKeys'
import { DataTable } from '@/components/shared/DataTable'
import { StatusChip } from '@/components/shared/StatusChip'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/useToast'

const METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
]

const PAGE_SIZE = 200

function usePayments() {
  const { propertyId } = useProperty()

  return useInfiniteQuery({
    queryKey: queryKeys.payments.list({ propertyId }),
    queryFn: async ({ pageParam = 0 }) => {
      if (!propertyId) return { data: [], nextOffset: null }
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id, amount_cents, method, status, created_at, notes, payment_date, check_number,
          reservations(id, confirmation_number,
            guests(first_name, last_name)
          )
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1)
      if (error) throw error
      const rows = data ?? []
      return {
        data: rows,
        nextOffset: rows.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null,
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    enabled: !!propertyId,
  })
}

function useRecordPayment() {
  const queryClient = useQueryClient()
  const { propertyId } = useProperty()

  return useMutation({
    mutationFn: async ({ amount_cents, method, notes, reservation_id, payment_date, check_number }) => {
      const { data, error } = await supabase
        .from('payments')
        .insert({
          amount_cents,
          method,
          notes,
          reservation_id,
          payment_date,
          check_number,
          property_id: propertyId,
          status: 'paid',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentSummary.all })
    },
  })
}

function RecordPaymentModal({ open, onClose }) {
  const { addToast } = useToast()
  const recordPayment = useRecordPayment()
  const [form, setForm] = useState({ amount: '', method: 'cash', notes: '', reservation_id: '', payment_date: '', check_number: '' })
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!form.amount || Number(form.amount) <= 0) e.amount = 'Enter a valid amount'
    if (!form.notes.trim()) e.notes = 'Notes are required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    try {
      await recordPayment.mutateAsync({
        amount_cents: Math.round(Number(form.amount) * 100),
        method: form.method,
        notes: form.notes,
        reservation_id: form.reservation_id || null,
        payment_date: form.payment_date || null,
        check_number: form.method === 'check' ? (form.check_number || null) : null,
      })
      addToast({ message: 'Payment recorded successfully', variant: 'success' })
      setForm({ amount: '', method: 'cash', notes: '', reservation_id: '', payment_date: '', check_number: '' })
      onClose()
    } catch (err) {
      addToast({ message: err?.message ?? 'Failed to record payment', variant: 'error' })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record Payment">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <label htmlFor="payment-amount" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
            Amount ($)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[15px] text-text-muted">$</span>
            <input
              id="payment-amount"
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="h-11 border-[1.5px] border-border rounded-[6px] pl-7 pr-3 font-mono text-[15px] text-text-primary bg-surface-raised w-full focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
            />
          </div>
          {errors.amount && (
            <span className="mt-1 text-danger text-[13px]">{errors.amount}</span>
          )}
        </div>

        <Select
          label="Method"
          options={METHOD_OPTIONS}
          value={form.method}
          onValueChange={(v) => setForm((f) => ({ ...f, method: v, check_number: v === 'check' ? f.check_number : '' }))}
        />

        {form.method === 'check' && (
          <Input
            label="Check Number"
            placeholder="e.g. 1042"
            value={form.check_number}
            onChange={(e) => setForm((f) => ({ ...f, check_number: e.target.value }))}
          />
        )}

        <Input
          label="Payment Date (optional)"
          type="date"
          value={form.payment_date}
          onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
        />

        <Input
          label="Reservation ID (optional)"
          value={form.reservation_id}
          onChange={(e) => setForm((f) => ({ ...f, reservation_id: e.target.value }))}
        />

        <div className="flex flex-col">
          <label htmlFor="payment-notes" className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-1">
            Notes <span className="text-danger">*</span>
          </label>
          <textarea
            id="payment-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Payment notes (required)"
            className="border-[1.5px] border-border rounded-[6px] px-3 py-2 font-body text-[15px] text-text-primary bg-surface-raised resize-none focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
          />
          {errors.notes && (
            <span className="mt-1 text-danger text-[13px]">{errors.notes}</span>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-2">
          <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="md" loading={recordPayment.isPending} onClick={handleSubmit}>
            Record Payment
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const COLUMNS = [
  {
    key: 'created_at',
    label: 'Date',
    render: (_, row) => {
      const d = row.payment_date ?? row.created_at
      return (
        <span className="font-mono text-[14px]">
          {d ? format(parseISO(d), 'MMM d, yyyy') : '—'}
        </span>
      )
    },
  },
  {
    key: 'reservation',
    label: 'Reservation #',
    render: (_, row) => (
      <span className="font-mono text-[14px]">
        {row.reservations?.confirmation_number ?? '—'}
      </span>
    ),
  },
  {
    key: 'guest',
    label: 'Guest',
    render: (_, row) => {
      const g = row.reservations?.guests
      if (!g) return <span className="text-text-muted font-body text-[14px]">—</span>
      return <span className="font-body text-[14px]">{g.first_name} {g.last_name}</span>
    },
  },
  {
    key: 'amount_cents',
    label: 'Amount',
    numeric: true,
    render: (val) => (
      <span className="font-mono text-[14px]">
        ${val != null ? (val / 100).toFixed(2) : '0.00'}
      </span>
    ),
  },
  {
    key: 'method',
    label: 'Method',
    render: (val) => (
      <span className="font-body text-[14px] capitalize">{val ?? '—'}</span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (val) => <StatusChip status={val} type="payment" />,
  },
]

export default function Payments() {
  const [recordOpen, setRecordOpen] = useState(false)
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = usePayments()
  const payments = useMemo(() => data?.pages?.flatMap((p) => p.data) ?? [], [data])

  const totalCollectedCents = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)

  const totalRefundedCents = payments
    .filter((p) => p.status === 'refunded')
    .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)

  const pendingCents = payments
    .filter((p) => p.status === 'pending' || p.status === 'partial')
    .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[32px] text-text-primary uppercase">Payments</h1>
        <Button variant="primary" size="md" onClick={() => setRecordOpen(true)}>
          <Plus size={16} weight="bold" /> Record Payment
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-[8px] p-5 flex flex-col gap-1">
          <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
            Total Collected
          </p>
          <p className="font-mono text-[28px] text-success leading-none">
            ${(totalCollectedCents / 100).toFixed(2)}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-[8px] p-5 flex flex-col gap-1">
          <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
            Total Refunded
          </p>
          <p className="font-mono text-[28px] text-danger leading-none">
            ${(totalRefundedCents / 100).toFixed(2)}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-[8px] p-5 flex flex-col gap-1">
          <p className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary">
            Pending
          </p>
          <p className="font-mono text-[28px] text-warning leading-none">
            ${(pendingCents / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Payments Table */}
      <div className="border border-border rounded-[8px] overflow-hidden">
        <DataTable
          columns={COLUMNS}
          data={payments}
          loading={isLoading}
          emptyState={
            <div className="flex flex-col items-center gap-3 py-12">
              <CurrencyDollar size={32} weight="bold" className="text-text-muted" />
              <p className="font-body text-[15px] text-text-muted">No payments yet</p>
            </div>
          }
        />
      </div>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            size="md"
            loading={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            Load more payments
          </Button>
        </div>
      )}

      <RecordPaymentModal open={recordOpen} onClose={() => setRecordOpen(false)} />
    </div>
  )
}
