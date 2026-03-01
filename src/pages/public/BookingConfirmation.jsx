// src/pages/public/BookingConfirmation.jsx
// Shows after a successful booking. No auth required.
// Gets confirmation number from URL: ?confirmation=XXXXXX

import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, PrinterSimple } from '@phosphor-icons/react'
import { format, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { PageLoader } from '@/components/shared/PageLoader'
import { ErrorState } from '@/components/shared/ErrorState'

function formatCents(cents) {
  if (cents == null) return '$0.00'
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return format(parseISO(dateStr), 'MMMM d, yyyy')
  } catch {
    return dateStr
  }
}

export default function BookingConfirmation() {
  const [searchParams] = useSearchParams()
  const confirmationNumber = searchParams.get('confirmation')

  const [status, setStatus] = useState('loading') // 'loading' | 'error' | 'ready'
  const [reservation, setReservation] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  async function fetchReservation() {
    if (!confirmationNumber) {
      setErrorMessage('No confirmation number provided.')
      setStatus('error')
      return
    }

    setStatus('loading')
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, guests(first_name, last_name, email)')
        .eq('confirmation_number', confirmationNumber)
        .single()

      if (error || !data) {
        setErrorMessage('Reservation not found.')
        setStatus('error')
        return
      }

      setReservation(data)
      setStatus('ready')
    } catch (err) {
      setErrorMessage(err.message || 'Could not load reservation.')
      setStatus('error')
    }
  }

  useEffect(() => {
    fetchReservation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmationNumber])

  if (status === 'loading') {
    return <PageLoader />
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <ErrorState
          title="Reservation not found"
          message={errorMessage}
          onRetry={fetchReservation}
        />
      </div>
    )
  }

  const guest = reservation.guests || {}
  const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(' ')

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Success icon + heading */}
        <div className="text-center mb-8">
          <CheckCircle size={64} weight="fill" className="text-success mx-auto mb-4" />
          <h1 className="font-heading text-[32px] text-text-primary mb-2">Booking Confirmed!</h1>
          <p className="font-body text-[15px] text-text-secondary">
            Your reservation has been successfully created.
          </p>
        </div>

        {/* Confirmation number */}
        <div className="flex justify-center mb-6">
          <div className="bg-surface px-6 py-3 rounded-[6px] border border-border text-center">
            <p className="font-body text-[11px] text-text-muted uppercase tracking-[0.06em] mb-1">
              Confirmation Number
            </p>
            <span className="font-mono text-[18px] text-text-primary font-semibold">
              {confirmationNumber}
            </span>
          </div>
        </div>

        {/* Reservation details */}
        <div className="bg-surface-raised border border-border rounded-[12px] p-6 mb-6">
          <h2 className="font-heading text-[18px] text-text-primary mb-4">Reservation Details</h2>

          <div className="space-y-3">
            {guestName && (
              <div className="flex justify-between">
                <span className="font-body text-[14px] text-text-secondary">Guest</span>
                <span className="font-body text-[14px] text-text-primary">{guestName}</span>
              </div>
            )}

            {reservation.check_in && (
              <div className="flex justify-between">
                <span className="font-body text-[14px] text-text-secondary">Check-in</span>
                <span className="font-mono text-[14px] text-text-primary">
                  {formatDate(reservation.check_in)}
                </span>
              </div>
            )}

            {reservation.check_out && (
              <div className="flex justify-between">
                <span className="font-body text-[14px] text-text-secondary">Check-out</span>
                <span className="font-mono text-[14px] text-text-primary">
                  {formatDate(reservation.check_out)}
                </span>
              </div>
            )}

            {reservation.total_cents != null && (
              <>
                <hr className="border-border" />
                <div className="flex justify-between items-center">
                  <span className="font-body text-[14px] font-semibold text-text-primary">Total</span>
                  <span className="font-mono text-[16px] font-semibold text-text-primary">
                    {formatCents(reservation.total_cents)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Email notice */}
        {guest.email && (
          <p className="font-body text-[14px] text-text-secondary text-center mb-6">
            A confirmation email has been sent to{' '}
            <span className="text-text-primary font-semibold">{guest.email}</span>.
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center print:hidden">
          <Link
            to={`/guest-portal?confirmation=${confirmationNumber}`}
            className="inline-flex items-center justify-center h-11 px-4 text-[15px] font-body font-medium bg-text-primary text-white rounded-none hover:opacity-90 transition-opacity"
          >
            View My Reservation
          </Link>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 text-[15px] font-body font-medium bg-transparent border-[1.5px] border-text-primary text-text-primary rounded-none hover:opacity-80 transition-opacity"
          >
            <PrinterSimple size={16} />
            Print
          </button>
        </div>
      </div>
    </div>
  )
}
