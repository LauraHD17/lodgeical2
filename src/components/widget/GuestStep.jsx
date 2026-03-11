// src/components/widget/GuestStep.jsx

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { differenceInCalendarDays, format } from 'date-fns'
import { X } from '@phosphor-icons/react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { fmtMoney as formatCents } from '@/lib/utils'

export function GuestStep({ room, checkIn, checkOut, onNext, onBack }) {
  const [bookingForOther, setBookingForOther] = useState(false)
  const [ccEmails, setCcEmails] = useState([])
  const [ccInput, setCcInput] = useState('')
  const [ccError, setCcError] = useState('')

  const nights = differenceInCalendarDays(
    new Date(checkOut + 'T12:00:00'),
    new Date(checkIn + 'T12:00:00')
  )

  const guestSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Enter a valid email address'),
    phone: z.string().optional(),
    numGuests: z.coerce.number().int().min(1, 'At least 1 guest required')
      .max(room.max_guests, `Maximum ${room.max_guests} guest${room.max_guests !== 1 ? 's' : ''} for this room`),
    bookerEmail: bookingForOther
      ? z.string().email('Enter a valid email address')
      : z.string().optional(),
  })

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(guestSchema),
    defaultValues: { numGuests: 1 },
  })

  const ccEmailSchema = z.string().trim().toLowerCase().pipe(z.string().email('Enter a valid email address'))

  function addCcEmail() {
    const parsed = ccEmailSchema.safeParse(ccInput)
    if (!parsed.success) {
      if (!ccInput.trim()) return
      setCcError(parsed.error.errors?.[0]?.message ?? 'Invalid email')
      return
    }
    const email = parsed.data
    if (ccEmails.includes(email)) {
      setCcError('Email already added')
      return
    }
    if (ccEmails.length >= 5) {
      setCcError('Maximum 5 CC emails')
      return
    }
    setCcEmails([...ccEmails, email])
    setCcInput('')
    setCcError('')
  }

  function removeCcEmail(email) {
    setCcEmails(ccEmails.filter(e => e !== email))
  }

  function onSubmit(data) {
    onNext({
      ...data,
      bookerEmail: bookingForOther ? data.bookerEmail : null,
      ccEmails: bookingForOther ? ccEmails : [],
    })
  }

  return (
    <div>
      {/* Room summary */}
      <div className="bg-surface border border-border rounded-[6px] p-4 mb-6">
        <p className="font-body font-semibold text-[15px] text-text-primary">{room.name}</p>
        <p className="font-body text-[13px] text-text-secondary mt-0.5">
          {format(new Date(checkIn + 'T12:00:00'), 'MMM d')} – {format(new Date(checkOut + 'T12:00:00'), 'MMM d, yyyy')} · {nights} night{nights !== 1 ? 's' : ''}
        </p>
        <p className="font-mono text-[14px] text-text-primary mt-1">
          {formatCents(room.base_rate_cents * nights)}
        </p>
      </div>

      <h2 className="font-heading text-[24px] text-text-primary mb-6">
        {bookingForOther ? 'Guest staying' : 'Your information'}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="First Name"
              id="firstName"
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <Input
              label="Last Name"
              id="lastName"
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>
          <Input
            label="Email"
            id="email"
            type="email"
            placeholder="guest@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Phone (optional)"
            id="phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Input
            label={`Number of Guests (max ${room.max_guests})`}
            id="numGuests"
            type="number"
            min="1"
            max={room.max_guests}
            error={errors.numGuests?.message}
            {...register('numGuests')}
          />
        </div>

        {/* Book on behalf toggle */}
        <div className="mt-5 pt-5 border-t border-border">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={bookingForOther}
              onChange={(e) => setBookingForOther(e.target.checked)}
              className="w-4 h-4 rounded border-border text-info focus:ring-info"
            />
            <span className="font-body text-[14px] text-text-secondary">
              I&apos;m booking on behalf of someone else
            </span>
          </label>
        </div>

        {bookingForOther && (
          <div className="mt-4 flex flex-col gap-4">
            {/* Booker email */}
            <div className="bg-surface border border-border rounded-[6px] p-4">
              <h4 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-3">
                Your Information (Booker)
              </h4>
              <Input
                label="Your Email (for payment receipts)"
                id="bookerEmail"
                type="email"
                placeholder="you@company.com"
                error={errors.bookerEmail?.message}
                {...register('bookerEmail')}
              />
            </div>

            {/* CC emails */}
            <div className="bg-surface border border-border rounded-[6px] p-4">
              <h4 className="font-body text-[13px] uppercase tracking-[0.06em] font-semibold text-text-secondary mb-3">
                CC Check-in Details To
              </h4>
              <p className="font-body text-[13px] text-text-muted mb-3">
                Additional people who should receive check-in information (max 5).
              </p>
              <div className="flex gap-2">
                <Input
                  id="ccEmailInput"
                  type="email"
                  placeholder="colleague@company.com"
                  value={ccInput}
                  onChange={(e) => { setCcInput(e.target.value); setCcError('') }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCcEmail() } }}
                  error={ccError}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={addCcEmail}
                  className="shrink-0"
                >
                  Add
                </Button>
              </div>
              {ccEmails.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {ccEmails.map(email => (
                    <span key={email} className="inline-flex items-center gap-1 px-2 py-1 bg-info-bg border border-info rounded-full text-[12px] font-body text-info">
                      {email}
                      <button
                        type="button"
                        onClick={() => removeCcEmail(email)}
                        className="hover:text-danger"
                        aria-label={`Remove ${email}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Button variant="ghost" size="md" onClick={onBack} type="button" className="text-text-secondary">
            ← Back
          </Button>
          <Button variant="primary" size="lg" type="submit" className="flex-1">
            Review booking
          </Button>
        </div>
      </form>
    </div>
  )
}
