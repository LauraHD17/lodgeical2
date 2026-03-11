// src/pages/public/Invoice.jsx
// Printable invoice for a reservation. No auth required.
// Fetches by reservation ID from URL: /invoice/:id

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Printer } from '@phosphor-icons/react'
import { format, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { PageLoader } from '@/components/shared/PageLoader'
import { ErrorState } from '@/components/shared/ErrorState'
import { fmtMoney as formatCents } from '@/lib/utils'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'MMMM d, yyyy')
  } catch {
    return dateStr
  }
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy h:mm a')
  } catch {
    return dateStr
  }
}

export default function Invoice() {
  const { id } = useParams()

  const [status, setStatus] = useState('loading')
  const [reservation, setReservation] = useState(null)
  const [payments, setPayments] = useState([])
  const [errorMessage, setErrorMessage] = useState('')

  async function fetchData() {
    if (!id) {
      setErrorMessage('No reservation ID provided.')
      setStatus('error')
      return
    }

    setStatus('loading')
    try {
      const { data: res, error: resError } = await supabase
        .from('reservations')
        .select('*, guests(first_name, last_name, email, phone), properties(name, address, city, state, country), rooms(name)')
        .eq('id', id)
        .single()

      if (resError || !res) {
        setErrorMessage('Reservation not found.')
        setStatus('error')
        return
      }

      const { data: paysData } = await supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', id)
        .order('created_at', { ascending: true })

      setReservation(res)
      setPayments(paysData || [])
      setStatus('ready')
    } catch (err) {
      setErrorMessage(err.message || 'Could not load invoice.')
      setStatus('error')
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (status === 'loading') {
    return <PageLoader />
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <ErrorState
          title="Invoice not found"
          message={errorMessage}
          onRetry={fetchData}
        />
      </div>
    )
  }

  const guest = reservation.guests || {}
  const property = reservation.properties || {}
  const room = reservation.rooms || {}
  const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(' ')

  const totalPaid = payments
    .filter((p) => p.status === 'succeeded' || p.status === 'paid')
    .reduce((sum, p) => sum + (p.amount_cents || 0), 0)

  return (
    <div className="min-h-screen bg-white py-8 px-6 print:py-0 print:px-0">
      <div className="max-w-2xl mx-auto">

        {/* Print button — hidden when printing */}
        <div className="flex justify-end mb-6 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 h-10 px-4 font-body text-[14px] font-medium bg-transparent border-[1.5px] border-border rounded-none text-text-primary hover:opacity-80 transition-opacity"
          >
            <Printer size={16} />
            Print Invoice
          </button>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b border-border">
          <div>
            <h1 className="font-heading text-[32px] text-text-primary mb-1 uppercase">Invoice</h1>
            <p className="font-body text-[14px] text-text-secondary">Lodge-ical</p>
          </div>
          <div className="text-right">
            <p className="font-heading text-[18px] text-text-primary">{property.name || 'Property'}</p>
            {property.address && (
              <p className="font-body text-[13px] text-text-secondary">{property.address}</p>
            )}
            {(property.city || property.state) && (
              <p className="font-body text-[13px] text-text-secondary">
                {[property.city, property.state, property.country].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Invoice meta */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-muted mb-2">
              Bill To
            </h2>
            <p className="font-body text-[15px] text-text-primary font-semibold">{guestName || '—'}</p>
            {guest.email && (
              <p className="font-body text-[13px] text-text-secondary">{guest.email}</p>
            )}
            {guest.phone && (
              <p className="font-body text-[13px] text-text-secondary">{guest.phone}</p>
            )}
          </div>
          <div className="text-right">
            <div className="mb-2">
              <p className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-muted">
                Confirmation
              </p>
              <p className="font-mono text-[15px] text-text-primary">
                {reservation.confirmation_number || '—'}
              </p>
            </div>
            {reservation.created_at && (
              <div>
                <p className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-muted">
                  Booked
                </p>
                <p className="font-body text-[13px] text-text-secondary">
                  {formatDate(reservation.created_at)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reservation details table */}
        <div className="mb-8">
          <h2 className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-muted mb-3">
            Reservation Details
          </h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface">
                <th className="text-left py-2 px-3 font-body text-[12px] uppercase tracking-[0.05em] text-text-secondary border border-border">
                  Description
                </th>
                <th className="text-right py-2 px-3 font-body text-[12px] uppercase tracking-[0.05em] text-text-secondary border border-border">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-3 px-3 font-body text-[14px] text-text-primary border border-border">
                  <p className="font-semibold">{room.name || 'Room'}</p>
                  <p className="text-text-secondary text-[13px]">
                    <span className="font-mono">{formatDate(reservation.check_in)}</span>
                    {' → '}
                    <span className="font-mono">{formatDate(reservation.check_out)}</span>
                  </p>
                  {reservation.num_guests && (
                    <p className="text-text-muted text-[12px]">{reservation.num_guests} guest{reservation.num_guests !== 1 ? 's' : ''}</p>
                  )}
                </td>
                <td className="py-3 px-3 font-mono text-[14px] text-text-primary text-right border border-border align-top">
                  {formatCents(reservation.subtotal_cents)}
                </td>
              </tr>

              {reservation.tax_cents > 0 && (
                <tr>
                  <td className="py-2 px-3 font-body text-[14px] text-text-secondary border border-border">
                    Tax
                  </td>
                  <td className="py-2 px-3 font-mono text-[14px] text-text-primary text-right border border-border">
                    {formatCents(reservation.tax_cents)}
                  </td>
                </tr>
              )}

              <tr className="bg-surface">
                <td className="py-3 px-3 font-body text-[15px] font-bold text-text-primary border border-border">
                  Total
                </td>
                <td className="py-3 px-3 font-mono text-[16px] font-bold text-text-primary text-right border border-border">
                  {formatCents(reservation.total_cents)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payment history */}
        {payments.length > 0 && (
          <div className="mb-8">
            <h2 className="font-body text-[11px] uppercase tracking-[0.06em] font-semibold text-text-muted mb-3">
              Payment History
            </h2>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface">
                  <th className="text-left py-2 px-3 font-body text-[12px] uppercase tracking-[0.05em] text-text-secondary border border-border">
                    Date
                  </th>
                  <th className="text-left py-2 px-3 font-body text-[12px] uppercase tracking-[0.05em] text-text-secondary border border-border">
                    Method
                  </th>
                  <th className="text-left py-2 px-3 font-body text-[12px] uppercase tracking-[0.05em] text-text-secondary border border-border">
                    Status
                  </th>
                  <th className="text-right py-2 px-3 font-body text-[12px] uppercase tracking-[0.05em] text-text-secondary border border-border">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pay) => (
                  <tr key={pay.id}>
                    <td className="py-2 px-3 font-body text-[13px] text-text-secondary border border-border">
                      {formatDateTime(pay.created_at)}
                    </td>
                    <td className="py-2 px-3 font-body text-[13px] text-text-secondary border border-border capitalize">
                      {pay.payment_method || '—'}
                    </td>
                    <td className="py-2 px-3 font-body text-[13px] text-text-secondary border border-border capitalize">
                      {pay.status || '—'}
                    </td>
                    <td className="py-2 px-3 font-mono text-[13px] text-text-primary text-right border border-border">
                      {formatCents(pay.amount_cents)}
                    </td>
                  </tr>
                ))}
                {/* Total paid row */}
                <tr className="bg-surface">
                  <td colSpan={3} className="py-2 px-3 font-body text-[13px] font-semibold text-text-primary border border-border">
                    Total Paid
                  </td>
                  <td className="py-2 px-3 font-mono text-[14px] font-semibold text-text-primary text-right border border-border">
                    {formatCents(totalPaid)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Balance */}
        {reservation.total_cents != null && (
          <div className="flex justify-end">
            <div className="bg-surface border border-border rounded-[6px] px-6 py-3 text-right">
              <p className="font-body text-[13px] text-text-muted mb-1">Balance Due</p>
              <p className="font-mono text-[20px] font-bold text-text-primary">
                {formatCents(Math.max(0, (reservation.total_cents || 0) - totalPaid))}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-border text-center">
          <p className="font-body text-[12px] text-text-muted">
            Thank you for your booking. For questions, please contact the property directly.
          </p>
        </div>
      </div>

      {/* Print-only media CSS */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
